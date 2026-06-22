import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { getAsset, insertAsset } from "@/lib/data/assets";
import { updateFrameAiAsset } from "@/lib/data/packages";
import { downloadFromStorage, uploadToStorage } from "@/lib/storage";
import { buildImagePrompt, prepareSourceImage } from "@/lib/generation/image";
import { runImageOutputQA } from "@/lib/generation/agents/image-output-qa";
import { openai, IMAGE_MODEL } from "@/lib/openai";
import { toFile } from "openai";

export const maxDuration = 300;

type Body = {
  client_id: string;
  source_asset_id: string;
  frame_id?: string;
  headline?: string;
  body?: string;
  cta?: string;
  visual_direction?: string;
  layout_style?: string;
  output_format?: string;
  objective?: string;
  story_type?: string;
  offer?: string;
  quality?: string;
  prompt_override?: string;
};

const MAX_IMAGE_ATTEMPTS = 2;

function isFrangoNaBrazza(client: { slug: string; name: string; instagram: string; notes: string; brand_manual_summary: string; synthetic_manual: string }): boolean {
  const text = `${client.slug} ${client.name} ${client.instagram} ${client.notes} ${client.brand_manual_summary} ${client.synthetic_manual}`.toLowerCase();
  return text.includes("frango na brazza") || text.includes("frangonabrazza");
}

function retryPrompt(basePrompt: string): string {
  return [
    basePrompt,
    "",
    "RETRY STYLE: create a cleaner editorial real-food story.",
    "Use the real photographed meal as the dominant subject, approved text only, plain typography, small color accents, generous margins and central safe area.",
    "Keep any beverage/package small, cropped or in the background. Keep the design closer to a polished restaurant photo than to a poster.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const client = await getClient(body.client_id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const source = await getAsset(body.source_asset_id);
    if (!source || source.client_id !== client.id) {
      return NextResponse.json({ detail: "Imagem de origem não encontrada." }, { status: 404 });
    }

    const sourceBytes = await downloadFromStorage(source.storage_path);
    const prepared = await prepareSourceImage({
      bytes: sourceBytes,
      mimeType: source.mime_type,
      fileName: source.file_name,
    });

    const generatedPrompt = buildImagePrompt({
      client,
      headline: body.headline || "",
      body: body.body || "",
      cta: body.cta || "",
      visual_direction: body.visual_direction || "",
      layout_style: body.layout_style || "editorial",
      output_format: body.output_format || "stories",
      objective: body.objective,
      story_type: body.story_type,
      offer: body.offer,
    });

    const frangoClient = isFrangoNaBrazza(client);
    // Para Frango na Brazza, não confiamos em override manual antigo/contaminado:
    // a regra de marca precisa vencer qualquer prompt salvo em modal aberto.
    const basePrompt = body.prompt_override?.trim() && !frangoClient
      ? body.prompt_override.trim()
      : generatedPrompt;

    let pngBytes: Buffer | null = null;
    let lastImageQa: Awaited<ReturnType<typeof runImageOutputQA>> | null = null;
    let attemptCount = 0;

    for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt += 1) {
      attemptCount = attempt;
      const imageFile = await toFile(prepared, "source.png", { type: "image/png" });
      const result = await openai().images.edit({
        model: IMAGE_MODEL,
        image: imageFile,
        prompt: attempt === 1 ? basePrompt : retryPrompt(generatedPrompt),
        size: "1024x1536",
        quality: (body.quality as "low" | "medium" | "high") || "high",
        // Preserva fielmente o produto/logo da foto original (igual ChatGPT).
      });

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error("A IA não retornou imagem.");
      pngBytes = Buffer.from(b64, "base64");

      lastImageQa = await runImageOutputQA({ client, pngBytes });
      if (lastImageQa.approved) break;

      console.warn("Imagem reprovada pelo guardião visual", {
        client: client.slug,
        attempt,
        issues: lastImageQa.issues,
      });
    }

    if (!pngBytes || !lastImageQa?.approved) {
      return NextResponse.json(
        {
          detail: `A IA gerou ${attemptCount} variação(ões), mas o guardião visual reprovou: ${lastImageQa?.issues.join("; ") || lastImageQa?.notes || "sem detalhes"}`,
          image_qa: lastImageQa,
          attempts: attemptCount,
        },
        { status: 422 }
      );
    }

    const stored = await uploadToStorage({
      clientSlug: client.slug,
      role: "ai",
      fileName: "ai.png",
      mimeType: "image/png",
      bytes: pngBytes,
    });

    const asset = await insertAsset({
      client_id: client.id,
      role: "ai",
      file_name: stored.storage_path.split("/").pop() || "ai.png",
      mime_type: "image/png",
      storage_path: stored.storage_path,
      public_url: stored.public_url,
      size_bytes: pngBytes.byteLength,
      source: "ai",
      notes: "Imagem gerada com IA a partir de mídia real.",
    });

    if (body.frame_id) {
      await updateFrameAiAsset(body.frame_id, asset.id);
    }

    return NextResponse.json({ asset, image_url: asset.public_url, file_name: asset.file_name });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

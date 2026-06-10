import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { getAsset, insertAsset } from "@/lib/data/assets";
import { updateFrameAiAsset } from "@/lib/data/packages";
import { downloadFromStorage, uploadToStorage } from "@/lib/storage";
import { buildImagePrompt, prepareSourceImage } from "@/lib/generation/image";
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
  quality?: string;
};

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

    const prompt = buildImagePrompt({
      client,
      headline: body.headline || "",
      body: body.body || "",
      cta: body.cta || "",
      visual_direction: body.visual_direction || "",
      layout_style: body.layout_style || "editorial",
      output_format: body.output_format || "stories",
    });

    const imageFile = await toFile(prepared, "source.png", { type: "image/png" });
    const result = await openai().images.edit({
      model: IMAGE_MODEL,
      image: imageFile,
      prompt,
      size: "1024x1536",
      quality: (body.quality as "low" | "medium" | "high") || "medium",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não retornou imagem.");
    const pngBytes = Buffer.from(b64, "base64");

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

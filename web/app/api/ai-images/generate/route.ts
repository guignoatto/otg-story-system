import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { getAsset, insertAsset, listAssets } from "@/lib/data/assets";
import { getClientLearningMemory } from "@/lib/data/feedback";
import { updateFrameAiAsset } from "@/lib/data/packages";
import { downloadFromStorage, uploadToStorage } from "@/lib/storage";
import {
  buildImagePrompt,
  prepareFrangoMealFocusImage,
  prepareSourceImage,
} from "@/lib/generation/image";
import { runImageOutputQA } from "@/lib/generation/agents/image-output-qa";
import { runSourceImageQA } from "@/lib/generation/agents/source-image-qa";
import {
  buildFrangoPreflightNotes,
  buildFrangoRepairPrompt,
  isFrangoNaBrazzaClient,
} from "@/lib/generation/frango-safety";
import { applyOfficialLogo, isLogoPolicy, type LogoPolicy } from "@/lib/generation/logo-overlay";
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
  logo_policy?: LogoPolicy;
};

const MAX_IMAGE_ATTEMPTS = 2;

function shouldBlockSourceImage(
  sourceImageQa: Awaited<ReturnType<typeof runSourceImageQA>>
): boolean {
  if (sourceImageQa.approved) return false;
  const codes = new Set(sourceImageQa.issue_codes);
  return !codes.has("THIRD_PARTY_BRAND_FOCUS") || codes.size > 1;
}

function retryPrompt(
  basePrompt: string,
  imageQa: Awaited<ReturnType<typeof runImageOutputQA>> | null,
  frangoClient: boolean
): string {
  if (frangoClient) {
    return buildFrangoRepairPrompt(basePrompt, imageQa?.issue_codes ?? []);
  }

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
    const clientMemory = await getClientLearningMemory(client.id).catch(() => ({
      approved: [],
      rejected: [],
      approval_patterns: [],
      rejection_patterns: [],
    }));

    let source = await getAsset(body.source_asset_id);
    if (!source || source.client_id !== client.id) {
      const fallback = (await listAssets(client.id, "media")).find((asset) =>
        asset.mime_type.startsWith("image/")
      );
      if (!fallback) {
        return NextResponse.json(
          {
            detail: "Imagem de origem não encontrada e não há outra mídia válida para substituir.",
            remediation_steps: [
              "Cadastrar ou importar uma foto real do cliente.",
              "Regenerar o pacote para associar frames a mídias válidas.",
            ],
            attempts: 0,
          },
          { status: 404 }
        );
      }
      source = fallback;
    }

    let sourceBytes = await downloadFromStorage(source.storage_path);
    let prepared = await prepareSourceImage({
      bytes: sourceBytes,
      mimeType: source.mime_type,
      fileName: source.file_name,
    });
    let generationSource = prepared;

    const frangoClient = isFrangoNaBrazzaClient(client);
    const preflightNotes = frangoClient
      ? buildFrangoPreflightNotes([
          body.headline,
          body.body,
          body.cta,
          body.visual_direction,
          body.offer,
          source.file_name,
          source.notes,
          source.extracted_text_preview,
        ].filter(Boolean).join(" "))
      : [];

    if (frangoClient) {
      let sourceImageQa = await runSourceImageQA({ client, pngBytes: prepared });
      if (shouldBlockSourceImage(sourceImageQa)) {
        const alternatives = (await listAssets(client.id, "media"))
          .filter((asset) => asset.id !== source?.id && asset.mime_type.startsWith("image/"))
          .slice(0, 6);
        let swapped = false;
        for (const candidate of alternatives) {
          const candidateBytes = await downloadFromStorage(candidate.storage_path);
          const candidatePrepared = await prepareSourceImage({
            bytes: candidateBytes,
            mimeType: candidate.mime_type,
            fileName: candidate.file_name,
          });
          const candidateQa = await runSourceImageQA({ client, pngBytes: candidatePrepared });
          if (!shouldBlockSourceImage(candidateQa)) {
            source = candidate;
            sourceBytes = candidateBytes;
            prepared = candidatePrepared;
            sourceImageQa = candidateQa;
            swapped = true;
            preflightNotes.push(
              `A foto fonte original foi barrada; o sistema trocou automaticamente para ${candidate.file_name}.`
            );
            break;
          }
        }
        if (!swapped) {
          return NextResponse.json(
            {
              detail: `A foto de origem foi bloqueada antes da geração: ${sourceImageQa.issues.join("; ") || sourceImageQa.notes || "sem detalhes"}`,
              image_qa: sourceImageQa,
              source_image_qa: sourceImageQa,
              preflight_notes: preflightNotes,
              remediation_steps: [
                ...sourceImageQa.remediation_steps,
                "O sistema tentou procurar outra mídia do cliente, mas não encontrou alternativa segura.",
                "Cadastrar uma nova foto de comida caseira/prato/marmitex sem fogo, brasa ou peça visual dominante proibida.",
              ],
              attempts: 0,
            },
            { status: 422 }
          );
        }
      }
      if (!sourceImageQa.approved) {
        preflightNotes.push(
          "A foto fonte tem lata/refrigerante com risco de destaque, mas a geração foi permitida. O guardião final só deve barrar se a arte gerada transformar isso em protagonista."
        );
      }
      generationSource = await prepareFrangoMealFocusImage(prepared);
      preflightNotes.push(
        "A foto fonte foi reenquadrada automaticamente para priorizar o prato e reduzir placa, lata ou texto de fundo antes da geração."
      );
    }

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
      clientMemory,
    });

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
      const imageFile = await toFile(generationSource, "source.png", { type: "image/png" });
      const result = await openai().images.edit({
        model: IMAGE_MODEL,
        image: imageFile,
        prompt: attempt === 1 ? basePrompt : retryPrompt(generatedPrompt, lastImageQa, frangoClient),
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
          preflight_notes: preflightNotes,
          remediation_steps: lastImageQa?.remediation_steps ?? [],
          attempts: attemptCount,
        },
        { status: 422 }
      );
    }

    const logoPolicy = isLogoPolicy(body.logo_policy) ? body.logo_policy : "discreet";
    let logoApplied = false;
    let logoFileName: string | null = null;

    if (logoPolicy === "required" || logoPolicy === "discreet") {
      const logos = (await listAssets(client.id, "logo")).filter((asset) =>
        asset.mime_type.startsWith("image/")
      );
      const logo = logos[0] ?? null;
      if (!logo && logoPolicy === "required") {
        return NextResponse.json(
          {
            detail: "Logo obrigatória selecionada, mas este cliente não tem logo oficial cadastrada.",
            preflight_notes: preflightNotes,
            remediation_steps: ["Cadastre uma logo oficial no cliente ou altere o uso de logo para sem logo/discreta."],
            attempts: attemptCount,
          },
          { status: 422 }
        );
      }
      if (logo) {
        const logoBytes = await downloadFromStorage(logo.storage_path);
        pngBytes = await applyOfficialLogo({
          imageBytes: pngBytes,
          logoBytes,
          logo,
          policy: logoPolicy,
        });
        logoApplied = true;
        logoFileName = logo.file_name;
      }
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
      notes: logoApplied
        ? `Imagem gerada com IA a partir de mídia real. Logo oficial aplicada: ${logoFileName}.`
        : "Imagem gerada com IA a partir de mídia real.",
    });

    if (body.frame_id) {
      await updateFrameAiAsset(body.frame_id, asset.id);
    }

    return NextResponse.json({ asset, image_url: asset.public_url, file_name: asset.file_name });
  } catch (err) {
    return NextResponse.json(
      {
        detail: err instanceof Error ? err.message : String(err),
        remediation_steps: [
          "Tentar novamente com outra mídia real do cliente.",
          "Se for Frango na Brazza, usar foto de prato/marmitex/comida caseira sem fogo, brasa ou texto proibido.",
          "Se o erro for de logo obrigatória, cadastrar PNG sem fundo ou mudar o uso da logo para discreta/sem logo.",
        ],
      },
      { status: 500 }
    );
  }
}

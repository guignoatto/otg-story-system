import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { listAssets } from "@/lib/data/assets";
import { insertPackageWithFrames, type NewFrame } from "@/lib/data/packages";
import { generatePackage } from "@/lib/generation/pipeline";
import { driveCatalog } from "@/lib/drive";
import { importDriveFiles } from "@/lib/drive-import";
import { isGeneratableMediaAsset } from "@/lib/asset-classification";
import type { GenerationBrief } from "@/lib/types";

export const maxDuration = 300;
const MAX_SELECTED_MEDIA = 10;
const WEEKLY_FRAME_COUNT = 21;

function estimateCostBrl(frames: number): number {
  return Number((0.25 + frames * 0.12).toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    const brief = (await req.json()) as GenerationBrief;
    if (!brief?.client_id) {
      return NextResponse.json({ detail: "client_id obrigatório." }, { status: 400 });
    }
    const client = await getClient(brief.client_id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const frameCount = brief.weekly_batch
      ? WEEKLY_FRAME_COUNT
      : Math.max(3, Math.min(brief.frames || 4, 10));
    let allMedia = (await listAssets(client.id, "media")).filter(isGeneratableMediaAsset);
    const autoImportNotes: string[] = [];
    if (!allMedia.length && client.media_source_url) {
      try {
        const catalog = await driveCatalog(client.media_source_url, MAX_SELECTED_MEDIA);
        const imageFileIds = catalog
          .filter((item) => item.mime_type.startsWith("image/"))
          .slice(0, MAX_SELECTED_MEDIA)
          .map((item) => item.drive_file_id);
        if (imageFileIds.length) {
          const imported = await importDriveFiles(client, imageFileIds);
          allMedia = imported.filter(isGeneratableMediaAsset);
          autoImportNotes.push(`Importei automaticamente ${allMedia.length} mídia(s) do Drive antes de gerar.`);
        }
      } catch (err) {
        autoImportNotes.push(
          `Tentei importar do Drive automaticamente, mas falhou: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    const selectedIds = Array.isArray(brief.media_asset_ids)
      ? brief.media_asset_ids.slice(0, MAX_SELECTED_MEDIA)
      : [];
    const selectedIdSet = new Set(selectedIds);
    let media = selectedIds.length
      ? allMedia.filter((asset) => selectedIdSet.has(asset.id))
      : allMedia.slice(0, MAX_SELECTED_MEDIA);
    if (selectedIds.length && !media.length && allMedia.length) {
      media = allMedia.slice(0, MAX_SELECTED_MEDIA);
    }

    if (!media.length) {
      return NextResponse.json(
        {
          detail: "Este cliente ainda não tem imagem real válida para gerar o pacote.",
          remediation_steps: [
            client.media_source_url
              ? "Verificar se a pasta do Google Drive está acessível para a conta de serviço e contém imagens."
              : "Cadastrar ou importar fotos reais do cliente na biblioteca.",
            "Usar fotos de prato, ambiente, produto ou delivery em formato de imagem.",
            "Depois do upload, gerar o pacote novamente; o sistema seleciona automaticamente mídias válidas.",
          ],
          next_action: "Abrir o cadastro do cliente e enviar mídias reais antes de gerar.",
          auto_import_notes: autoImportNotes,
        },
        { status: 400 }
      );
    }
    const sanitizedBrief: GenerationBrief = {
      ...brief,
      client_id: client.id,
      frames: frameCount,
      media_asset_ids: media.map((asset) => asset.id),
    };

    const result = await generatePackage({
      client,
      brief: sanitizedBrief,
      media,
    });

    // Mapeia media_filename -> media_asset_id, com fallback round-robin.
    const byName = new Map(media.map((m) => [m.file_name, m.id]));
    const frames: NewFrame[] = result.frames.map((f, i) => {
      let mediaId: string | null = f.media_filename ? byName.get(f.media_filename) ?? null : null;
      if (!mediaId && media.length) mediaId = media[i % media.length].id;
      const refs = [
        f.weekly_day ? `dia:${f.weekly_day}` : "",
        f.daily_slot ? `story:${f.daily_slot}/3` : "",
        f.content_pillar ? `pilar:${f.content_pillar}` : "",
        f.content_goal ? `proposta:${f.content_goal}` : "",
      ].filter(Boolean);
      return {
        idx: f.index,
        headline: f.headline,
        body: f.body,
        cta: f.cta,
        visual_direction: f.visual_direction,
        layout_style: f.layout_style,
        media_asset_id: mediaId,
        ai_asset_id: null,
        refs,
      };
    });

    const pkg = await insertPackageWithFrames({
      client_id: client.id,
      objective: brief.objective,
      story_type: brief.story_type,
      output_format: brief.output_format || "stories",
      frames_count: frames.length,
      offer: brief.offer || "",
      cta: brief.cta || "",
      rationale: [
        autoImportNotes.join("\n"),
        result.rationale,
        result.qa_notes ? `QA: ${result.qa_notes}` : "",
      ].filter(Boolean).join("\n\n"),
      brand_score: result.brand_score,
      performance_score: result.performance_score,
      cost_brl: estimateCostBrl(frameCount),
      brief: sanitizedBrief,
      frames,
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        detail: err instanceof Error ? err.message : String(err),
        remediation_steps: [
          "Tentar novamente com menos frames ou menos mídias selecionadas.",
          "Se persistir, revisar o manual/mídias do cliente e regenerar o pacote.",
        ],
      },
      { status: 500 }
    );
  }
}

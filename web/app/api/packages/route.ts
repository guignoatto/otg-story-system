import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { listAssets } from "@/lib/data/assets";
import { insertPackageWithFrames, type NewFrame } from "@/lib/data/packages";
import { generatePackage } from "@/lib/generation/pipeline";
import type { GenerationBrief } from "@/lib/types";

export const maxDuration = 120;
const MAX_SELECTED_MEDIA = 10;

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

    const frameCount = Math.max(3, Math.min(brief.frames || 4, 10));
    const allMedia = (await listAssets(client.id, "media")).filter((a) =>
      a.mime_type.startsWith("image/")
    );
    const selectedIds = Array.isArray(brief.media_asset_ids)
      ? brief.media_asset_ids.slice(0, MAX_SELECTED_MEDIA)
      : [];
    const selectedIdSet = new Set(selectedIds);
    const media = selectedIds.length
      ? allMedia.filter((asset) => selectedIdSet.has(asset.id))
      : allMedia.slice(0, MAX_SELECTED_MEDIA);

    if (!media.length) {
      return NextResponse.json(
        { detail: "Selecione pelo menos uma imagem válida do cliente para gerar o pacote." },
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
      return {
        idx: f.index,
        headline: f.headline,
        body: f.body,
        cta: f.cta,
        visual_direction: f.visual_direction,
        layout_style: f.layout_style,
        media_asset_id: mediaId,
        ai_asset_id: null,
        refs: [],
      };
    });

    const pkg = await insertPackageWithFrames({
      client_id: client.id,
      objective: brief.objective,
      story_type: brief.story_type,
      output_format: brief.output_format || "stories",
      frames_count: frameCount,
      offer: brief.offer || "",
      cta: brief.cta || "",
      rationale: result.qa_notes
        ? `${result.rationale}\n\nQA: ${result.qa_notes}`
        : result.rationale,
      brand_score: result.brand_score,
      performance_score: result.performance_score,
      cost_brl: estimateCostBrl(frameCount),
      brief: sanitizedBrief,
      frames,
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

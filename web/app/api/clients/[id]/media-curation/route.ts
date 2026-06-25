import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { listAssets } from "@/lib/data/assets";
import { runMediaCurator } from "@/lib/generation/agents/media-curator";
import { isGeneratableMediaAsset } from "@/lib/asset-classification";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  asset_ids?: string[];
};

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Body;
    const requested = new Set(Array.isArray(body.asset_ids) ? body.asset_ids : []);
    const allMedia = (await listAssets(client.id, "media")).filter(isGeneratableMediaAsset);
    const media = requested.size
      ? allMedia.filter((asset) => requested.has(asset.id))
      : allMedia.slice(0, 12);

    const insights = await runMediaCurator(media.slice(0, 12));
    return NextResponse.json({ insights });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

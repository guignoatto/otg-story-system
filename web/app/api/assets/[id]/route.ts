import { NextRequest, NextResponse } from "next/server";
import { deleteAsset, getAsset, listAssets } from "@/lib/data/assets";
import { getClient, updateClient } from "@/lib/data/clients";
import { removeFromStorage } from "@/lib/storage";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await getAsset(id);
    const storagePath = await deleteAsset(id);
    if (storagePath) await removeFromStorage(storagePath);
    if (asset?.role === "manual") {
      const remainingManuals = await listAssets(asset.client_id, "manual");
      if (!remainingManuals.length) {
        const client = await getClient(asset.client_id);
        if (client) {
          await updateClient(client.id, {
            name: client.name,
            manual_status: "",
            brand_manual_summary: "",
          });
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

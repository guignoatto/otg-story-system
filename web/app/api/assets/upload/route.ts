import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { insertAsset } from "@/lib/data/assets";
import { uploadToStorage } from "@/lib/storage";
import { analyzeManual } from "@/lib/manual";
import type { Asset, AssetRole } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const clientId = String(formData.get("client_id") || "");
    const role = String(formData.get("role") || "") as AssetRole;
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (!clientId) return NextResponse.json({ detail: "client_id obrigatório." }, { status: 400 });
    if (role !== "manual" && role !== "media") {
      return NextResponse.json({ detail: "role deve ser manual ou media." }, { status: 400 });
    }
    if (!files.length) return NextResponse.json({ detail: "Nenhum arquivo enviado." }, { status: 400 });

    const client = await getClient(clientId);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const items: Asset[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";
      const stored = await uploadToStorage({
        clientSlug: client.slug,
        role,
        fileName: file.name,
        mimeType,
        bytes,
      });

      const analysis =
        role === "manual"
          ? await analyzeManual({ fileName: file.name, mimeType, bytes })
          : null;

      const asset = await insertAsset({
        client_id: client.id,
        role,
        file_name: file.name,
        mime_type: mimeType,
        storage_path: stored.storage_path,
        public_url: stored.public_url,
        size_bytes: bytes.byteLength,
        source: "upload",
        notes: analysis?.notes ?? "Arquivo recebido.",
        detected_colors: analysis?.detected_colors ?? [],
        detected_typography: analysis?.detected_typography ?? [],
        detected_tone: analysis?.detected_tone ?? null,
        extracted_text_preview: analysis?.extracted_text_preview ?? null,
      });
      items.push(asset);
    }

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

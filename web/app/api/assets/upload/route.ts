import { NextRequest, NextResponse } from "next/server";
import heicConvert from "heic-convert";
import { getClient, updateClient } from "@/lib/data/clients";
import { insertAsset } from "@/lib/data/assets";
import { uploadToStorage } from "@/lib/storage";
import { analyzeManual } from "@/lib/manual";
import type { Asset, AssetRole } from "@/lib/types";

export const maxDuration = 60;

function normalizeMimeType(browserType: string, fileName: string): string {
  if (browserType && browserType !== "application/octet-stream") return browserType;
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return browserType || "application/octet-stream";
}

async function maybeConvertHeic(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string
): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }> {
  const isHeic = mimeType === "image/heic" || mimeType === "image/heif";
  if (!isHeic) return { bytes, mimeType, fileName };
  const jpeg = await heicConvert({ buffer: Buffer.from(bytes), format: "JPEG", quality: 0.92 });
  const newName = fileName.replace(/\.(heic|heif)$/i, ".jpg");
  return { bytes: new Uint8Array(jpeg), mimeType: "image/jpeg", fileName: newName };
}

function mergeUnique(current: string[], next: string[]): string[] {
  return Array.from(new Set([...current, ...next].map((item) => item.trim()).filter(Boolean)));
}

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
    let clientProfile = client;
    for (const file of files) {
      const raw = new Uint8Array(await file.arrayBuffer());
      const rawMime = normalizeMimeType(file.type, file.name);
      const { bytes, mimeType, fileName } = await maybeConvertHeic(raw, rawMime, file.name);
      const stored = await uploadToStorage({
        clientSlug: client.slug,
        role,
        fileName,
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
        file_name: fileName,
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
      if (role === "manual" && analysis) {
        clientProfile = await updateClient(client.id, {
          name: clientProfile.name,
          color_palette: mergeUnique(clientProfile.color_palette, analysis.detected_colors),
          typography: mergeUnique(clientProfile.typography, analysis.detected_typography),
          tone: clientProfile.tone || analysis.detected_tone || "",
          manual_status: "Manual analisado por IA",
          brand_manual_summary: analysis.brand_manual_summary || clientProfile.brand_manual_summary,
        });
      }
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

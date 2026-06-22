import { NextRequest, NextResponse } from "next/server";
import { getClient, updateClient } from "@/lib/data/clients";
import { insertAsset } from "@/lib/data/assets";
import { convertHeicInStorage, downloadFromStorage, publicUrlFor, removeFromStorage } from "@/lib/storage";
import { analyzeManual } from "@/lib/manual";
import type { Asset, AssetRole } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  client_id: string;
  role: AssetRole;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes?: number;
};

function isHeic(mimeType: string, fileName: string): boolean {
  return (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    /\.(heic|heif)$/i.test(fileName)
  );
}

function mergeUnique(current: string[], next: string[]): string[] {
  return Array.from(new Set([...current, ...next].map((item) => item.trim()).filter(Boolean)));
}

/** Passo 2 do upload: o arquivo já está no Storage; aqui convertemos HEIC, analisamos manual e salvamos o registro. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const clientId = String(body.client_id || "");
    const role = body.role;

    if (!clientId) return NextResponse.json({ detail: "client_id obrigatório." }, { status: 400 });
    if (role !== "manual" && role !== "media") {
      return NextResponse.json({ detail: "role deve ser manual ou media." }, { status: 400 });
    }
    if (!body.storage_path) {
      return NextResponse.json({ detail: "storage_path obrigatório." }, { status: 400 });
    }

    const client = await getClient(clientId);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    // Segurança: o caminho precisa pertencer a este cliente e role.
    const expectedPrefix = `${client.slug}/${role}/`;
    if (!body.storage_path.startsWith(expectedPrefix)) {
      // Remove o objeto solto para não deixar lixo no bucket.
      await removeFromStorage(body.storage_path).catch(() => {});
      return NextResponse.json({ detail: "Caminho de upload inválido." }, { status: 400 });
    }

    let storage_path = body.storage_path;
    let file_name = body.file_name || storage_path.split("/").pop() || "arquivo";
    let mime_type = body.mime_type || "application/octet-stream";
    let size_bytes = body.size_bytes ?? 0;

    // HEIC do iPhone → JPEG (conversão server-side, lendo do próprio Storage).
    if (isHeic(mime_type, file_name)) {
      const converted = await convertHeicInStorage({
        storagePath: storage_path,
        clientSlug: client.slug,
        role,
        fileName: file_name,
      });
      storage_path = converted.storage_path;
      file_name = converted.file_name;
      mime_type = converted.mime_type;
      size_bytes = converted.size_bytes;
    }

    // Manual de marca: lê do Storage e extrai cores/fontes/tom.
    let analysis = null;
    let clientProfile = client;
    if (role === "manual") {
      const bytes = await downloadFromStorage(storage_path);
      analysis = await analyzeManual({ fileName: file_name, mimeType: mime_type, bytes });
      clientProfile = await updateClient(client.id, {
        name: clientProfile.name,
        color_palette: mergeUnique(clientProfile.color_palette, analysis.detected_colors),
        typography: mergeUnique(clientProfile.typography, analysis.detected_typography),
        tone: clientProfile.tone || analysis.detected_tone || "",
        manual_status: "Manual analisado por IA",
        brand_manual_summary: analysis.brand_manual_summary || clientProfile.brand_manual_summary,
      });
    }

    const asset: Asset = await insertAsset({
      client_id: client.id,
      role,
      file_name,
      mime_type,
      storage_path,
      public_url: publicUrlFor(storage_path),
      size_bytes,
      source: "upload",
      notes: analysis?.notes ?? "Arquivo recebido.",
      detected_colors: analysis?.detected_colors ?? [],
      detected_typography: analysis?.detected_typography ?? [],
      detected_tone: analysis?.detected_tone ?? null,
      extracted_text_preview: analysis?.extracted_text_preview ?? null,
    });

    return NextResponse.json({ asset });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

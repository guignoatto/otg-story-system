import { NextRequest, NextResponse } from "next/server";
import { getClient, updateClient } from "@/lib/data/clients";
import { insertAsset } from "@/lib/data/assets";
import { convertHeicInStorage, downloadFromStorage, publicUrlFor, removeFromStorage, uploadToStorage } from "@/lib/storage";
import { normalizeLogoPng } from "@/lib/generation/logo-overlay";
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

function isSupportedLogoImage(mimeType: string, fileName: string): boolean {
  return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/i.test(fileName);
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
    if (role !== "manual" && role !== "media" && role !== "logo") {
      return NextResponse.json({ detail: "role deve ser manual, media ou logo." }, { status: 400 });
    }
    if (!body.storage_path) {
      return NextResponse.json({ detail: "storage_path obrigatório." }, { status: 400 });
    }
    if (role === "logo" && !isSupportedLogoImage(body.mime_type || "", body.file_name || "")) {
      await removeFromStorage(body.storage_path).catch(() => {});
      return NextResponse.json({ detail: "Logo deve ser enviada como imagem." }, { status: 400 });
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

    if (role === "logo") {
      try {
        const logoBytes = await downloadFromStorage(storage_path);
        const pngBytes = await normalizeLogoPng(logoBytes);
        const normalizedName = file_name.includes(".")
          ? file_name.replace(/\.[^.]+$/i, ".png")
          : `${file_name}.png`;
        const stored = await uploadToStorage({
          clientSlug: client.slug,
          role,
          fileName: normalizedName,
          mimeType: "image/png",
          bytes: pngBytes,
        });
        await removeFromStorage(storage_path).catch(() => {});
        storage_path = stored.storage_path;
        file_name = normalizedName;
        mime_type = "image/png";
        size_bytes = pngBytes.byteLength;
      } catch (err) {
        await removeFromStorage(storage_path).catch(() => {});
        throw new Error(`Não consegui normalizar a logo como PNG sem fundo: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Manual de marca: lê do Storage e extrai cores/fontes/tom.
    let analysis = null;
    if (role === "manual") {
      const bytes = await downloadFromStorage(storage_path);
      analysis = await analyzeManual({ fileName: file_name, mimeType: mime_type, bytes });
      await updateClient(client.id, {
        name: client.name,
        color_palette: mergeUnique(client.color_palette, analysis.detected_colors),
        typography: mergeUnique(client.typography, analysis.detected_typography),
        tone: client.tone || analysis.detected_tone || "",
        manual_status: "Manual analisado por IA",
        brand_manual_summary: analysis.brand_manual_summary || client.brand_manual_summary,
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
      notes: role === "logo"
        ? "Logo oficial normalizada em PNG sem fundo pelo sistema."
        : analysis?.notes ?? "Arquivo recebido.",
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

import "server-only";
import { randomUUID } from "crypto";
import heicConvert from "heic-convert";
import { supabaseAdmin, STORAGE_BUCKET } from "./supabase/server";
import type { AssetRole } from "./types";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

function extFor(fileName: string, mime: string): string {
  const fromName = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (fromName) return fromName;
  return EXT_BY_MIME[mime] || "bin";
}

export type StoredFile = {
  storage_path: string;
  public_url: string;
};

/** URL pública de um caminho do bucket. */
export function publicUrlFor(storagePath: string): string {
  const { data } = supabaseAdmin().storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export type SignedUpload = {
  storage_path: string;
  token: string;
};

/**
 * Cria uma URL de upload assinada para o navegador enviar os bytes direto ao
 * Storage, sem passar pela função (que tem limite de 4,5 MB de corpo na Vercel).
 * O caminho é montado no servidor para o cliente não escolher um arbitrário.
 */
export async function createSignedUpload(params: {
  clientSlug: string;
  role: AssetRole;
  fileName: string;
  mimeType: string;
}): Promise<SignedUpload> {
  const { clientSlug, role, fileName, mimeType } = params;
  const ext = extFor(fileName, mimeType);
  const storage_path = `${clientSlug}/${role}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .createSignedUploadUrl(storage_path);
  if (error || !data) {
    throw new Error(`Falha ao criar URL de upload: ${error?.message ?? "desconhecido"}`);
  }
  return { storage_path, token: data.token };
}

/**
 * Converte um HEIC/HEIF já no Storage para JPEG: baixa, converte, regrava como
 * .jpg e remove o original. Retorna o novo caminho/mime/tamanho.
 */
export async function convertHeicInStorage(params: {
  storagePath: string;
  clientSlug: string;
  role: AssetRole;
  fileName: string;
}): Promise<{ storage_path: string; public_url: string; file_name: string; mime_type: string; size_bytes: number }> {
  const { storagePath, clientSlug, role, fileName } = params;
  const heicBytes = await downloadFromStorage(storagePath);
  const jpeg = await heicConvert({ buffer: heicBytes, format: "JPEG", quality: 0.92 });
  const jpegBytes = Buffer.from(jpeg);
  const newName = fileName.replace(/\.(heic|heif)$/i, ".jpg");
  const stored = await uploadToStorage({
    clientSlug,
    role,
    fileName: newName,
    mimeType: "image/jpeg",
    bytes: jpegBytes,
  });
  await removeFromStorage(storagePath);
  return {
    storage_path: stored.storage_path,
    public_url: stored.public_url,
    file_name: newName,
    mime_type: "image/jpeg",
    size_bytes: jpegBytes.byteLength,
  };
}

/**
 * Uploads raw bytes to the client-assets bucket under
 * {clientSlug}/{role}/{uuid}.{ext} and returns its storage path + public URL.
 */
export async function uploadToStorage(params: {
  clientSlug: string;
  role: AssetRole;
  fileName: string;
  mimeType: string;
  bytes: Buffer | Uint8Array;
}): Promise<StoredFile> {
  const { clientSlug, role, fileName, mimeType, bytes } = params;
  const ext = extFor(fileName, mimeType);
  const storage_path = `${clientSlug}/${role}/${randomUUID()}.${ext}`;
  const supabase = supabaseAdmin();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storage_path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Falha ao salvar arquivo no Storage: ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storage_path);
  return { storage_path, public_url: data.publicUrl };
}

/** Downloads a stored file back into a Buffer (used for AI image source). */
export async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Arquivo nao encontrado no Storage: ${storagePath}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function removeFromStorage(storagePath: string): Promise<void> {
  const supabase = supabaseAdmin();
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
}

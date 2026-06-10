import "server-only";
import { randomUUID } from "crypto";
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

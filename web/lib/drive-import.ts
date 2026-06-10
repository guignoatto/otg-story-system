import "server-only";
import { downloadDriveFile } from "./drive";
import { uploadToStorage } from "./storage";
import { insertAsset } from "./data/assets";
import type { Asset, ClientProfile } from "./types";

/** Downloads Drive files by id and stores them as media assets for a client. */
export async function importDriveFiles(client: ClientProfile, fileIds: string[]): Promise<Asset[]> {
  const items: Asset[] = [];
  for (const fileId of fileIds) {
    const file = await downloadDriveFile(fileId);
    const stored = await uploadToStorage({
      clientSlug: client.slug,
      role: "media",
      fileName: file.fileName,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
    const asset = await insertAsset({
      client_id: client.id,
      role: "media",
      file_name: file.fileName,
      mime_type: file.mimeType,
      storage_path: stored.storage_path,
      public_url: stored.public_url,
      size_bytes: file.bytes.byteLength,
      source: "drive",
      notes: "Mídia importada do Google Drive do restaurante.",
    });
    items.push(asset);
  }
  return items;
}

import "server-only";
import { google, type drive_v3 } from "googleapis";
import type { DriveMediaItem } from "./types";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function serviceAccountJson(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function driveConfigured(): boolean {
  return serviceAccountJson() !== null;
}

export function driveServiceAccountEmail(): string | null {
  const json = serviceAccountJson();
  return (json?.client_email as string) ?? null;
}

function driveClient(): drive_v3.Drive {
  const credentials = serviceAccountJson();
  if (!credentials) {
    throw new Error(
      "Google Drive não conectado. Defina GOOGLE_SERVICE_ACCOUNT_JSON e compartilhe a pasta do cliente com o e-mail da service account."
    );
  }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: DRIVE_SCOPES });
  return google.drive({ version: "v3", auth });
}

export function extractFolderId(value: string): string {
  const cleaned = (value || "").trim();
  if (!cleaned) throw new Error("Informe o link ou ID da pasta do Google Drive.");
  const patterns = [/\/folders\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /^([a-zA-Z0-9_-]{12,})$/];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) return m[1];
  }
  throw new Error(
    "Não consegui identificar o ID da pasta. Use um link https://drive.google.com/drive/folders/ID."
  );
}

type DriveFileMeta = drive_v3.Schema$File & { folderPath?: string[] };

async function listCatalog(folderId: string, maxFiles: number, maxDepth = 3): Promise<DriveFileMeta[]> {
  const drive = driveClient();
  const pending: Array<{ id: string; depth: number; path: string[] }> = [
    { id: folderId, depth: 0, path: [] },
  ];
  const media: DriveFileMeta[] = [];
  const visited = new Set<string>();

  while (pending.length && media.length < maxFiles * 3) {
    const { id, depth, path } = pending.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const query =
      `'${id}' in parents and trashed = false and ` +
      "(mimeType contains 'image/' or mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.folder')";

    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: query,
        fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink)",
        orderBy: "modifiedTime desc",
        pageSize: 100,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      for (const item of res.data.files ?? []) {
        const mime = item.mimeType ?? "";
        if (mime === "application/vnd.google-apps.folder" && depth < maxDepth) {
          pending.push({ id: item.id!, depth: depth + 1, path: [...path, item.name ?? ""] });
        } else if (mime.startsWith("image/") || mime.startsWith("video/")) {
          media.push({ ...item, folderPath: path });
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && media.length < maxFiles * 3);
  }

  media.sort((a, b) => (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase()));
  media.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
  media.sort((a, b) => Number(!(a.mimeType ?? "").startsWith("image/")) - Number(!(b.mimeType ?? "").startsWith("image/")));
  return media.slice(0, maxFiles);
}

function toCatalogItem(file: DriveFileMeta): DriveMediaItem {
  const size = file.size;
  return {
    drive_file_id: file.id!,
    name: file.name ?? file.id!,
    mime_type: file.mimeType ?? "application/octet-stream",
    size_bytes: size && /^\d+$/.test(String(size)) ? Number(size) : null,
    modified_time: file.modifiedTime ?? null,
    thumbnail_url: file.thumbnailLink ?? null,
    web_view_link: file.webViewLink ?? null,
    folder_path: file.folderPath ?? [],
  };
}

export async function driveCatalog(folderUrl: string, maxFiles: number): Promise<DriveMediaItem[]> {
  const folderId = extractFolderId(folderUrl);
  const files = await listCatalog(folderId, Math.max(1, Math.min(maxFiles, 120)));
  return files.map(toCatalogItem);
}

export type DriveDownload = { fileName: string; mimeType: string; bytes: Buffer };

export async function downloadDriveFile(fileId: string): Promise<DriveDownload> {
  const drive = driveClient();
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return {
    fileName: meta.data.name ?? fileId,
    mimeType: meta.data.mimeType ?? "application/octet-stream",
    bytes: Buffer.from(res.data as ArrayBuffer),
  };
}

export async function listFolderMediaIds(folderUrl: string, maxFiles: number): Promise<DriveMediaItem[]> {
  return driveCatalog(folderUrl, maxFiles);
}

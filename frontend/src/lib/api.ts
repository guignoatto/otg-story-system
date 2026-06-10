import type {
  AiImageRequest,
  AiImageResponse,
  AssetUploadResponse,
  CreateGenerationRequest,
  DriveCatalogResponse,
  DriveStatusResponse,
  GenerationJob,
  GenerationJobList,
  UploadedAsset,
  UsageSummary,
} from "../types";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function responseError(response: Response): Promise<Error> {
  const message = await response.text();
  return new Error(message || `Falha HTTP ${response.status}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export async function uploadAssets(clientId: string, role: "manual" | "media", files: File[]): Promise<UploadedAsset[]> {
  if (!clientId || !files.length) return [];

  const body = new FormData();
  body.append("client_id", clientId);
  body.append("role", role);
  files.forEach((file) => body.append("files", file));

  const data = await requestJson<AssetUploadResponse>("/v1/assets/upload", {
    method: "POST",
    body,
  });
  return data.items;
}

export function createGeneration(payload: CreateGenerationRequest): Promise<GenerationJob> {
  return requestJson<GenerationJob>("/v1/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function loadDriveStatus(): Promise<DriveStatusResponse> {
  return requestJson<DriveStatusResponse>("/v1/drive/status");
}

export function importDriveAssets(clientId: string, folderUrl: string, maxFiles = 12): Promise<AssetUploadResponse> {
  return requestJson<AssetUploadResponse>("/v1/assets/import-drive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, folder_url: folderUrl, max_files: maxFiles }),
  });
}

export function loadDriveCatalog(folderUrl: string, maxFiles = 120): Promise<DriveCatalogResponse> {
  return requestJson<DriveCatalogResponse>("/v1/drive/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_url: folderUrl, max_files: maxFiles }),
  });
}

export function importSelectedDriveAssets(clientId: string, fileIds: string[]): Promise<AssetUploadResponse> {
  return requestJson<AssetUploadResponse>("/v1/assets/import-drive-selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, file_ids: fileIds }),
  });
}

export function loadClientAssets(clientId: string, role = "media"): Promise<AssetUploadResponse> {
  return requestJson<AssetUploadResponse>(`/v1/clients/${encodeURIComponent(clientId)}/assets?role=${encodeURIComponent(role)}`);
}

export function loadClientHistory(clientId: string): Promise<GenerationJobList> {
  return requestJson<GenerationJobList>(`/v1/clients/${encodeURIComponent(clientId)}/generations`);
}

export function loadClientUsage(clientId: string): Promise<UsageSummary> {
  return requestJson<UsageSummary>(`/v1/clients/${encodeURIComponent(clientId)}/usage`);
}

export function generateAiImage(payload: AiImageRequest): Promise<AiImageResponse> {
  return requestJson<AiImageResponse>("/v1/ai-images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function downloadStoredAsset(uploadPath: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/v1/assets/download?url=${encodeURIComponent(uploadPath)}`);
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.blob();
}

export async function downloadAssetsZip(clientId: string, urls: string[], fileName: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/v1/assets/download-zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, urls, file_name: fileName }),
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.blob();
}

export function assetUrl(asset: UploadedAsset): string {
  if (!asset.url) return "";
  if (asset.url.startsWith("http")) return asset.url;
  return `${API_BASE}${asset.url}`;
}

export function uploadPathFromUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith(API_BASE)) return imageUrl.slice(API_BASE.length);
  if (imageUrl.startsWith("/uploads/")) return imageUrl;
  return "";
}

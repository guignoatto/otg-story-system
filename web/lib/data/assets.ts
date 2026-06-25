import "server-only";
import { supabaseAdmin } from "../supabase/server";
import { mapAsset } from "../mappers";
import type { Asset, AssetRole } from "../types";

export async function listAssets(clientId: string, role?: AssetRole): Promise<Asset[]> {
  let query = supabaseAdmin()
    .from("assets")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (role && role !== "logo") query = query.eq("role", role);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const mapped = (data ?? []).map(mapAsset);
  if (role === "logo") return mapped.filter((asset) => asset.role === "logo");
  if (role === "media") return mapped.filter((asset) => asset.role !== "logo");
  return mapped;
}

export async function getAsset(id: string): Promise<Asset | null> {
  const { data, error } = await supabaseAdmin()
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAsset(data) : null;
}

export type NewAsset = {
  client_id: string;
  role: AssetRole;
  file_name: string;
  mime_type: string;
  storage_path: string;
  public_url: string | null;
  size_bytes?: number;
  source?: Asset["source"];
  notes?: string;
  detected_colors?: string[];
  detected_typography?: string[];
  detected_tone?: string | null;
  extracted_text_preview?: string | null;
};

export async function deleteAsset(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("assets")
    .delete()
    .eq("id", id)
    .select("storage_path")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.storage_path ?? null;
}

export async function insertAsset(asset: NewAsset): Promise<Asset> {
  const dbRole = asset.role === "logo" ? "media" : asset.role;
  const notes = asset.role === "logo"
    ? `[asset_type:logo]\n${asset.notes ?? ""}`.trim()
    : asset.notes ?? "";
  const { data, error } = await supabaseAdmin()
    .from("assets")
    .insert({
      client_id: asset.client_id,
      role: dbRole,
      file_name: asset.file_name,
      mime_type: asset.mime_type,
      storage_path: asset.storage_path,
      public_url: asset.public_url,
      size_bytes: asset.size_bytes ?? 0,
      source: asset.source ?? "upload",
      notes,
      detected_colors: asset.detected_colors ?? [],
      detected_typography: asset.detected_typography ?? [],
      detected_tone: asset.detected_tone ?? null,
      extracted_text_preview: asset.extracted_text_preview ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAsset(data);
}

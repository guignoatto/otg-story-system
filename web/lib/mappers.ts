import type { Database } from "./supabase/database.types";
import type {
  Asset,
  AssetRole,
  ClientProfile,
  Frame,
  StoryPackage,
  CampaignObjective,
  OutputFormat,
  StoryType,
  PackageStatus,
} from "./types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type PackageRow = Database["public"]["Tables"]["packages"]["Row"];
type FrameRow = Database["public"]["Tables"]["frames"]["Row"];

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}

function looksLikeLogoAsset(row: AssetRow): boolean {
  const text = [
    row.role,
    row.file_name,
    row.storage_path,
    row.notes ?? "",
    row.extracted_text_preview ?? "",
  ].join(" ");
  return (
    /\[asset_type:logo\]/i.test(text) ||
    /(^|[\s._-])(logo|logotipo|logomarca|wordmark|s[íi]mbolo|[íi]cone|assinatura)([\s._-]|$)/i.test(text) ||
    /\b(png\s*transparente|sem\s*fundo)\b/i.test(text)
  );
}

export function mapClient(row: ClientRow): ClientProfile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city ?? "",
    neighborhood: row.neighborhood ?? "",
    tone: row.tone ?? "",
    color_palette: row.color_palette ?? [],
    typography: row.typography ?? [],
    instagram: row.instagram ?? "",
    notes: row.notes ?? "",
    manual_status: row.manual_status ?? "",
    synthetic_manual: row.synthetic_manual ?? "",
    media_source_url: row.media_source_url ?? "",
    brand_manual_summary: row.brand_manual_summary ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapAsset(row: AssetRow): Asset {
  const notes = row.notes ?? null;
  const role = row.role === "logo" || (row.role === "media" && looksLikeLogoAsset(row))
    ? "logo"
    : row.role;
  return {
    id: row.id,
    client_id: row.client_id,
    role: role as AssetRole,
    file_name: row.file_name,
    mime_type: row.mime_type,
    storage_path: row.storage_path,
    public_url: row.public_url,
    size_bytes: row.size_bytes ?? 0,
    source: (row.source as Asset["source"]) ?? "upload",
    notes,
    detected_colors: asStringArray(row.detected_colors),
    detected_typography: asStringArray(row.detected_typography),
    detected_tone: row.detected_tone,
    extracted_text_preview: row.extracted_text_preview,
    created_at: row.created_at,
  };
}

export function mapFrame(row: FrameRow): Frame {
  return {
    id: row.id,
    idx: row.idx,
    headline: row.headline ?? "",
    body: row.body ?? "",
    cta: row.cta ?? "",
    visual_direction: row.visual_direction ?? "",
    layout_style: row.layout_style ?? "editorial",
    media_asset_id: row.media_asset_id,
    ai_asset_id: row.ai_asset_id,
    refs: asStringArray(row.refs),
  };
}

export function mapPackage(row: PackageRow, frames: FrameRow[] = []): StoryPackage {
  return {
    id: row.id,
    client_id: row.client_id,
    status: row.status as PackageStatus,
    objective: row.objective as CampaignObjective,
    story_type: row.story_type as StoryType,
    output_format: row.output_format as OutputFormat,
    frames_count: row.frames_count,
    offer: row.offer ?? "",
    cta: row.cta ?? "",
    rationale: row.rationale ?? "",
    brand_score: row.brand_score,
    performance_score: row.performance_score,
    cost_brl: row.cost_brl,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
    frames: frames.sort((a, b) => a.idx - b.idx).map(mapFrame),
  };
}

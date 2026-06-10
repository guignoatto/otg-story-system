import "server-only";
import { supabaseAdmin } from "../supabase/server";
import { mapPackage } from "../mappers";
import type { Database } from "../supabase/database.types";
import type { Frame, StoryPackage, UsageSummary } from "../types";

type FrameRow = Database["public"]["Tables"]["frames"]["Row"];

export async function getPackage(id: string): Promise<StoryPackage | null> {
  const supabase = supabaseAdmin();
  const { data: pkg, error } = await supabase
    .from("packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pkg) return null;
  const { data: frames, error: framesError } = await supabase
    .from("frames")
    .select("*")
    .eq("package_id", id);
  if (framesError) throw new Error(framesError.message);
  return mapPackage(pkg, frames ?? []);
}

export async function listClientPackages(clientId: string): Promise<StoryPackage[]> {
  const supabase = supabaseAdmin();
  const { data: pkgs, error } = await supabase
    .from("packages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!pkgs?.length) return [];

  const ids = pkgs.map((p) => p.id);
  const { data: frames, error: framesError } = await supabase
    .from("frames")
    .select("*")
    .in("package_id", ids);
  if (framesError) throw new Error(framesError.message);

  const byPackage = new Map<string, FrameRow[]>();
  for (const f of frames ?? []) {
    const list = byPackage.get(f.package_id) ?? [];
    list.push(f);
    byPackage.set(f.package_id, list);
  }
  return pkgs.map((p) => mapPackage(p, byPackage.get(p.id) ?? []));
}

export async function clientUsage(clientId: string): Promise<UsageSummary> {
  const { data, error } = await supabaseAdmin()
    .from("packages")
    .select("status, cost_brl")
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const completed = rows.filter((r) => r.status === "completed");
  return {
    client_id: clientId,
    total_packages: rows.length,
    completed_packages: completed.length,
    estimated_total_cost_brl: Number(
      completed.reduce((sum, r) => sum + Number(r.cost_brl || 0), 0).toFixed(2)
    ),
  };
}

export type NewFrame = Omit<Frame, "id"> & { media_asset_id: string | null; ai_asset_id: string | null };

export async function insertPackageWithFrames(params: {
  client_id: string;
  objective: string;
  story_type: string;
  output_format: string;
  frames_count: number;
  offer: string;
  cta: string;
  rationale: string;
  brand_score: number | null;
  performance_score: number | null;
  cost_brl: number;
  brief: unknown;
  frames: NewFrame[];
}): Promise<StoryPackage> {
  const supabase = supabaseAdmin();
  const { data: pkg, error } = await supabase
    .from("packages")
    .insert({
      client_id: params.client_id,
      status: "completed",
      objective: params.objective,
      story_type: params.story_type,
      output_format: params.output_format,
      frames_count: params.frames_count,
      offer: params.offer,
      cta: params.cta,
      rationale: params.rationale,
      brand_score: params.brand_score,
      performance_score: params.performance_score,
      cost_brl: params.cost_brl,
      brief: params.brief as never,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const frameRows = params.frames.map((f) => ({
    package_id: pkg.id,
    idx: f.idx,
    headline: f.headline,
    body: f.body,
    cta: f.cta,
    visual_direction: f.visual_direction,
    layout_style: f.layout_style,
    media_asset_id: f.media_asset_id,
    ai_asset_id: f.ai_asset_id,
    refs: f.refs as never,
  }));
  const { data: frames, error: framesError } = await supabase
    .from("frames")
    .insert(frameRows)
    .select("*");
  if (framesError) throw new Error(framesError.message);

  return mapPackage(pkg, frames ?? []);
}

export async function updateFrameAiAsset(frameId: string, aiAssetId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("frames")
    .update({ ai_asset_id: aiAssetId })
    .eq("id", frameId);
  if (error) throw new Error(error.message);
}

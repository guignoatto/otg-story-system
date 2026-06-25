import "server-only";
import { supabaseAdmin } from "../supabase/server";
import { mapAsset } from "../mappers";
import {
  buildClientLearningMemory,
  parseAssetFeedback,
  withAssetFeedback,
  type AssetFeedback,
  type ClientLearningMemory,
  type CreativeFeedbackStatus,
} from "../feedback";
import type { Asset } from "../types";
import type { Database } from "../supabase/database.types";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type FrameRow = Database["public"]["Tables"]["frames"]["Row"];

export type ClientReference = {
  asset: Asset;
  feedback: AssetFeedback;
};

function readRefs(frame: FrameRow): string[] {
  return Array.isArray(frame.refs) ? frame.refs.map((item) => String(item)) : [];
}

function writeFeedbackRefs(refs: string[], status: CreativeFeedbackStatus, reason: string): string[] {
  const clean = refs.filter((ref) => !ref.startsWith("feedback:") && !ref.startsWith("feedback_reason:"));
  return [...clean, `feedback:${status}`, `feedback_reason:${reason}`];
}

export async function updateFrameCreativeFeedback(params: {
  frameId: string;
  status: CreativeFeedbackStatus;
  reason: string;
  comment?: string;
}): Promise<ClientReference> {
  const supabase = supabaseAdmin();
  const { data: frame, error: frameError } = await supabase
    .from("frames")
    .select("*")
    .eq("id", params.frameId)
    .maybeSingle();
  if (frameError) throw new Error(frameError.message);
  if (!frame) throw new Error("Frame não encontrado.");
  if (!frame.ai_asset_id) throw new Error("Gere a imagem com IA antes de aprovar ou reprovar.");

  const { data: assetRow, error: assetError } = await supabase
    .from("assets")
    .select("*")
    .eq("id", frame.ai_asset_id)
    .maybeSingle();
  if (assetError) throw new Error(assetError.message);
  if (!assetRow) throw new Error("Imagem gerada não encontrada na biblioteca.");

  const feedback = {
    status: params.status,
    reason: params.reason,
    comment: params.comment ?? "",
    frame_id: frame.id,
    package_id: frame.package_id,
    updated_at: new Date().toISOString(),
  } satisfies AssetFeedback;

  const notes = withAssetFeedback(assetRow.notes, feedback);
  const { data: updatedAsset, error: updateAssetError } = await supabase
    .from("assets")
    .update({ notes })
    .eq("id", assetRow.id)
    .select("*")
    .single();
  if (updateAssetError) throw new Error(updateAssetError.message);

  const refs = writeFeedbackRefs(readRefs(frame), params.status, params.reason);
  const { error: frameUpdateError } = await supabase
    .from("frames")
    .update({ refs: refs as never })
    .eq("id", frame.id);
  if (frameUpdateError) throw new Error(frameUpdateError.message);

  return { asset: mapAsset(updatedAsset as AssetRow), feedback };
}

export async function listClientReferences(clientId: string): Promise<ClientReference[]> {
  const { data, error } = await supabaseAdmin()
    .from("assets")
    .select("*")
    .eq("client_id", clientId)
    .eq("source", "ai")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => mapAsset(row as AssetRow))
    .map((asset) => {
      const feedback = parseAssetFeedback(asset.notes);
      return feedback ? { asset, feedback } : null;
    })
    .filter((item): item is ClientReference => Boolean(item));
}

export async function getClientLearningMemory(clientId: string): Promise<ClientLearningMemory> {
  const { data, error } = await supabaseAdmin()
    .from("assets")
    .select("*")
    .eq("client_id", clientId)
    .eq("source", "ai")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return buildClientLearningMemory((data ?? []).map((row) => mapAsset(row as AssetRow)));
}

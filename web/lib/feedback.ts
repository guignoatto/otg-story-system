import type { Asset } from "./types";

export type CreativeFeedbackStatus = "approved" | "rejected";

export type AssetFeedback = {
  status: CreativeFeedbackStatus;
  reason: string;
  comment: string;
  frame_id?: string;
  package_id?: string;
  updated_at: string;
};

export type ReferenceMemoryItem = {
  asset_id: string;
  file_name: string;
  public_url: string | null;
  reason: string;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type ClientLearningMemory = {
  approved: ReferenceMemoryItem[];
  rejected: ReferenceMemoryItem[];
  approval_patterns: string[];
  rejection_patterns: string[];
};

const FEEDBACK_MARKER = /\n?\[otg_feedback:([^\]]+)\]/g;
const MAX_TEXT = 280;

function cleanText(value: string | null | undefined, fallback = ""): string {
  return String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function stripAssetFeedback(notes: string | null | undefined): string {
  return String(notes ?? "").replace(FEEDBACK_MARKER, "").trim();
}

export function parseAssetFeedback(notes: string | null | undefined): AssetFeedback | null {
  const text = String(notes ?? "");
  const matches = [...text.matchAll(FEEDBACK_MARKER)];
  const latest = matches.at(-1)?.[1];
  if (!latest) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(latest)) as Partial<AssetFeedback>;
    if (parsed.status !== "approved" && parsed.status !== "rejected") return null;
    return {
      status: parsed.status,
      reason: cleanText(parsed.reason, parsed.status === "approved" ? "Referência aprovada." : "Referência reprovada."),
      comment: cleanText(parsed.comment),
      frame_id: parsed.frame_id ? cleanText(parsed.frame_id) : undefined,
      package_id: parsed.package_id ? cleanText(parsed.package_id) : undefined,
      updated_at: parsed.updated_at ? cleanText(parsed.updated_at) : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function withAssetFeedback(
  notes: string | null | undefined,
  feedback: Omit<AssetFeedback, "updated_at"> & { updated_at?: string }
): string {
  const cleanNotes = stripAssetFeedback(notes);
  const payload: AssetFeedback = {
    status: feedback.status,
    reason: cleanText(feedback.reason, feedback.status === "approved" ? "Boa referência para repetir." : "Evitar repetir este padrão."),
    comment: cleanText(feedback.comment),
    frame_id: feedback.frame_id,
    package_id: feedback.package_id,
    updated_at: feedback.updated_at ?? new Date().toISOString(),
  };
  const marker = `[otg_feedback:${encodeURIComponent(JSON.stringify(payload))}]`;
  return [cleanNotes, marker].filter(Boolean).join("\n");
}

export function referenceFromAsset(asset: Asset): { asset: Asset; feedback: AssetFeedback } | null {
  const feedback = parseAssetFeedback(asset.notes);
  if (!feedback) return null;
  return { asset, feedback };
}

export function buildClientLearningMemory(assets: Asset[]): ClientLearningMemory {
  const references = assets
    .map(referenceFromAsset)
    .filter((item): item is { asset: Asset; feedback: AssetFeedback } => Boolean(item));

  const approved = references
    .filter((item) => item.feedback.status === "approved")
    .slice(0, 8)
    .map(({ asset, feedback }) => ({
      asset_id: asset.id,
      file_name: asset.file_name,
      public_url: asset.public_url,
      reason: feedback.reason,
      comment: feedback.comment,
      created_at: asset.created_at,
      updated_at: feedback.updated_at,
    }));

  const rejected = references
    .filter((item) => item.feedback.status === "rejected")
    .slice(0, 10)
    .map(({ asset, feedback }) => ({
      asset_id: asset.id,
      file_name: asset.file_name,
      public_url: asset.public_url,
      reason: feedback.reason,
      comment: feedback.comment,
      created_at: asset.created_at,
      updated_at: feedback.updated_at,
    }));

  return {
    approved,
    rejected,
    approval_patterns: uniq(approved.flatMap((item) => [item.reason, item.comment].filter(Boolean))).slice(0, 8),
    rejection_patterns: uniq(rejected.flatMap((item) => [item.reason, item.comment].filter(Boolean))).slice(0, 10),
  };
}

export function formatClientMemoryForPrompt(memory: ClientLearningMemory | null | undefined): string {
  if (!memory || (!memory.approval_patterns.length && !memory.rejection_patterns.length)) return "";
  const approved = memory.approval_patterns.length
    ? `Repetir quando fizer sentido: ${memory.approval_patterns.join("; ")}.`
    : "";
  const rejected = memory.rejection_patterns.length
    ? `Evitar com prioridade: ${memory.rejection_patterns.join("; ")}.`
    : "";
  return [
    "MEMÓRIA DO CLIENTE APRENDIDA COM APROVAÇÕES/REPROVAÇÕES DA OTG:",
    approved,
    rejected,
    "Use esta memória como critério criativo, sem copiar literalmente textos antigos.",
  ].filter(Boolean).join("\n");
}

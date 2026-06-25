"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GenerationProgress } from "./GenerationProgress";
import { isGeneratableMediaAsset, isProbablyLogoAsset, uniqueAssetsById } from "@/lib/asset-classification";
import type {
  Asset,
  CampaignObjective,
  ClientProfile,
  Frame,
  MediaInsight,
  OutputFormat,
  StoryPackage,
  StoryType,
  UsageSummary,
} from "@/lib/types";

type Props = { clients: ClientProfile[] };

type Brief = {
  objective: CampaignObjective;
  story_type: StoryType;
  output_format: OutputFormat;
  frames: number;
  offer: string;
  cta: string;
};

type FrameGenerationError = {
  detail: string;
  issues: string[];
  issue_codes: string[];
  remediation_steps: string[];
  preflight_notes: string[];
  notes?: string;
  attempts?: number;
};

type LogoPolicy = "none" | "discreet" | "required" | "source_only";

type ReferenceItem = {
  asset: Asset;
  feedback: {
    status: "approved" | "rejected";
    reason: string;
    comment: string;
    updated_at: string;
  };
};

type ReferencesState = {
  approved: ReferenceItem[];
  rejected: ReferenceItem[];
};

type FeedbackNotice = {
  kind: "success" | "warning" | "error";
  title: string;
  body: string;
};

const DEFAULT_BRIEF: Brief = {
  objective: "vendas",
  story_type: "promocao",
  output_format: "stories",
  frames: 4,
  offer: "",
  cta: "",
};

const MAX_SELECTED_MEDIA = 24;
const WEEKLY_STORY_COUNT = 21;
const WEEKLY_AUTOPILOT_BRIEF: Brief = {
  objective: "relacionamento",
  story_type: "cardapio",
  output_format: "stories",
  frames: WEEKLY_STORY_COUNT,
  offer: "Piloto automático semanal: a IA define temas, produtos e ângulos com base nas fotos, manual, operação e memória do cliente.",
  cta: "A IA define uma chamada orgânica por story, sem WhatsApp, salvar, enquete, botão falso ou linguagem de anúncio.",
};

function refValue(frame: Frame, prefix: string): string {
  const raw = frame.refs.find((ref) => ref.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : "";
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function mediaKind(asset: Asset, insight?: MediaInsight): string {
  const text = [
    asset.file_name,
    asset.notes ?? "",
    asset.extracted_text_preview ?? "",
    insight?.visual_description ?? "",
    insight?.mood ?? "",
    (insight?.avoid_for ?? []).join(" "),
    (insight?.best_for ?? []).join(" "),
  ].join(" ").toLowerCase();

  const hasMainDish = /\b(prato|refei[cç][aã]o|marmita|marmitex|pf|frango|galeto|carne|picanha|churrasco|costela|pizza|massa|lasanha|hamb[uú]rguer|sandu[ií]che|combo)\b/i.test(text);
  const hasSauceOnlyCue = /\b(molho|molhos|sauce|condimento|maionese|ketchup|barbecue|creme|dip|molheira|pote de molho|cumbuca de molho)\b/i.test(text);

  const rules: Array<[RegExp, string]> = [
    [/\b(pizza|pizzaria|queijo|calabresa|mussarela|pepperoni)\b/i, "pizza"],
    [/\b(frango|galeto|coxa|sobrecoxa|asa|marmitex)\b/i, "frango"],
    [/\b(carne|picanha|churrasco|costela|bife|entrecot|grelhado|brasa)\b/i, "carne"],
    [/\b(massa|macarr[aã]o|lasanha|ravioli|nhoque|spaghetti|talharim)\b/i, "massas"],
    [/\b(sobremesa|doce|torta|pudim|chocolate|sorvete)\b/i, "sobremesas"],
    [/\b(ambiente|sal[aã]o|mesa posta|fachada|equipe|pessoa|cliente|cozinha)\b/i, "ambiente"],
    [/\b(delivery|embalagem|caixa|sacola|pedido|takeaway)\b/i, "delivery"],
    [/\b(salada|arroz|feij[aã]o|batata|farofa|acompanhamento|guarni[cç][aã]o)\b/i, "acompanhamentos"],
    [/\b(refrigerante|bebida|lata|coca|sprite|fanta|cerveja|chopp|suco|drink)\b/i, "bebidas"],
  ];

  if (hasSauceOnlyCue && !hasMainDish) return "molhos";
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? "prato principal";
}

function mediaScore(asset: Asset, insight: MediaInsight | undefined, objective: CampaignObjective): number {
  const kind = mediaKind(asset, insight);
  const avoid = insight?.avoid_for ?? [];
  const bestFor = insight?.best_for ?? [];
  let score = insight?.quality_score ?? 5;
  if (bestFor.includes(objective)) score += 2;
  if (bestFor.includes("vendas")) score += 0.5;
  if (avoid.some((flag) => ["ai_generation", "hero", objective].includes(flag))) score -= 5;
  if (avoid.some((flag) => ["secondary_subject", "repetitive_sauce"].includes(flag))) score -= 2.5;
  if (kind === "molhos") score -= 3;
  if (kind === "acompanhamentos") score -= 1.5;
  if (kind === "prato principal") score += 1.5;
  return score;
}

function selectDiverseMedia(
  assets: Asset[],
  insightsById: Record<string, MediaInsight>,
  objective: CampaignObjective,
  target: number
): Asset[] {
  const scored = assets
    .map((asset) => ({
      asset,
      kind: mediaKind(asset, insightsById[asset.id]),
      score: mediaScore(asset, insightsById[asset.id], objective),
    }))
    .sort((a, b) => b.score - a.score);

  const buckets = new Map<string, typeof scored>();
  for (const item of scored) {
    const bucket = buckets.get(item.kind) ?? [];
    bucket.push(item);
    buckets.set(item.kind, bucket);
  }

  const selected: typeof scored = [];
  const countByKind = new Map<string, number>();
  const maxByKind = (kind: string): number => {
    if (kind === "molhos") return target >= 18 ? 2 : 1;
    if (kind === "acompanhamentos" || kind === "bebidas") return 2;
    if (kind === "ambiente") return target >= 12 ? 3 : 2;
    return Math.max(3, Math.ceil(target / 4));
  };

  const bucketOrder = [...buckets.entries()]
    .sort(([, a], [, b]) => (b[0]?.score ?? 0) - (a[0]?.score ?? 0))
    .map(([kind]) => kind);

  let changed = true;
  while (selected.length < target && changed) {
    changed = false;
    for (const kind of bucketOrder) {
      const used = countByKind.get(kind) ?? 0;
      if (used >= maxByKind(kind)) continue;
      const next = buckets.get(kind)?.shift();
      if (!next) continue;
      selected.push(next);
      countByKind.set(kind, used + 1);
      changed = true;
      if (selected.length >= target) break;
    }
  }

  if (selected.length < target) {
    const selectedIds = new Set(selected.map((item) => item.asset.id));
    selected.push(...scored.filter((item) => !selectedIds.has(item.asset.id)).slice(0, target - selected.length));
  }

  return selected.slice(0, target).map((item) => item.asset);
}

function mediaSelectionTarget(brief: Brief, weeklyMode: boolean): number {
  const target = weeklyMode ? WEEKLY_STORY_COUNT : Math.max(brief.frames, 8);
  return Math.min(MAX_SELECTED_MEDIA, target);
}

export function Studio({ clients }: Props) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [manualBrief, setManualBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [media, setMedia] = useState<Asset[]>([]);
  const [logos, setLogos] = useState<Asset[]>([]);
  const [mediaInsights, setMediaInsights] = useState<Record<string, MediaInsight>>({});
  const [curatingMedia, setCuratingMedia] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [weeklyMode, setWeeklyMode] = useState(false);
  const [pkg, setPkg] = useState<StoryPackage | null>(null);
  const [aiByFrame, setAiByFrame] = useState<Record<string, Asset>>({});
  const [generatingFrame, setGeneratingFrame] = useState<Record<string, boolean>>({});
  const [frameErrors, setFrameErrors] = useState<Record<string, FrameGenerationError>>({});
  const [feedbackByFrame, setFeedbackByFrame] = useState<Record<string, "approved" | "rejected">>({});
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});
  const [feedbackBusy, setFeedbackBusy] = useState<Record<string, boolean>>({});
  const [references, setReferences] = useState<ReferencesState>({ approved: [], rejected: [] });
  const [promptPreview, setPromptPreview] = useState<{
    frame: Frame;
    prompt: string;
    preflight_notes: string[];
    logo_policy: LogoPolicy;
  } | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [history, setHistory] = useState<StoryPackage[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Selecione um cliente e gere um pacote.");
  const [feedbackNotice, setFeedbackNotice] = useState<FeedbackNotice | null>(null);

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
  const selectedMedia = useMemo(
    () => media.filter((asset) => selectedMediaIds.includes(asset.id)),
    [media, selectedMediaIds]
  );

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    (async () => {
      try {
        const [mediaRes, logoRes, histRes, usageRes, refsRes] = await Promise.all([
          fetch(`/api/clients/${clientId}/assets?role=media`),
          fetch(`/api/clients/${clientId}/assets?role=logo`),
          fetch(`/api/clients/${clientId}/packages`),
          fetch(`/api/clients/${clientId}/usage`),
          fetch(`/api/clients/${clientId}/references`),
        ]);
        const mediaData = await mediaRes.json();
        const logoData = await logoRes.json();
        const histData = await histRes.json();
        const usageData = await usageRes.json();
        const refsData = await refsRes.json();
        if (!active) return;
        const imageAssets = (mediaData.items ?? []).filter((a: Asset) => a.mime_type.startsWith("image/"));
        const imageMedia = imageAssets.filter(isGeneratableMediaAsset);
        const inferredLogos = imageAssets.filter(isProbablyLogoAsset);
        const imageLogos = (logoData.items ?? []).filter((a: Asset) => a.mime_type.startsWith("image/"));
        setMedia(imageMedia);
        setLogos(uniqueAssetsById([...imageLogos, ...inferredLogos]));
        setSelectedMediaIds(
          imageMedia
            .slice(0, mediaSelectionTarget(DEFAULT_BRIEF, false))
            .map((a: Asset) => a.id)
        );
        setHistory(histData.items ?? []);
        setUsage(usageData);
        setReferences({
          approved: Array.isArray(refsData.approved) ? refsData.approved : [],
          rejected: Array.isArray(refsData.rejected) ? refsData.rejected : [],
        });
        setMediaInsights({});
        setPkg(null);
        setAiByFrame({});
        setFrameErrors({});
        setFeedbackByFrame({});
        setFeedbackNotes({});
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!feedbackNotice) return;
    const timeout = window.setTimeout(() => setFeedbackNotice(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [feedbackNotice]);

  function setBriefField<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMedia(assetId: string) {
    setSelectedMediaIds((prev) => {
      if (prev.includes(assetId)) return prev.filter((id) => id !== assetId);
      if (prev.length >= MAX_SELECTED_MEDIA) return prev;
      return [...prev, assetId];
    });
  }

  function selectSuggestedMedia() {
    const target = mediaSelectionTarget(brief, weeklyMode);
    const suggested = selectDiverseMedia(media, mediaInsights, brief.objective, target);
    setSelectedMediaIds(suggested.map((asset) => asset.id));
    setMessage(`Sugeri ${suggested.length} foto(s) com variedade de assuntos para esta leva.`);
  }

  function toggleWeeklyMode() {
    if (weeklyMode) {
      setWeeklyMode(false);
      setBrief(manualBrief);
      setMessage("Lote semanal desativado. Voltei para o briefing manual.");
      return;
    }

    setManualBrief(brief);
    setWeeklyMode(true);
    setBrief(WEEKLY_AUTOPILOT_BRIEF);
    if (media.length) {
      const suggested = selectDiverseMedia(
        media,
        mediaInsights,
        WEEKLY_AUTOPILOT_BRIEF.objective,
        mediaSelectionTarget(WEEKLY_AUTOPILOT_BRIEF, true)
      );
      setSelectedMediaIds(suggested.map((asset) => asset.id));
    }
    setMessage("Lote semanal no piloto automático: objetivo, formato, tipo, tema e chamadas serão decididos pelos agentes.");
  }

  async function curateMedia() {
    if (!client || !media.length) return;
    const scope = selectedMediaIds.length
      ? media.filter((asset) => selectedMediaIds.includes(asset.id))
      : media;
    if (!scope.length) return;
    setCuratingMedia(true);
    setMessage(`Curador analisando ${scope.length} foto(s) ${selectedMediaIds.length ? "selecionada(s)" : "da biblioteca"}...`);
    try {
      const res = await fetch(`/api/clients/${client.id}/media-curation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_ids: scope.map((asset) => asset.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      const insights = Array.isArray(data.insights) ? (data.insights as MediaInsight[]) : [];
      const nextInsights = {
        ...mediaInsights,
        ...Object.fromEntries(insights.map((insight) => [insight.asset_id, insight])),
      };
      setMediaInsights(nextInsights);
      if (insights.length) {
        const target = Math.min(scope.length, mediaSelectionTarget(brief, weeklyMode));
        const curated = selectDiverseMedia(scope, nextInsights, brief.objective, target);
        setSelectedMediaIds(curated.map((asset) => asset.id));
      }
      const analyzedCount = typeof data.analyzed_count === "number" ? data.analyzed_count : insights.length;
      setMessage(
        `Curador analisou ${analyzedCount} foto(s) e atualizou a seleção com variedade. Molhos, bebidas e acompanhamentos entram só como apoio.`
      );
    } catch (err) {
      setMessage(`Erro no curador de fotos: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCuratingMedia(false);
    }
  }

  async function generate() {
    if (!client) return;
    const activeBrief = weeklyMode ? WEEKLY_AUTOPILOT_BRIEF : brief;
    if (!weeklyMode && (!activeBrief.offer.trim() || !activeBrief.cta.trim())) {
      setMessage("Preencha tema/produto e a chamada orgânica.");
      return;
    }
    if (!selectedMediaIds.length) {
      setMessage("Selecione pelo menos uma imagem para gerar essa leva de stories.");
      return;
    }
    setBusy(true);
    setMessage("Os agentes estão montando o pacote...");
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          restaurant_name: client.name,
          ...activeBrief,
          frames: weeklyMode ? WEEKLY_STORY_COUNT : activeBrief.frames,
          weekly_batch: weeklyMode,
          media_asset_ids: selectedMediaIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      setPkg(data as StoryPackage);
      setAiByFrame({});
      setFrameErrors({});
      setFeedbackByFrame({});
      setFeedbackNotes({});
      setMessage(data.rationale || "Pacote gerado.");
      void refreshHistory();
    } catch (err) {
      setMessage(`Erro ao gerar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function refreshHistory() {
    if (!clientId) return;
    const [histRes, usageRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/packages`),
      fetch(`/api/clients/${clientId}/usage`),
    ]);
    setHistory((await histRes.json()).items ?? []);
    setUsage(await usageRes.json());
  }

  async function refreshReferences() {
    if (!clientId) return;
    const res = await fetch(`/api/clients/${clientId}/references`);
    const data = await res.json();
    if (!res.ok) return;
    setReferences({
      approved: Array.isArray(data.approved) ? data.approved : [],
      rejected: Array.isArray(data.rejected) ? data.rejected : [],
    });
  }

  async function submitFeedback(frame: Frame, status: "approved" | "rejected") {
    if (!aiByFrame[frame.id]) {
      setMessage("Gere a imagem com IA antes de aprovar ou reprovar.");
      return;
    }
    const note = feedbackNotes[frame.id]?.trim();
    const reason = note || (status === "approved"
      ? "Boa referência visual para este cliente."
      : "Reprovada pela OTG; evitar repetir este padrão.");

    setFeedbackBusy((cur) => ({ ...cur, [frame.id]: true }));
    try {
      const res = await fetch(`/api/frames/${frame.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      setFeedbackByFrame((cur) => ({ ...cur, [frame.id]: status }));
      const successMessage = status === "approved"
        ? "Referência aprovada e salva na memória do cliente."
        : "Reprovação salva. Os agentes vão evitar esse padrão nas próximas gerações.";
      setMessage(successMessage);
      setFeedbackNotice({
        kind: status === "approved" ? "success" : "warning",
        title: status === "approved" ? "Referência aprovada" : "Referência reprovada",
        body: status === "approved"
          ? "Recebido. Esta arte entrou na biblioteca de referências aprovadas e vai orientar as próximas gerações."
          : "Recebido. Esse padrão foi salvo como reprovação e passa a ser evitado pelos agentes.",
      });
      void refreshReferences();
    } catch (err) {
      const errorMessage = `Erro ao salvar feedback: ${err instanceof Error ? err.message : String(err)}`;
      setMessage(errorMessage);
      setFeedbackNotice({
        kind: "error",
        title: "Feedback não foi salvo",
        body: errorMessage,
      });
    } finally {
      setFeedbackBusy((cur) => ({ ...cur, [frame.id]: false }));
    }
  }

  function mediaFor(frame: Frame): Asset | undefined {
    if (frame.media_asset_id) return media.find((m) => m.id === frame.media_asset_id);
    return undefined;
  }

  function imageUrlFor(frame: Frame): string {
    const ai = aiByFrame[frame.id];
    if (ai?.public_url) return ai.public_url;
    return mediaFor(frame)?.public_url ?? "";
  }

  async function downloadAiImage(frame: Frame) {
    const asset = aiByFrame[frame.id];
    if (!asset?.public_url) return;
    try {
      const res = await fetch(asset.public_url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${client?.slug ?? "frame"}-${frame.idx}-ai.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(asset.public_url, "_blank");
    }
  }

  // Busca o prompt completo montado no servidor e abre o modal de revisão.
  async function openPromptPreview(frame: Frame) {
    if (!client) return;
    const source = mediaFor(frame);
    if (!source) {
      setMessage("Esse frame não tem uma mídia real associada na biblioteca.");
      return;
    }
    setLoadingPrompt(true);
    try {
      const res = await fetch("/api/ai-images/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          headline: frame.headline,
          body: frame.body,
          cta: frame.cta,
          visual_direction: frame.visual_direction,
          layout_style: frame.layout_style,
          output_format: pkg?.output_format || "stories",
          objective: pkg?.objective,
          story_type: pkg?.story_type,
          offer: pkg?.offer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      setPromptPreview({
        frame,
        prompt: data.prompt,
        preflight_notes: Array.isArray(data.preflight_notes) ? data.preflight_notes : [],
        logo_policy: "discreet",
      });
    } catch (err) {
      setMessage(`Erro ao montar prompt: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function generateAi(frame: Frame, promptOverride?: string, logoPolicy: LogoPolicy = "discreet") {
    if (!client) return;
    const source = mediaFor(frame);
    if (!source) {
      setMessage("Esse frame não tem uma mídia real associada na biblioteca.");
      return;
    }
    setGeneratingFrame((cur) => ({ ...cur, [frame.id]: true }));
    setFrameErrors((cur) => {
      const next = { ...cur };
      delete next[frame.id];
      return next;
    });
    setMessage("Gerando imagem com IA e validando com o guardião visual...");
    try {
      const res = await fetch("/api/ai-images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          source_asset_id: source.id,
          frame_id: frame.id,
          headline: frame.headline,
          body: frame.body,
          cta: frame.cta,
          visual_direction: frame.visual_direction,
          layout_style: frame.layout_style,
          output_format: pkg?.output_format || "stories",
          objective: pkg?.objective,
          story_type: pkg?.story_type,
          offer: pkg?.offer,
          quality: "medium",
          prompt_override: promptOverride,
          logo_policy: logoPolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = Array.isArray(data.image_qa?.issues) ? data.image_qa.issues : [];
        const issueCodes = Array.isArray(data.image_qa?.issue_codes) ? data.image_qa.issue_codes : [];
        const remediationSteps = Array.isArray(data.remediation_steps)
          ? data.remediation_steps
          : Array.isArray(data.image_qa?.remediation_steps)
            ? data.image_qa.remediation_steps
            : [];
        const preflightNotes = Array.isArray(data.preflight_notes) ? data.preflight_notes : [];
        const detail = data.detail || `Erro ${res.status}`;
        setFrameErrors((cur) => ({
          ...cur,
          [frame.id]: {
            detail,
            issues,
            issue_codes: issueCodes,
            remediation_steps: remediationSteps,
            preflight_notes: preflightNotes,
            notes: data.image_qa?.notes,
            attempts: data.attempts,
          },
        }));
        setMessage(
          res.status === 422
            ? data.attempts === 0
              ? "A foto de origem foi barrada pelo guardião preventivo. Veja o plano no frame."
              : "A imagem foi gerada, mas o guardião visual reprovou. Veja os motivos no frame."
            : `Erro ao gerar com IA: ${detail}`
        );
        return;
      }
      setAiByFrame((cur) => ({ ...cur, [frame.id]: data.asset as Asset }));
      setMessage("Imagem com IA gerada e aprovada pelo guardião visual.");
    } catch (err) {
      setMessage(`Erro ao gerar com IA: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGeneratingFrame((cur) => ({ ...cur, [frame.id]: false }));
    }
  }

  return (
    <main className="app-shell">
      {feedbackNotice && (
        <div className={`feedback-notice ${feedbackNotice.kind}`} role="status" aria-live="polite">
          <div>
            <strong>{feedbackNotice.title}</strong>
            <span>{feedbackNotice.body}</span>
          </div>
          <button type="button" className="feedback-notice-close" onClick={() => setFeedbackNotice(null)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}
      <section className="content-grid">
        {/* Painel de briefing */}
        <section className="panel control-panel">
          <div className="section-heading">
            <span className="section-number">01</span>
            <div>
              <h2>Briefing de criação</h2>
              <p>Escolha o cliente e o objetivo. Mídias e manual vêm do cadastro do cliente.</p>
            </div>
          </div>

          <div className="brief-form">
            <article className="form-card spotlight-card">
              <label className="field-control">
                Cliente
                <select value={clientId} disabled={busy} onChange={(e) => setClientId(e.target.value)}>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            <div className="upload-status">
                {selectedMedia.length} de {media.length} foto(s) gerável(is) selecionada(s) ·{" "}
                {logos.length} logo(s) ·{" "}
                {client && <Link href={`/clientes/${client.id}`}>gerenciar cliente</Link>}
              </div>
            </article>

            <article className="form-card">
              <div className="card-title">
                <div>
                  <span>Imagens da leva</span>
                  <small>Escolha até {MAX_SELECTED_MEDIA} fotos. O curador equilibra pratos, ambiente, delivery e apoios.</small>
                </div>
                <div className="inline-actions">
                  <button type="button" className="ghost compact-action" disabled={busy || curatingMedia || !media.length} onClick={() => void curateMedia()}>
                    {curatingMedia ? "Curando..." : selectedMediaIds.length ? "Curar seleção" : "Curar biblioteca"}
                  </button>
                  <button type="button" className="ghost compact-action" disabled={busy || !media.length} onClick={selectSuggestedMedia}>
                    Sugerir variedade
                  </button>
                </div>
              </div>

              {media.length ? (
                <div className="media-picker">
                  {media.map((asset) => {
                    const checked = selectedMediaIds.includes(asset.id);
                    const disabled = busy || (!checked && selectedMediaIds.length >= MAX_SELECTED_MEDIA);
                    const insight = mediaInsights[asset.id];
                    return (
                      <label key={asset.id} className={`media-option${checked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleMedia(asset.id)}
                        />
                        <span
                          className="media-option-thumb"
                          style={asset.public_url ? { backgroundImage: `url(${asset.public_url})` } : undefined}
                        >
                          {!asset.public_url && "IMG"}
                        </span>
                        <span className="media-option-name">{asset.file_name}</span>
                        {insight && (
                          <span className="media-insight">
                            Nota {Math.round(insight.quality_score)}/10
                            {` · ${mediaKind(asset, insight)}`}
                            {(insight.avoid_for ?? []).length ? ` · evitar: ${(insight.avoid_for ?? []).slice(0, 2).join(", ")}` : ""}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-media-picker">
                  Nenhuma foto gerável cadastrada para este cliente. Logos, cardápios e artes prontas ficam fora da sugestão.
                </div>
              )}
            </article>

            <article className="form-card">
              <div className="card-title">
                <div>
                  <span>Campanha</span>
                  <small>O que os stories precisam causar</small>
                </div>
              </div>
              <div className={`mode-callout${weeklyMode ? " is-active" : ""}`}>
                <div>
                  <strong>Lote semanal</strong>
                  <span>
                    Gera 21 stories: 7 dias com 3 stories por dia. Ao ativar, os agentes decidem objetivo, tema, tipo e chamadas.
                  </span>
                </div>
                <button
                  type="button"
                  className={weeklyMode ? "approve compact-action" : "ghost compact-action"}
                  disabled={busy}
                  onClick={toggleWeeklyMode}
                >
                  {weeklyMode ? "Ativo" : "Ativar"}
                </button>
              </div>
              {weeklyMode && (
                <div className="weekly-autopilot">
                  <strong>Piloto automático ligado</strong>
                  <span>
                    O sistema vai montar uma semana real de conteúdo orgânico: 3 stories por dia, formato sempre Stories,
                    variação de pilares editoriais e chamadas adequadas para cada frame.
                  </span>
                </div>
              )}
              <div className="two-columns">
                <label className={`field-control${weeklyMode ? " is-disabled" : ""}`}>
                  Objetivo
                  <select value={brief.objective} disabled={busy || weeklyMode} onChange={(e) => setBriefField("objective", e.target.value as CampaignObjective)}>
                    <option value="vendas">Vendas orgânicas</option>
                    <option value="reservas">Ocasião planejada</option>
                    <option value="engajamento">Engajamento</option>
                    <option value="awareness">Awareness</option>
                    <option value="alcance_local">Alcance local</option>
                    <option value="relacionamento">Relacionamento</option>
                  </select>
                </label>
                <label className={`field-control${weeklyMode ? " is-disabled" : ""}`}>
                  Formato
                  <select value={brief.output_format} disabled={busy || weeklyMode} onChange={(e) => setBriefField("output_format", e.target.value as OutputFormat)}>
                    <option value="stories">Stories</option>
                    <option value="carrossel">Carrossel</option>
                  </select>
                </label>
              </div>
              <div className="two-columns">
                <label className={`field-control${weeklyMode ? " is-disabled" : ""}`}>
                  Tipo de conteúdo
                  <select value={brief.story_type} disabled={busy || weeklyMode} onChange={(e) => setBriefField("story_type", e.target.value as StoryType)}>
                    <option value="promocao">Destaque do dia</option>
                    <option value="bastidor">Bastidor</option>
                    <option value="prova_social">Prova social</option>
                    <option value="cardapio">{weeklyMode ? "Mix semanal automático" : "Cardápio"}</option>
                    <option value="urgencia">Lembrete</option>
                  </select>
                </label>
                <label className="field-control">
                  Telas
                  <input
                    type="number"
                    min={3}
                    max={weeklyMode ? WEEKLY_STORY_COUNT : 10}
                    value={brief.frames}
                    disabled={busy || weeklyMode}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isNaN(value)) return;
                      setBriefField("frames", Math.max(3, Math.min(10, Math.trunc(value))));
                    }}
                  />
                </label>
              </div>
              <label className={`field-control${weeklyMode ? " is-disabled" : ""}`}>
                Tema ou produto
                <input value={brief.offer} disabled={busy || weeklyMode} onChange={(e) => setBriefField("offer", e.target.value)} />
              </label>
              <label className={`field-control${weeklyMode ? " is-disabled" : ""}`}>
                Chamada orgânica
                <input value={brief.cta} disabled={busy || weeklyMode} onChange={(e) => setBriefField("cta", e.target.value)} />
              </label>
            </article>

            <button type="button" className="primary-action" disabled={busy || !client || !selectedMediaIds.length} onClick={() => void generate()}>
              {busy ? "Produzindo..." : weeklyMode ? "Gerar semana com 21 stories" : "Gerar pacote de stories"}
            </button>
          </div>
        </section>

        {/* Painel de resultado */}
        <section className="panel result-panel">
          <div className="result-heading">
            <div>
              <h2>Mesa de aprovação</h2>
              <p>{message}</p>
            </div>
            {usage && (
              <div className="meta-box" style={{ margin: 0 }}>
                {usage.total_packages} pacote(s) · R$ {usage.estimated_total_cost_brl.toFixed(2)}
              </div>
            )}
          </div>

          <GenerationProgress busy={busy} />

          {!pkg && !busy && (
            <div className="empty-state">
              <strong>Nenhum pacote gerado ainda.</strong>
              <span>Escolha o cliente, confirme o briefing e clique em gerar.</span>
            </div>
          )}

          {pkg && (
            <>
              <div className="job-summary">
                <div><span>Cliente</span><strong>{client?.name}</strong></div>
                <div><span>Objetivo</span><strong>{pkg.objective}</strong></div>
                <div><span>Custo</span><strong>R$ {pkg.cost_brl.toFixed(2)}</strong></div>
                <div><span>Scores</span><strong>{pkg.brand_score ?? "-"} / {pkg.performance_score ?? "-"}</strong></div>
              </div>
              {pkg.rationale && <p className="rationale">{pkg.rationale}</p>}

              <div className="frames">
                {pkg.frames.map((frame) => {
                  const url = imageUrlFor(frame);
                  const isGenerating = !!generatingFrame[frame.id];
                  const frameError = frameErrors[frame.id];
                  const weeklyDay = refValue(frame, "dia:");
                  const weeklySlot = refValue(frame, "story:");
                  const contentPillar = refValue(frame, "pilar:");
                  const contentGoal = refValue(frame, "proposta:");
                  return (
                    <div key={frame.id} className="frame">
                      <div className="frame-header">
                        <h4>{weeklyDay ? `${titleCase(weeklyDay)} · ${weeklySlot || `Story ${frame.idx}`}` : `Frame ${frame.idx}`}</h4>
                        {frameError && <span className="status-pill warning">Reprovada</span>}
                        {aiByFrame[frame.id] && <span className="status-pill">IA</span>}
                        {feedbackByFrame[frame.id] === "approved" && <span className="status-pill">Aprovada</span>}
                        {feedbackByFrame[frame.id] === "rejected" && <span className="status-pill warning">Feedback salvo</span>}
                      </div>
                      <div
                        className={`creative-preview ${frame.layout_style}`}
                        style={url ? { backgroundImage: `url(${url})` } : undefined}
                      >
                        {isGenerating ? (
                          <div className="frame-ai-loading">
                            <div className="frame-ai-spinner" />
                            <span>Gerando com IA...</span>
                          </div>
                        ) : (
                          <span>{frame.headline}</span>
                        )}
                      </div>
                      <div className="frame-copy">
                        {(contentPillar || contentGoal) && (
                          <div className="frame-ref-pills">
                            {contentPillar && <span>{contentPillar}</span>}
                            {contentGoal && <span>{contentGoal}</span>}
                          </div>
                        )}
                        <p><strong>{frame.headline}</strong></p>
                        <p>{frame.body}</p>
                        <p><strong>Chamada:</strong> {frame.cta}</p>
                        <p><strong>Visual:</strong> {frame.visual_direction}</p>
                      </div>
                      {frameError && (
                        <div className="frame-error">
                          <strong>
                            {frameError.attempts === 0
                              ? "Guardião preventivo barrou a foto fonte"
                              : "Guardião visual barrou esta imagem"}
                          </strong>
                          {!!frameError.attempts && (
                            <small>Foram feitas {frameError.attempts} tentativa(s) com correção automática.</small>
                          )}
                          <p>{frameError.detail}</p>
                          {!!frameError.issue_codes.length && (
                            <div className="frame-error-codes">
                              {frameError.issue_codes.map((code) => (
                                <span key={code}>{code}</span>
                              ))}
                            </div>
                          )}
                          {!!frameError.issues.length && (
                            <ul aria-label="Motivos da reprovação">
                              {frameError.issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          )}
                          {!!frameError.remediation_steps.length && (
                            <div className="frame-error-plan">
                              <span>Plano de correção</span>
                              <ul>
                                {frameError.remediation_steps.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {!!frameError.preflight_notes.length && (
                            <div className="frame-error-plan">
                              <span>Sinal preventivo</span>
                              <ul>
                                {frameError.preflight_notes.map((note) => (
                                  <li key={note}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {frameError.notes && <small>{frameError.notes}</small>}
                        </div>
                      )}
                      <div className="frame-actions">
                        {aiByFrame[frame.id] ? (
                          <>
                            <button type="button" className="approve" onClick={() => void downloadAiImage(frame)}>
                              Baixar imagem
                            </button>
                            <button type="button" className="ghost" disabled={isGenerating || loadingPrompt} onClick={() => void openPromptPreview(frame)}>
                              Regenerar
                            </button>
                          </>
                        ) : (
                          <button type="button" className="ai-generate" disabled={isGenerating || busy || loadingPrompt || !mediaFor(frame)} onClick={() => void openPromptPreview(frame)}>
                            {isGenerating ? "Gerando..." : "Gerar com IA"}
                          </button>
                        )}
                      </div>
                      {aiByFrame[frame.id] && (
                        <div className="feedback-box">
                          <label>
                            Observação para a memória deste cliente
                            <textarea
                              value={feedbackNotes[frame.id] ?? ""}
                              disabled={!!feedbackBusy[frame.id]}
                              placeholder="Ex: ficou premium demais, CTA parece anúncio, composição boa para repetir..."
                              onChange={(e) => setFeedbackNotes((cur) => ({ ...cur, [frame.id]: e.target.value }))}
                            />
                          </label>
                          <div className="feedback-actions">
                            <button
                              type="button"
                              className="approve"
                              disabled={!!feedbackBusy[frame.id]}
                              onClick={() => void submitFeedback(frame, "approved")}
                            >
                              Aprovar referência
                            </button>
                            <button
                              type="button"
                              className="ghost danger-action"
                              disabled={!!feedbackBusy[frame.id]}
                              onClick={() => void submitFeedback(frame, "rejected")}
                            >
                              Reprovar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <section className="reference-library">
            <div className="reference-library-head">
              <div>
                <h3>Biblioteca de referências</h3>
                <p>Artes aprovadas viram referência visual. Reprovações viram padrões que os agentes evitam.</p>
              </div>
              <button
                type="button"
                className="ghost compact-action"
                disabled={!clientId || !references.approved.length}
                onClick={() => window.open(`/api/clients/${clientId}/approved-zip`, "_blank")}
              >
                Baixar ZIP
              </button>
            </div>

            {references.approved.length ? (
              <div className="reference-grid">
                {references.approved.slice(0, 6).map(({ asset, feedback }) => (
                  <article key={asset.id} className="reference-card">
                    {asset.public_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.public_url} alt={asset.file_name} />
                    ) : (
                      <div className="reference-placeholder">IA</div>
                    )}
                    <strong>{feedback.reason}</strong>
                    {feedback.comment && <span>{feedback.comment}</span>}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-reference">Nenhuma arte aprovada ainda. Aprove uma imagem gerada para alimentar a memória.</div>
            )}

            {references.rejected.length > 0 && (
              <details className="technical-details rejected-memory">
                <summary>Padrões reprovados ({references.rejected.length})</summary>
                <ul>
                  {references.rejected.slice(0, 8).map(({ asset, feedback }) => (
                    <li key={asset.id}>
                      <strong>{feedback.reason}</strong>
                      {feedback.comment ? ` · ${feedback.comment}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {history.length > 0 && (
            <details className="technical-details" style={{ marginTop: "var(--space-3)" }}>
              <summary>Histórico do restaurante ({history.length})</summary>
              <ul className="history">
                {history.map((h) => (
                  <li key={h.id}>
                    {new Date(h.created_at).toLocaleString("pt-BR")} · {h.objective} · {h.frames_count} frames · R$ {h.cost_brl.toFixed(2)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </section>

      {promptPreview && (
        <div className="prompt-modal-overlay" onClick={() => setPromptPreview(null)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="prompt-modal-header">
              <div>
                <h3>Prompt da imagem — Frame {promptPreview.frame.idx}</h3>
                <p>Revise (e edite, se quiser) o texto que será enviado para a IA junto com a foto.</p>
              </div>
            </div>
            {!!promptPreview.preflight_notes.length && (
              <div className="prompt-warning">
                <strong>Guardião preventivo</strong>
                <ul>
                  {promptPreview.preflight_notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              className="prompt-modal-text"
              value={promptPreview.prompt}
              onChange={(e) => setPromptPreview({ ...promptPreview, prompt: e.target.value })}
            />
            <label className="field-control logo-policy-control">
              Uso da logo oficial
              <select
                value={promptPreview.logo_policy}
                onChange={(e) => setPromptPreview({ ...promptPreview, logo_policy: e.target.value as LogoPolicy })}
              >
                <option value="discreet">Logo discreta no final</option>
                <option value="none">Sem logo</option>
                <option value="required">Logo obrigatória</option>
                <option value="source_only">Só preservar se já estiver na foto</option>
              </select>
              <small>
                {logos.length
                  ? "A logo cadastrada será aplicada pelo sistema, sem redesenhar por IA."
                  : "Cadastre uma logo no cliente para usar as opções discreta ou obrigatória."}
              </small>
            </label>
            <div className="prompt-modal-actions">
              <button type="button" className="ghost" onClick={() => setPromptPreview(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void navigator.clipboard.writeText(promptPreview.prompt)}
              >
                Copiar prompt
              </button>
              <button
                type="button"
                className="ai-generate"
                onClick={() => {
                  const { frame, prompt, logo_policy } = promptPreview;
                  setPromptPreview(null);
                  void generateAi(frame, prompt, logo_policy);
                }}
              >
                Gerar imagem
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

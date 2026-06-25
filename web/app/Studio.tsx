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

const MAX_SELECTED_MEDIA = 10;

export function Studio({ clients }: Props) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
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
        setSelectedMediaIds(imageMedia.slice(0, Math.min(MAX_SELECTED_MEDIA, Math.max(DEFAULT_BRIEF.frames, 4))).map((a: Asset) => a.id));
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
    const scored = [...media].sort((a, b) => {
      const insightA = mediaInsights[a.id];
      const insightB = mediaInsights[b.id];
      const objectiveA = insightA?.best_for.includes(brief.objective) ? 2 : 0;
      const objectiveB = insightB?.best_for.includes(brief.objective) ? 2 : 0;
      const avoidA = insightA?.avoid_for.some((flag) => ["ai_generation", "hero", brief.objective].includes(flag)) ? -4 : 0;
      const avoidB = insightB?.avoid_for.some((flag) => ["ai_generation", "hero", brief.objective].includes(flag)) ? -4 : 0;
      return ((insightB?.quality_score ?? 5) + objectiveB + avoidB) - ((insightA?.quality_score ?? 5) + objectiveA + avoidA);
    });
    setSelectedMediaIds(scored.slice(0, Math.min(MAX_SELECTED_MEDIA, Math.max(brief.frames, 4))).map((asset) => asset.id));
  }

  async function curateMedia() {
    if (!client || !media.length) return;
    setCuratingMedia(true);
    setMessage("Curador de fotos analisando as mídias reais...");
    try {
      const res = await fetch(`/api/clients/${client.id}/media-curation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_ids: media.slice(0, 12).map((asset) => asset.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      const insights = Array.isArray(data.insights) ? (data.insights as MediaInsight[]) : [];
      setMediaInsights(Object.fromEntries(insights.map((insight) => [insight.asset_id, insight])));
      if (insights.length) {
        const insightById = new Map(insights.map((insight) => [insight.asset_id, insight]));
        const safe = media
          .filter((asset) => {
            const insight = insightById.get(asset.id);
            return !insight?.avoid_for.some((flag) => ["ai_generation", "hero"].includes(flag));
          })
          .sort((a, b) => (insightById.get(b.id)?.quality_score ?? 0) - (insightById.get(a.id)?.quality_score ?? 0));
        setSelectedMediaIds(safe.slice(0, Math.min(MAX_SELECTED_MEDIA, Math.max(brief.frames, 4))).map((asset) => asset.id));
      }
      setMessage(`Curador analisou ${insights.length} foto(s) e atualizou a seleção sugerida.`);
    } catch (err) {
      setMessage(`Erro no curador de fotos: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCuratingMedia(false);
    }
  }

  async function generate() {
    if (!client) return;
    if (!brief.offer.trim() || !brief.cta.trim()) {
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
          ...brief,
          frames: weeklyMode ? Math.max(7, brief.frames) : brief.frames,
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
                  <small>Escolha até {MAX_SELECTED_MEDIA} fotos para reduzir o contexto da IA</small>
                </div>
                <div className="inline-actions">
                  <button type="button" className="ghost compact-action" disabled={busy || curatingMedia || !media.length} onClick={() => void curateMedia()}>
                    {curatingMedia ? "Curando..." : "Curar fotos"}
                  </button>
                  <button type="button" className="ghost compact-action" disabled={busy || !media.length} onClick={selectSuggestedMedia}>
                    Sugerir
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
                            {insight.avoid_for.length ? ` · evitar: ${insight.avoid_for.slice(0, 2).join(", ")}` : ""}
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
                  <span>Gera uma sequência maior e mais variada para abastecer a semana.</span>
                </div>
                <button
                  type="button"
                  className={weeklyMode ? "approve compact-action" : "ghost compact-action"}
                  disabled={busy}
                  onClick={() => {
                    setWeeklyMode((cur) => !cur);
                    setBrief((prev) => ({ ...prev, frames: weeklyMode ? Math.min(prev.frames, 4) : Math.max(prev.frames, 7) }));
                  }}
                >
                  {weeklyMode ? "Ativo" : "Ativar"}
                </button>
              </div>
              <div className="two-columns">
                <label className="field-control">
                  Objetivo
                  <select value={brief.objective} disabled={busy} onChange={(e) => setBriefField("objective", e.target.value as CampaignObjective)}>
                    <option value="vendas">Vendas orgânicas</option>
                    <option value="reservas">Ocasião planejada</option>
                    <option value="engajamento">Engajamento</option>
                    <option value="awareness">Awareness</option>
                    <option value="alcance_local">Alcance local</option>
                    <option value="relacionamento">Relacionamento</option>
                  </select>
                </label>
                <label className="field-control">
                  Formato
                  <select value={brief.output_format} disabled={busy} onChange={(e) => setBriefField("output_format", e.target.value as OutputFormat)}>
                    <option value="stories">Stories</option>
                    <option value="carrossel">Carrossel</option>
                  </select>
                </label>
              </div>
              <div className="two-columns">
                <label className="field-control">
                  Tipo de conteúdo
                  <select value={brief.story_type} disabled={busy} onChange={(e) => setBriefField("story_type", e.target.value as StoryType)}>
                    <option value="promocao">Destaque do dia</option>
                    <option value="bastidor">Bastidor</option>
                    <option value="prova_social">Prova social</option>
                    <option value="cardapio">Cardápio</option>
                    <option value="urgencia">Lembrete</option>
                  </select>
                </label>
                <label className="field-control">
                  Telas
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={brief.frames}
                    disabled={busy}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isNaN(value)) return;
                      setBriefField("frames", Math.max(3, Math.min(10, Math.trunc(value))));
                    }}
                  />
                </label>
              </div>
              <label className="field-control">
                Tema ou produto
                <input value={brief.offer} disabled={busy} onChange={(e) => setBriefField("offer", e.target.value)} />
              </label>
              <label className="field-control">
                Chamada orgânica
                <input value={brief.cta} disabled={busy} onChange={(e) => setBriefField("cta", e.target.value)} />
              </label>
            </article>

            <button type="button" className="primary-action" disabled={busy || !client || !selectedMediaIds.length} onClick={() => void generate()}>
              {busy ? "Produzindo..." : "Gerar pacote de stories"}
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
                  return (
                    <div key={frame.id} className="frame">
                      <div className="frame-header">
                        <h4>Frame {frame.idx}</h4>
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

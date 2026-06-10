"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  Asset,
  CampaignObjective,
  ClientProfile,
  Frame,
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

const DEFAULT_BRIEF: Brief = {
  objective: "vendas",
  story_type: "promocao",
  output_format: "stories",
  frames: 4,
  offer: "",
  cta: "",
};

export function Studio({ clients }: Props) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [media, setMedia] = useState<Asset[]>([]);
  const [pkg, setPkg] = useState<StoryPackage | null>(null);
  const [aiByFrame, setAiByFrame] = useState<Record<string, Asset>>({});
  const [history, setHistory] = useState<StoryPackage[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Selecione um cliente e gere um pacote.");

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    (async () => {
      try {
        const [mediaRes, histRes, usageRes] = await Promise.all([
          fetch(`/api/clients/${clientId}/assets?role=media`),
          fetch(`/api/clients/${clientId}/packages`),
          fetch(`/api/clients/${clientId}/usage`),
        ]);
        const mediaData = await mediaRes.json();
        const histData = await histRes.json();
        const usageData = await usageRes.json();
        if (!active) return;
        setMedia((mediaData.items ?? []).filter((a: Asset) => a.mime_type.startsWith("image/")));
        setHistory(histData.items ?? []);
        setUsage(usageData);
        setPkg(null);
        setAiByFrame({});
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [clientId]);

  function setBriefField<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((prev) => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (!client) return;
    if (!brief.offer.trim() || !brief.cta.trim()) {
      setMessage("Preencha tema/produto e a chamada orgânica.");
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      setPkg(data as StoryPackage);
      setAiByFrame({});
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

  function mediaFor(frame: Frame): Asset | undefined {
    if (frame.media_asset_id) return media.find((m) => m.id === frame.media_asset_id);
    return undefined;
  }

  function imageUrlFor(frame: Frame): string {
    const ai = aiByFrame[frame.id];
    if (ai?.public_url) return ai.public_url;
    return mediaFor(frame)?.public_url ?? "";
  }

  async function generateAi(frame: Frame) {
    if (!client) return;
    const source = mediaFor(frame);
    if (!source) {
      setMessage("Esse frame não tem uma mídia real associada na biblioteca.");
      return;
    }
    setBusy(true);
    setMessage(`Gerando imagem com IA para o frame ${frame.idx}...`);
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
          quality: "medium",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      setAiByFrame((cur) => ({ ...cur, [frame.id]: data.asset as Asset }));
      setMessage(`Imagem gerada para o frame ${frame.idx}.`);
    } catch (err) {
      setMessage(`Erro ao gerar com IA: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
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
                {media.length} mídia(s) na biblioteca ·{" "}
                {client && <Link href={`/clientes/${client.id}`}>gerenciar cliente</Link>}
              </div>
            </article>

            <article className="form-card">
              <div className="card-title">
                <div>
                  <span>Campanha</span>
                  <small>O que os stories precisam causar</small>
                </div>
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
                  <input type="number" min={3} max={10} value={brief.frames} disabled={busy} onChange={(e) => setBriefField("frames", Number(e.target.value))} />
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

            <button type="button" className="primary-action" disabled={busy || !client} onClick={() => void generate()}>
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

          {!pkg && (
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
                  return (
                    <div key={frame.id} className="frame">
                      <div className="frame-header">
                        <h4>Frame {frame.idx}</h4>
                        {aiByFrame[frame.id] && <span className="status-pill">IA</span>}
                      </div>
                      <div
                        className={`creative-preview ${frame.layout_style}`}
                        style={url ? { backgroundImage: `url(${url})` } : undefined}
                      >
                        <span>{frame.headline}</span>
                      </div>
                      <div className="frame-copy">
                        <p><strong>{frame.headline}</strong></p>
                        <p>{frame.body}</p>
                        <p><strong>Chamada:</strong> {frame.cta}</p>
                        <p><strong>Visual:</strong> {frame.visual_direction}</p>
                      </div>
                      <div className="frame-actions">
                        <button type="button" className="ai-generate" disabled={busy || !mediaFor(frame)} onClick={() => void generateAi(frame)}>
                          Gerar com IA
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

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
    </main>
  );
}

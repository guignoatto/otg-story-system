import type { AiImageState, CampaignFormState, GenerationJob, StoryFrame, UsageSummary } from "../types";

type ResultPanelProps = {
  currentJob: GenerationJob | null;
  approved: boolean;
  metaMessage: string;
  aiImagesByFrame: Record<number, AiImageState>;
  imageUrlForFrame: (frame: StoryFrame) => string;
  form: CampaignFormState;
  usage: UsageSummary | null;
  history: GenerationJob[];
  onApprove: () => void;
  onExportJson: () => void;
  onDownloadAiPack: () => void;
  onGenerateAi: (frame: StoryFrame) => void;
  onRegenerateFrame: (frame: StoryFrame) => void;
  onDownloadFrame: (frame: StoryFrame) => void;
  isBusy: boolean;
};

function EmptyMeta({ message }: { message: string }) {
  return (
    <div className="meta-box empty-state">
      <strong>{message || "Nenhum pacote gerado ainda."}</strong>
      <span>Escolha o restaurante, confirme as regras e clique em Gerar pacote.</span>
    </div>
  );
}

function FrameCard({
  frame,
  imageUrl,
  aiImage,
  onGenerateAi,
  onRegenerateFrame,
  onDownloadFrame,
  isBusy,
}: {
  frame: StoryFrame;
  imageUrl: string;
  aiImage?: AiImageState;
  onGenerateAi: (frame: StoryFrame) => void;
  onRegenerateFrame: (frame: StoryFrame) => void;
  onDownloadFrame: (frame: StoryFrame) => void;
  isBusy: boolean;
}) {
  const layoutClass = frame.layout_style || "editorial";
  const previewStyle = imageUrl
    ? { backgroundImage: `${aiImage ? "" : "linear-gradient(rgba(11,42,30,.38), rgba(11,42,30,.38)), "}url('${imageUrl}')` }
    : undefined;

  return (
    <article className="frame">
      <div className="frame-header">
        <h4>Frame {String(frame.index).padStart(2, "0")}</h4>
        {aiImage ? <div className="status-pill" title={aiImage.fileName}>IA pronta</div> : null}
      </div>
      <div className={`creative-preview ${layoutClass} ${aiImage ? "ai-final-preview" : ""}`} style={previewStyle}>
        {aiImage ? null : <span>{frame.headline}</span>}
      </div>
      <div className="frame-copy">
        <p><strong>Headline:</strong> {frame.headline}</p>
        <p>{frame.body}</p>
        <p><strong>Chamada organica:</strong> {frame.cta}</p>
        <p><strong>Midia:</strong> {frame.media_file_name || "sem midia selecionada"}</p>
        <p><strong>Layout:</strong> {frame.layout_style} · <strong>Visual:</strong> {frame.visual_direction}</p>
      </div>
      <div className="frame-actions">
        <button type="button" className="ai-generate" disabled={isBusy} onClick={() => onGenerateAi(frame)}>Gerar com IA</button>
        <button type="button" className="ghost" disabled={isBusy} onClick={() => onRegenerateFrame(frame)}>Regenerar</button>
        <button type="button" className="ghost" disabled={isBusy} onClick={() => onDownloadFrame(frame)}>{aiImage ? "Baixar IA" : "Baixar preview"}</button>
      </div>
    </article>
  );
}

export function ResultPanel({
  currentJob,
  approved,
  metaMessage,
  aiImagesByFrame,
  imageUrlForFrame,
  usage,
  history,
  onApprove,
  onExportJson,
  onDownloadAiPack,
  onGenerateAi,
  onRegenerateFrame,
  onDownloadFrame,
  isBusy,
}: ResultPanelProps) {
  const pack = currentJob?.result?.pack;
  const trace = currentJob?.result?.trace || [];

  return (
    <section className="panel result-panel">
      <div className="result-heading">
        <div className="heading-inline">
          <span className="section-number">02</span>
          <div>
            <h2>Mesa de aprovacao</h2>
            <p>Valide copy, midia e regras antes de pedir a imagem final com IA.</p>
          </div>
        </div>
        <div className="result-actions">
          <button className="approve" type="button" disabled={isBusy || !currentJob} onClick={onApprove}>{approved ? "Pacote aprovado" : "Aprovar"}</button>
          <button className="ghost" type="button" disabled={isBusy || !currentJob} onClick={onDownloadAiPack}>Baixar imagens IA</button>
          <button className="ghost" type="button" disabled={isBusy || !currentJob} onClick={onExportJson}>Exportar JSON</button>
        </div>
      </div>

      {!pack ? (
        <EmptyMeta message={metaMessage} />
      ) : (
        <div className="meta-box">
          <div className="job-summary">
            <div><span>Cliente</span><strong>{currentJob.client_id}</strong></div>
            <div><span>Marca</span><strong>{pack.restaurant_name}</strong></div>
            <div><span>Custo</span><strong>R$ {currentJob.estimated_cost_brl.toFixed(2)}</strong></div>
            <div><span>Scores</span><strong>{pack.brand_score} / {pack.performance_score}</strong></div>
          </div>
          <p className="rationale">{metaMessage || pack.rationale}</p>
        </div>
      )}

      <div className="frames">
        {pack?.frames.map((frame) => (
          <FrameCard
            key={frame.index}
            frame={frame}
            imageUrl={imageUrlForFrame(frame)}
            aiImage={aiImagesByFrame[frame.index]}
            onGenerateAi={onGenerateAi}
            onRegenerateFrame={onRegenerateFrame}
            onDownloadFrame={onDownloadFrame}
            isBusy={isBusy}
          />
        ))}
      </div>

      <section className="audit-grid">
        <details className="technical-details audit-card">
          <summary>Agentes e travas</summary>
          <ul className="trace-list">
            {trace.map((step) => (
              <li key={`${step.name}-${step.output_summary}`}>{step.name}: {step.output_summary}</li>
            ))}
          </ul>
        </details>
        <details className="technical-details audit-card">
          <summary>Historico do restaurante</summary>
          {usage ? (
            <div className="usage">
              <p><strong>Total de jobs:</strong> {usage.total_jobs}</p>
              <p><strong>Concluidos:</strong> {usage.completed_jobs}</p>
              <p><strong>Custo estimado acumulado:</strong> R$ {usage.estimated_total_cost_brl.toFixed(2)}</p>
            </div>
          ) : null}
          <ul className="history">
            {history.slice(0, 8).map((job) => (
              <li key={job.job_id}><strong>{job.status}</strong> - {job.job_id} - R$ {job.estimated_cost_brl.toFixed(2)}</li>
            ))}
          </ul>
        </details>
      </section>
    </section>
  );
}

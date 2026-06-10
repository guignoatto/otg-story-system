import type { ChangeEvent, FormEvent, ReactNode } from "react";
import type { CampaignFormState, CampaignObjective, ClientProfile, OutputFormat, StoryType } from "../types";
import { DriveCatalog } from "./DriveCatalog";
import { FormField } from "./FormField";
import type { DriveMediaItem } from "../types";

type TouchedMap = Partial<Record<keyof CampaignFormState, boolean>>;

type BriefingPanelProps = {
  form: CampaignFormState;
  clients: ClientProfile[];
  selectedClientId: string;
  touched: TouchedMap;
  isBusy: boolean;
  manualInsights: ReactNode;
  manualUploadStatus: string;
  mediaUploadStatus: string;
  driveStatus: { text: string; kind: "default" | "connected" | "pending" };
  driveCatalogItems: DriveMediaItem[];
  driveCatalogVisible: boolean;
  selectedDriveIds: string[];
  onSelectClient: (clientId: string) => void;
  onSaveClient: () => void;
  onChange: <K extends keyof CampaignFormState>(name: K, value: CampaignFormState[K]) => void;
  onTouch: (name: keyof CampaignFormState) => void;
  isFieldDisabled: (name: keyof CampaignFormState) => boolean;
  onManualFilesChange: (files: File[]) => void;
  onMediaFilesChange: (files: File[]) => void;
  onLoadDriveCatalog: () => void;
  onImportDrive: () => void;
  onImportSelectedDrive: () => void;
  onLoadLocalMedia: () => void;
  onToggleDriveFile: (fileId: string) => void;
  onSubmit: (event: FormEvent) => void;
};

function fileList(event: ChangeEvent<HTMLInputElement>): File[] {
  return Array.from(event.target.files || []);
}

export function BriefingPanel({
  form,
  clients,
  selectedClientId,
  touched,
  isBusy,
  manualInsights,
  manualUploadStatus,
  mediaUploadStatus,
  driveStatus,
  driveCatalogItems,
  driveCatalogVisible,
  selectedDriveIds,
  onSelectClient,
  onSaveClient,
  onChange,
  onTouch,
  isFieldDisabled,
  onManualFilesChange,
  onMediaFilesChange,
  onLoadDriveCatalog,
  onImportDrive,
  onImportSelectedDrive,
  onLoadLocalMedia,
  onToggleDriveFile,
  onSubmit,
}: BriefingPanelProps) {
  return (
    <section className="panel control-panel">
      <div className="section-heading">
        <span className="section-number">01</span>
        <div>
          <h2>Briefing de criacao</h2>
          <p>Preencha o minimo necessario. O resto fica salvo como contexto do restaurante.</p>
        </div>
      </div>

      <form id="campaign-form" className="brief-form" onSubmit={onSubmit}>
        <article className="form-card spotlight-card">
          <div className="card-title">
            <div>
              <span>Restaurante</span>
              <small>Selecione um cliente ou cadastre outro</small>
            </div>
          </div>

          <FormField label="Cliente salvo" value={selectedClientId} disabled={isBusy}>
            <select value={selectedClientId} disabled={isBusy} onChange={(event) => onSelectClient(event.target.value)}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </FormField>

          <div className="two-columns">
            <FormField label="Nome do restaurante" value={form.restaurantName} required touched={touched.restaurantName} disabled={isFieldDisabled("restaurantName")}>
              <input
                value={form.restaurantName}
                required
                disabled={isFieldDisabled("restaurantName")}
                onBlur={() => onTouch("restaurantName")}
                onChange={(event) => onChange("restaurantName", event.target.value)}
              />
            </FormField>
            <FormField label="ID interno OTG" value={form.clientId} required touched={touched.clientId} disabled={isFieldDisabled("clientId")}>
              <input
                value={form.clientId}
                required
                disabled={isFieldDisabled("clientId")}
                onBlur={() => onTouch("clientId")}
                onChange={(event) => onChange("clientId", event.target.value)}
              />
            </FormField>
          </div>

          <button type="button" className="ghost full-width" disabled={isBusy} onClick={onSaveClient}>Salvar / atualizar restaurante</button>
        </article>

        <article className="form-card">
          <div className="card-title">
            <div>
              <span>Campanha</span>
              <small>O que os stories precisam causar</small>
            </div>
          </div>
          <div className="two-columns">
            <FormField label="Objetivo" value={form.objective} disabled={isBusy}>
              <select value={form.objective} disabled={isBusy} onChange={(event) => onChange("objective", event.target.value as CampaignObjective)}>
                <option value="vendas">Vendas organicas</option>
                <option value="reservas">Ocasião planejada</option>
                <option value="engajamento">Engajamento</option>
                <option value="awareness">Awareness</option>
                <option value="alcance_local">Alcance local</option>
                <option value="relacionamento">Relacionamento</option>
              </select>
            </FormField>
            <FormField label="Formato" value={form.outputFormat} disabled={isBusy}>
              <select value={form.outputFormat} disabled={isBusy} onChange={(event) => onChange("outputFormat", event.target.value as OutputFormat)}>
                <option value="stories">Stories</option>
                <option value="carrossel">Carrossel</option>
              </select>
            </FormField>
          </div>
          <div className="two-columns">
            <FormField label="Tipo de conteudo" value={form.storyType} disabled={isBusy}>
              <select value={form.storyType} disabled={isBusy} onChange={(event) => onChange("storyType", event.target.value as StoryType)}>
                <option value="promocao">Destaque do dia</option>
                <option value="bastidor">Bastidor</option>
                <option value="prova_social">Prova social</option>
                <option value="cardapio">Cardapio</option>
                <option value="urgencia">Lembrete</option>
              </select>
            </FormField>
            <FormField label="Telas" value={form.frames} disabled={isBusy}>
              <input
                type="number"
                min={3}
                max={10}
                value={form.frames}
                disabled={isBusy}
                onChange={(event) => onChange("frames", Number(event.target.value))}
              />
            </FormField>
          </div>
          <FormField label="Tema ou produto" value={form.offer} required touched={touched.offer} disabled={isFieldDisabled("offer")}>
            <input
              value={form.offer}
              required
              disabled={isFieldDisabled("offer")}
              onBlur={() => onTouch("offer")}
              onChange={(event) => onChange("offer", event.target.value)}
            />
          </FormField>
          <FormField label="Chamada organica" value={form.cta} required touched={touched.cta} disabled={isFieldDisabled("cta")}>
            <input
              value={form.cta}
              required
              disabled={isFieldDisabled("cta")}
              onBlur={() => onTouch("cta")}
              onChange={(event) => onChange("cta", event.target.value)}
            />
          </FormField>
        </article>

        <article className="form-card">
          <div className="card-title">
            <div>
              <span>Regras operacionais</span>
              <small>O QA barra o que nao fizer sentido</small>
            </div>
          </div>
          <FormField label="Observacoes do cliente" value={form.clientNotes} disabled={isBusy}>
            <textarea
              rows={5}
              value={form.clientNotes}
              disabled={isBusy}
              onChange={(event) => onChange("clientNotes", event.target.value)}
            />
          </FormField>
          <div className="two-columns">
            <FormField label="Cidade" value={form.city} disabled={isBusy}>
              <input value={form.city} disabled={isBusy} onChange={(event) => onChange("city", event.target.value)} />
            </FormField>
            <FormField label="Bairro ou regiao" value={form.neighborhood} disabled={isBusy}>
              <input value={form.neighborhood} placeholder="Opcional" disabled={isBusy} onChange={(event) => onChange("neighborhood", event.target.value)} />
            </FormField>
          </div>
        </article>

        <article className="form-card asset-card">
          <div className="card-title">
            <div>
              <span>Marca</span>
              <small>Manual oficial ou manual sintetico</small>
            </div>
          </div>
          <FormField label="Manual de marca" disabled={isBusy}>
            <input type="file" accept=".pdf,.doc,.docx,.txt,image/*" disabled={isBusy} onChange={(event) => onManualFilesChange(fileList(event))} />
          </FormField>
          <div className="upload-status">{manualUploadStatus}</div>
          <div className="insights">{manualInsights}</div>

          <details className="technical-details">
            <summary>Ajustes opcionais de marca</summary>
            <FormField label="Tom de voz" value={form.toneOfVoice} disabled={isBusy}>
              <input value={form.toneOfVoice} disabled={isBusy} onChange={(event) => onChange("toneOfVoice", event.target.value)} />
            </FormField>
            <FormField label="Paleta provisoria" value={form.colorPalette} disabled={isBusy}>
              <input value={form.colorPalette} disabled={isBusy} onChange={(event) => onChange("colorPalette", event.target.value)} />
            </FormField>
            <FormField label="Tipografia provisoria" value={form.typography} disabled={isBusy}>
              <input value={form.typography} disabled={isBusy} onChange={(event) => onChange("typography", event.target.value)} />
            </FormField>
          </details>
        </article>

        <article className="form-card asset-card">
          <div className="card-title">
            <div>
              <span>Midias reais</span>
              <small>Base visual para a IA</small>
            </div>
          </div>
          <FormField label="Pasta de midias do restaurante" value={form.mediaSourceUrl} disabled={isBusy}>
            <input value={form.mediaSourceUrl} disabled={isBusy} onChange={(event) => onChange("mediaSourceUrl", event.target.value)} />
          </FormField>
          <div className={`drive-status ${driveStatus.kind === "default" ? "" : driveStatus.kind}`}>{driveStatus.text}</div>
          <div className="button-row">
            <button type="button" className="ghost" disabled={isBusy} onClick={onLoadDriveCatalog}>Ver catalogo do Drive</button>
            <button type="button" className="ghost" disabled={isBusy} onClick={onImportDrive}>Importar primeiras 12</button>
            <button type="button" className="ghost" disabled={isBusy} onClick={onLoadLocalMedia}>Usar biblioteca local</button>
          </div>
          <DriveCatalog items={driveCatalogItems} selectedIds={selectedDriveIds} visible={driveCatalogVisible} onToggle={onToggleDriveFile} />
          <button type="button" className="ghost full-width" disabled={isBusy || selectedDriveIds.length === 0} onClick={onImportSelectedDrive}>
            {selectedDriveIds.length ? `Importar ${selectedDriveIds.length} selecionada(s)` : "Importar selecionadas"}
          </button>
          <FormField label="Upload manual de midias" disabled={isBusy}>
            <input type="file" accept="image/*,video/*" multiple disabled={isBusy} onChange={(event) => onMediaFilesChange(fileList(event))} />
          </FormField>
          <div className="upload-status">{mediaUploadStatus}</div>
        </article>
      </form>
    </section>
  );
}

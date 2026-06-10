import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppHeader } from "./components/AppHeader";
import { BriefingPanel } from "./components/BriefingPanel";
import { LoadingTab } from "./components/LoadingTab";
import { ResultPanel } from "./components/ResultPanel";
import {
  API_BASE,
  assetUrl,
  createGeneration,
  downloadAssetsZip,
  downloadStoredAsset,
  generateAiImage,
  importDriveAssets as importDriveAssetsApi,
  importSelectedDriveAssets as importSelectedDriveAssetsApi,
  loadClientAssets,
  loadClientHistory,
  loadClientUsage,
  loadDriveCatalog as loadDriveCatalogApi,
  loadDriveStatus as loadDriveStatusApi,
  uploadAssets,
  uploadPathFromUrl,
} from "./lib/api";
import { canvasToPngBlob, drawFrameToCanvas } from "./lib/canvas";
import { clientFromForm, formStateFromClient, loadClients, saveClients } from "./lib/clients";
import { formDefaults, frameImageFileName, slugify, splitCsv, splitLines, triggerBlobDownload } from "./lib/utils";
import type {
  AiImageState,
  CampaignFormState,
  ClientProfile,
  CreateGenerationRequest,
  DriveMediaItem,
  GenerationJob,
  StoryFrame,
  UploadedAsset,
  UsageSummary,
} from "./types";

type TouchedMap = Partial<Record<keyof CampaignFormState, boolean>>;
type LoadingState = { active: boolean; title: string; detail: string };
type DriveStatusState = { text: string; kind: "default" | "connected" | "pending" };

const requiredOrder: Array<keyof CampaignFormState> = ["restaurantName", "clientId", "offer", "cta"];

function initialClients(): ClientProfile[] {
  return loadClients();
}

function firstClient(clients: ClientProfile[]): ClientProfile {
  return clients.find((client) => client.id === "heim") || clients[0];
}

export function App() {
  const [clients, setClients] = useState<ClientProfile[]>(initialClients);
  const [selectedClientId, setSelectedClientId] = useState(() => firstClient(initialClients()).id);
  const [form, setForm] = useState<CampaignFormState>(() => formStateFromClient(firstClient(initialClients())) || formDefaults());
  const [touched, setTouched] = useState<TouchedMap>({});
  const [clientIdTouched, setClientIdTouched] = useState(false);

  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [manualAsset, setManualAsset] = useState<UploadedAsset | null>(null);
  const [mediaAssets, setMediaAssets] = useState<UploadedAsset[]>([]);
  const [localImageUrls, setLocalImageUrls] = useState<string[]>([]);

  const [driveStatus, setDriveStatus] = useState<DriveStatusState>({ text: "Verificando conexao com Google Drive...", kind: "default" });
  const [driveCatalogItems, setDriveCatalogItems] = useState<DriveMediaItem[]>([]);
  const [driveCatalogVisible, setDriveCatalogVisible] = useState(false);
  const [selectedDriveIds, setSelectedDriveIds] = useState<string[]>([]);

  const [currentPayload, setCurrentPayload] = useState<CreateGenerationRequest | null>(null);
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [aiImagesByFrame, setAiImagesByFrame] = useState<Record<number, AiImageState>>({});
  const [approved, setApproved] = useState(false);
  const [metaMessage, setMetaMessage] = useState("Nenhum pacote gerado ainda.");
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState<LoadingState>({ active: false, title: "Produzindo postagem", detail: "Os agentes estao montando o criativo." });
  const [manualUploadStatus, setManualUploadStatus] = useState("");
  const [mediaUploadStatus, setMediaUploadStatus] = useState("");

  const activeClient = useMemo(() => clients.find((client) => client.id === selectedClientId), [clients, selectedClientId]);
  const displayClient = useMemo<ClientProfile | undefined>(() => {
    if (!activeClient) return undefined;
    return { ...activeClient, name: form.restaurantName, notes: form.clientNotes };
  }, [activeClient, form.clientNotes, form.restaurantName]);

  const isBusy = loading.active;
  const formReady = requiredOrder.every((key) => String(form[key] || "").trim());

  useEffect(() => {
    void refreshDriveStatus();
  }, []);

  useEffect(() => {
    return () => {
      localImageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [localImageUrls]);

  function setLoadingState(active: boolean, title = "Produzindo postagem", detail = "Os agentes estao montando o criativo.") {
    setLoading({ active, title, detail });
  }

  function clearLocalImageUrls() {
    localImageUrls.forEach((url) => URL.revokeObjectURL(url));
    setLocalImageUrls([]);
  }

  function resetClientAssets() {
    setManualFiles([]);
    setMediaFiles([]);
    setManualAsset(null);
    setMediaAssets([]);
    clearLocalImageUrls();
    setDriveCatalogItems([]);
    setDriveCatalogVisible(false);
    setSelectedDriveIds([]);
    setAiImagesByFrame({});
  }

  function updateForm<K extends keyof CampaignFormState>(name: K, value: CampaignFormState[K]) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "restaurantName" && !clientIdTouched) {
        next.clientId = slugify(String(value));
      }
      return next;
    });
    if (name === "clientId") {
      setClientIdTouched(true);
    }
  }

  function markTouched(name: keyof CampaignFormState) {
    setTouched((current) => ({ ...current, [name]: true }));
  }

  function isFieldDisabled(name: keyof CampaignFormState): boolean {
    if (isBusy) return true;
    const index = requiredOrder.indexOf(name);
    if (index < 0) return false;
    return requiredOrder.slice(0, index).some((key) => !String(form[key] || "").trim());
  }

  function applyClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return;
    setSelectedClientId(client.id);
    setForm(formStateFromClient(client));
    setTouched({});
    setClientIdTouched(false);
    resetClientAssets();
    setCurrentPayload(null);
    setCurrentJob(null);
    setApproved(false);
    setUsage(null);
    setHistory([]);
    setMetaMessage(`Cliente ativo: ${client.name}. Carregue as midias deste restaurante para gerar o pacote.`);
  }

  function saveCurrentClient() {
    const savedClient = clients.find((client) => client.id === selectedClientId);
    const client = clientFromForm(form, savedClient);
    const nextClients = clients.filter((item) => item.id !== client.id).concat(client).sort((a, b) => a.name.localeCompare(b.name));
    setClients(nextClients);
    saveClients(nextClients);
    setSelectedClientId(client.id);
    setMetaMessage(`Restaurante salvo: ${client.name}.`);
  }

  function onManualFilesChange(files: File[]) {
    setManualFiles(files);
    setManualUploadStatus(files.length ? `${files.length} manual(is) selecionado(s). O envio acontece ao gerar.` : "");
  }

  function onMediaFilesChange(files: File[]) {
    clearLocalImageUrls();
    setMediaFiles(files);
    const imageUrls = files.filter((file) => file.type.startsWith("image/")).map((file) => URL.createObjectURL(file));
    setLocalImageUrls(imageUrls);
    setMediaUploadStatus(files.length ? `${files.length} midia(s) selecionada(s). O envio acontece ao gerar.` : "");
  }

  async function refreshDriveStatus() {
    setDriveStatus({ text: "Verificando conexao com Google Drive...", kind: "default" });
    try {
      const data = await loadDriveStatusApi();
      if (data.configured) {
        setDriveStatus({
          kind: "connected",
          text: data.service_account_email
            ? `Drive API conectada: compartilhe pastas com ${data.service_account_email}`
            : "Drive API conectada. Compartilhe as pastas dos clientes com a service account.",
        });
      } else {
        setDriveStatus({ kind: "pending", text: "Modo publico/manual ativo. Drive privado fica para depois; por enquanto use pasta publica ou upload manual." });
      }
    } catch (error) {
      setDriveStatus({ kind: "pending", text: `Nao consegui verificar o Drive: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  function buildPayload(nextManualAsset: UploadedAsset | null, nextMediaAssets: UploadedAsset[]): CreateGenerationRequest {
    const manualColors = nextManualAsset?.detected_colors?.length ? nextManualAsset.detected_colors : splitCsv(form.colorPalette);
    const manualTypography = nextManualAsset?.detected_typography?.length ? nextManualAsset.detected_typography : splitCsv(form.typography);
    const manualTone = nextManualAsset?.detected_tone || form.toneOfVoice;

    return {
      client_id: form.clientId,
      campaign: {
        restaurant_name: form.restaurantName,
        objective: form.objective,
        offer: form.offer,
        cta: form.cta,
        story_type: form.storyType,
        output_format: form.outputFormat,
        frames: Number(form.frames),
        manual: {
          brand_name: form.restaurantName,
          tone_of_voice: manualTone,
          color_palette: manualColors,
          typography: manualTypography,
          forbidden_elements: splitLines(form.clientNotes),
          city: form.city,
          neighborhood: form.neighborhood,
          manual_asset: nextManualAsset,
          manual_summary: nextManualAsset?.extracted_text_preview || (nextManualAsset ? `Manual enviado: ${nextManualAsset.file_name}` : null),
        },
        media_assets: nextMediaAssets,
        media_source_url: form.mediaSourceUrl,
      },
    };
  }

  async function submitGeneration(event: FormEvent) {
    event.preventDefault();
    setTouched({ restaurantName: true, clientId: true, offer: true, cta: true });

    if (!formReady) {
      setMetaMessage("Preencha os campos obrigatorios em ordem para liberar a geracao.");
      return;
    }

    setCurrentJob(null);
    setAiImagesByFrame({});
    setApproved(false);
    setMetaMessage("Preparando briefing...");

    try {
      let nextManualAsset = manualAsset;
      let nextMediaAssets = mediaAssets;

      if (manualFiles.length) {
        setManualUploadStatus("Enviando manual...");
        const uploadedManual = await uploadAssets(form.clientId, "manual", manualFiles);
        nextManualAsset = uploadedManual[0] || null;
        setManualAsset(nextManualAsset);
        setManualUploadStatus(nextManualAsset ? `Manual recebido: ${nextManualAsset.file_name}` : "");
      }

      if (mediaFiles.length) {
        setMediaUploadStatus("Enviando fotos e videos...");
        nextMediaAssets = await uploadAssets(form.clientId, "media", mediaFiles);
        setMediaAssets(nextMediaAssets);
        setMediaUploadStatus(`${nextMediaAssets.length} midia(s) recebida(s).`);
      }

      const payload = buildPayload(nextManualAsset, nextMediaAssets);
      setCurrentPayload(payload);
      setLoadingState(true, "Produzindo postagem", "Briefing validado. Os agentes estao criando a pre-aprovacao visual.");
      const job = await createGeneration(payload);
      setCurrentJob(job);
      setMetaMessage(job.result?.pack.rationale || "Pacote gerado para pre-aprovacao.");
      await refreshHistory(form.clientId);
    } catch (error) {
      setMetaMessage(`Erro ao gerar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  async function refreshHistory(clientId = form.clientId) {
    if (!clientId) return;
    try {
      const [jobsData, usageData] = await Promise.all([loadClientHistory(clientId), loadClientUsage(clientId)]);
      setHistory(jobsData.items);
      setUsage(usageData);
    } catch (error) {
      setMetaMessage(`Erro ao carregar historico: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleLoadDriveCatalog() {
    if (!form.mediaSourceUrl) {
      setMediaUploadStatus("Cole o link da pasta do Google Drive antes de ver o catalogo.");
      return;
    }

    setLoadingState(true, "Lendo Drive", "Listando arquivos sem baixar a pasta inteira.");
    setMediaUploadStatus("Listando arquivos do Drive sem baixar as pastas...");
    try {
      const data = await loadDriveCatalogApi(form.mediaSourceUrl, 120);
      setDriveCatalogItems(data.items);
      setDriveCatalogVisible(true);
      setSelectedDriveIds([]);
      setMediaUploadStatus(`${data.items.length} arquivo(s) encontrados no Drive. Marque so os que quer trazer para a biblioteca.`);
    } catch (error) {
      setMediaUploadStatus(`Erro ao listar catalogo do Drive: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  async function handleImportDrive() {
    if (!form.mediaSourceUrl) {
      setMediaUploadStatus("Cole o link da pasta do Google Drive antes de importar.");
      return;
    }

    setLoadingState(true, "Importando Drive", "Baixando as primeiras 12 midias para a biblioteca do cliente.");
    setMediaUploadStatus("Acessando a pasta do Drive e importando imagens/videos...");
    try {
      const data = await importDriveAssetsApi(form.clientId, form.mediaSourceUrl, 12);
      clearLocalImageUrls();
      setMediaFiles([]);
      setMediaAssets(data.items);
      setMediaUploadStatus(`${data.items.length} midia(s) importada(s) do Drive e prontas para usar.`);
    } catch (error) {
      setMediaUploadStatus(`Erro ao buscar Drive: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  async function handleImportSelectedDrive() {
    if (!selectedDriveIds.length) {
      setMediaUploadStatus("Selecione pelo menos uma imagem ou video no catalogo.");
      return;
    }

    setLoadingState(true, "Importando selecionadas", "Baixando apenas os arquivos escolhidos para a biblioteca.");
    setMediaUploadStatus("Baixando apenas os arquivos selecionados para a biblioteca do cliente...");
    try {
      const data = await importSelectedDriveAssetsApi(form.clientId, selectedDriveIds);
      clearLocalImageUrls();
      setMediaFiles([]);
      setMediaAssets((current) => [...current, ...data.items]);
      setMediaUploadStatus(`${data.items.length} arquivo(s) selecionado(s) importado(s). Biblioteca atual: ${mediaAssets.length + data.items.length} midia(s).`);
      setSelectedDriveIds([]);
    } catch (error) {
      setMediaUploadStatus(`Erro ao importar selecionadas: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  async function handleLoadLocalMedia() {
    setLoadingState(true, "Carregando biblioteca", "Buscando midias ja importadas deste restaurante.");
    setMediaUploadStatus("Buscando midias ja importadas deste restaurante...");
    try {
      const data = await loadClientAssets(form.clientId, "media");
      clearLocalImageUrls();
      setMediaFiles([]);
      setMediaAssets(data.items);
      setMediaUploadStatus(`${data.items.length} midia(s) local(is) encontrada(s).`);
    } catch (error) {
      setMediaUploadStatus(`Erro ao carregar midias locais: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  function toggleDriveFile(fileId: string) {
    setSelectedDriveIds((current) => (current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId]));
  }

  function imageAssetForFrame(frame: StoryFrame): UploadedAsset | undefined {
    const imageAssets = mediaAssets.filter((asset) => asset.file_type?.startsWith("image/") && asset.url);
    if (!imageAssets.length) return undefined;
    return imageAssets.find((asset) => asset.asset_id === frame.media_asset_id) || imageAssets[(frame.index - 1) % imageAssets.length];
  }

  function imageUrlForFrame(frame: StoryFrame): string {
    const aiImage = aiImagesByFrame[frame.index];
    if (aiImage) return aiImage.url;
    if (localImageUrls.length) return localImageUrls[(frame.index - 1) % localImageUrls.length];
    const selectedAsset = imageAssetForFrame(frame);
    return selectedAsset ? assetUrl(selectedAsset) : "";
  }

  function sourceImageUrlForAi(frame: StoryFrame): string {
    const selectedAsset = imageAssetForFrame(frame);
    return selectedAsset ? assetUrl(selectedAsset) : "";
  }

  async function handleGenerateAi(frame: StoryFrame) {
    if (!currentPayload) {
      setMetaMessage("Gere um pacote antes de criar imagens com IA.");
      return;
    }

    const sourceImageUrl = sourceImageUrlForAi(frame);
    if (!sourceImageUrl) {
      setMetaMessage("Esse frame ainda nao tem uma imagem real salva na biblioteca do sistema.");
      return;
    }

    setLoadingState(true, "Gerando imagem com IA", `Frame ${frame.index} em producao com gpt-image-2.`);
    try {
      const result = await generateAiImage({
        client_id: form.clientId,
        source_image_url: sourceImageUrl.replace(API_BASE, ""),
        headline: frame.headline,
        body: frame.body,
        cta: frame.cta,
        visual_direction: frame.visual_direction,
        layout_style: frame.layout_style,
        output_format: currentPayload.campaign.output_format || "stories",
        quality: "medium",
        restaurant_name: currentPayload.campaign.restaurant_name || form.restaurantName,
        color_palette: currentPayload.campaign.manual.color_palette || [],
        operational_notes: currentPayload.campaign.manual.forbidden_elements || [],
      });
      setAiImagesByFrame((current) => ({ ...current, [frame.index]: { url: `${API_BASE}${result.image_url}`, fileName: result.file_name } }));
      setMetaMessage(`Imagem com IA gerada: ${result.file_name}`);
    } catch (error) {
      setMetaMessage(`Erro ao gerar com IA: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  async function handleRegenerateFrame(frame: StoryFrame) {
    if (!currentPayload || !currentJob?.result) return;

    setLoadingState(true, "Regenerando frame", `Os agentes estao recalculando o frame ${frame.index}.`);
    try {
      const regenerated = await createGeneration(currentPayload);
      const newFrame = regenerated.result?.pack.frames.find((item) => item.index === frame.index);
      if (!newFrame) return;
      setCurrentJob((current) => {
        if (!current?.result) return current;
        return {
          ...current,
          result: {
            ...current.result,
            pack: {
              ...current.result.pack,
              frames: current.result.pack.frames.map((item) => (item.index === frame.index ? { ...item, ...newFrame } : item)),
            },
          },
        };
      });
      setAiImagesByFrame((current) => {
        const next = { ...current };
        delete next[frame.index];
        return next;
      });
      setMetaMessage(`Frame ${frame.index} regenerado para nova aprovacao.`);
    } catch (error) {
      setMetaMessage(`Erro ao regenerar frame: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  async function handleDownloadFrame(frame: StoryFrame) {
    const aiImage = aiImagesByFrame[frame.index];
    try {
      setLoadingState(true, "Preparando download", `Montando PNG do frame ${frame.index}.`);
      if (aiImage) {
        const path = uploadPathFromUrl(aiImage.url);
        if (!path) throw new Error("Esta imagem ainda nao esta salva na biblioteca do sistema.");
        const blob = await downloadStoredAsset(path);
        triggerBlobDownload(blob, frameImageFileName(form.clientId, frame, "ia"));
        setMetaMessage(`Imagem IA do frame ${frame.index} baixada.`);
      } else {
        const canvas = await drawFrameToCanvas({ frame, imageUrl: imageUrlForFrame(frame), form });
        const blob = await canvasToPngBlob(canvas);
        triggerBlobDownload(blob, frameImageFileName(form.clientId, frame, "preview"));
        setMetaMessage(`Preview do frame ${frame.index} baixado. Para baixar a arte final, gere com IA primeiro.`);
      }
    } catch (error) {
      setMetaMessage(`Erro ao baixar PNG: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  async function handleDownloadAiPack() {
    if (!currentJob) {
      setMetaMessage("Gere um pacote antes de baixar as imagens.");
      return;
    }

    const urls = Object.values(aiImagesByFrame).map((image) => uploadPathFromUrl(image.url)).filter(Boolean);
    if (!urls.length) {
      setMetaMessage("Gere pelo menos uma imagem com IA antes de baixar o pacote.");
      return;
    }

    try {
      setLoadingState(true, "Preparando ZIP", "Compactando as imagens IA geradas.");
      const fileName = `${slugify(form.clientId)}-imagens-ia.zip`;
      const blob = await downloadAssetsZip(form.clientId, urls, fileName);
      triggerBlobDownload(blob, fileName);
      setMetaMessage("ZIP com imagens IA baixado.");
    } catch (error) {
      setMetaMessage(`Erro ao baixar imagens IA: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingState(false);
    }
  }

  function handleApprove() {
    if (!currentJob) {
      setMetaMessage("Gere um pacote antes de aprovar.");
      return;
    }
    setApproved(true);
    setMetaMessage("Pacote aprovado para producao/exportacao.");
  }

  function handleExportJson() {
    if (!currentJob) {
      setMetaMessage("Gere um pacote antes de exportar.");
      return;
    }

    const payload = {
      approved,
      exported_at: new Date().toISOString(),
      job: currentJob,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    triggerBlobDownload(blob, `${currentJob.client_id}-${currentJob.job_id}.json`);
    setMetaMessage("JSON exportado.");
  }

  const manualInsights = manualAsset ? (
    <>
      <p><strong>Leitura do manual:</strong> {manualAsset.notes}</p>
      <p><strong>Cores:</strong> {manualAsset.detected_colors?.length ? manualAsset.detected_colors.join(", ") : "nao detectadas automaticamente"}</p>
      <p><strong>Fontes:</strong> {manualAsset.detected_typography?.length ? manualAsset.detected_typography.join(", ") : "nao detectada automaticamente"}</p>
      <p><strong>Tom sugerido:</strong> {manualAsset.detected_tone || "nao detectado automaticamente"}</p>
    </>
  ) : activeClient ? (
    <>
      <p><strong>Manual sintetico:</strong> {activeClient.manual_status || "Manual sintetico provisiorio."}</p>
      {activeClient.instagram ? <p><strong>Instagram:</strong> {activeClient.instagram}</p> : null}
      <p><strong>Resumo visual:</strong> {activeClient.synthetic_manual || "Identidade provisoria criada pela OTG com base nas referencias disponiveis."}</p>
    </>
  ) : null;

  return (
    <>
      <main className="app-shell">
        <AppHeader activeClient={displayClient} restaurantName={form.restaurantName} onLoadHistory={() => void refreshHistory()} />

        <section className="content-grid">
          <BriefingPanel
            form={form}
            clients={clients}
            selectedClientId={selectedClientId}
            touched={touched}
            isBusy={isBusy}
            manualInsights={manualInsights}
            manualUploadStatus={manualUploadStatus}
            mediaUploadStatus={mediaUploadStatus}
            driveStatus={driveStatus}
            driveCatalogItems={driveCatalogItems}
            driveCatalogVisible={driveCatalogVisible}
            selectedDriveIds={selectedDriveIds}
            onSelectClient={applyClient}
            onSaveClient={saveCurrentClient}
            onChange={updateForm}
            onTouch={markTouched}
            isFieldDisabled={isFieldDisabled}
            onManualFilesChange={onManualFilesChange}
            onMediaFilesChange={onMediaFilesChange}
            onLoadDriveCatalog={handleLoadDriveCatalog}
            onImportDrive={handleImportDrive}
            onImportSelectedDrive={handleImportSelectedDrive}
            onLoadLocalMedia={handleLoadLocalMedia}
            onToggleDriveFile={toggleDriveFile}
            onSubmit={submitGeneration}
          />

          <ResultPanel
            currentJob={currentJob}
            approved={approved}
            metaMessage={metaMessage}
            aiImagesByFrame={aiImagesByFrame}
            imageUrlForFrame={imageUrlForFrame}
            form={form}
            usage={usage}
            history={history}
            onApprove={handleApprove}
            onExportJson={handleExportJson}
            onDownloadAiPack={handleDownloadAiPack}
            onGenerateAi={handleGenerateAi}
            onRegenerateFrame={handleRegenerateFrame}
            onDownloadFrame={handleDownloadFrame}
            isBusy={isBusy}
          />
        </section>
      </main>

      <LoadingTab active={loading.active} title={loading.title} detail={loading.detail} />

      <div className="floating-cta-bar" aria-label="Acao principal">
        <button type="submit" form="campaign-form" className="primary-action" disabled={isBusy || !formReady}>
          {isBusy ? "Produzindo postagem..." : "Gerar pacote de stories"}
        </button>
      </div>
    </>
  );
}

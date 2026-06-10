const API_BASE = "http://127.0.0.1:8000";

const form = document.getElementById("campaign-form");
const framesEl = document.getElementById("frames");
const traceEl = document.getElementById("trace");
const metaEl = document.getElementById("meta");
const usageEl = document.getElementById("usage");
const historyEl = document.getElementById("history");
const loadHistoryBtn = document.getElementById("load-history");
const approveBtn = document.getElementById("approve-pack");
const exportBtn = document.getElementById("export-pack");
const downloadAiPackBtn = document.getElementById("download-ai-pack");
const manualFileInput = document.getElementById("brand-manual-file");
const mediaFilesInput = document.getElementById("media-files");
const manualUploadStatus = document.getElementById("manual-upload-status");
const mediaUploadStatus = document.getElementById("media-upload-status");
const manualInsights = document.getElementById("manual-insights");
const importDriveBtn = document.getElementById("import-drive");
const driveStatusEl = document.getElementById("drive-status");
const loadDriveCatalogBtn = document.getElementById("load-drive-catalog");
const driveCatalogEl = document.getElementById("drive-catalog");
const importSelectedDriveBtn = document.getElementById("import-selected-drive");
const loadLocalMediaBtn = document.getElementById("load-local-media");
const clientSelect = document.getElementById("client-select");
const saveClientBtn = document.getElementById("save-client");
const restaurantNameInput = document.getElementById("restaurant-name");
const clientIdInput = document.getElementById("client-id");
const activeClientName = document.getElementById("active-client-name");
const clientRules = document.getElementById("client-rules");
const generateFixedBtn = document.getElementById("generate-fixed");
const loadingTab = document.getElementById("loading-tab");
const loadingTitle = document.getElementById("loading-title");
const loadingDetail = document.getElementById("loading-detail");

let currentJob = null;
let currentPayload = null;
let approved = false;
let manualAsset = null;
let mediaAssets = [];
let localImageUrls = [];
const aiImageUrlsByFrame = new Map();
const aiImageFilesByFrame = new Map();
let driveCatalogItems = [];
const CLIENTS_STORAGE_KEY = "otg_story_clients";
let isBusy = false;
let formSubmitted = false;

function clientNotes(items) {
  return items.join("\n");
}

const DEFAULT_CLIENTS = [
  {
    id: "heim",
    name: "Heim",
    city: "Porto Alegre",
    neighborhood: "",
    tone: "tradicional e acolhedor",
    color_palette: "#0B2A1E,#4598B2,#F0B05F",
    typography: "Dragon EF,Quiche Display",
    media_source_url: "https://drive.google.com/drive/folders/1iSIrPzJbNbl0II8AqSpEaKkIFTRzz9Na?usp=sharing",
    notes: "Heim e apenas delivery.\nFunciona a noite.\nNao mencionar almoco.\nNao mencionar salao, reserva, visita ou mesa no restaurante.",
    instagram: "@heimbyratskeller",
    manual_status: "Manual oficial anexavel. Regras operacionais ja validadas.",
    synthetic_manual: "Marca tradicional alema, delivery noturno, premium acolhedor, verde profundo, azul petroleo e dourado quente.",
  },
  {
    id: "churrascaria-santana",
    name: "Churrascaria Santana",
    city: "Porto Alegre",
    neighborhood: "Santana",
    tone: "familiar, tradicional e abundante",
    color_palette: "#7A1E16,#F2B544,#2B1A12,#FFF7E8",
    typography: "Bitter,Montserrat",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/site, nao em manual oficial.",
      "Instagram: @churrascariasantanapoa.",
      "Especialidade: churrascaria tradicional, grelhados, fartura e experiencia familiar.",
      "Tom de voz: direto, apetitoso, popular-premium e acolhedor.",
      "Direcao visual: fogo, carne na brasa, cortes suculentos, madeira, vermelho escuro, dourado quente e creme.",
      "Regras de IA: nao recriar logo, brasao, lettering ou fachada; aplicar apenas fotos reais e preservar marcas fotografadas sem redesenhar.",
      "Conteudo: evitar preco, horario, endereco e promocao agressiva sem briefing confirmado.",
    ]),
    instagram: "@churrascariasantanapoa",
    manual_status: "Manual sintetico provisiorio. Refinar com prints do Instagram ou manual oficial quando existir.",
    synthetic_manual: "Churrascaria classica de bairro, com linguagem de fartura, brasa, familia e tradicao gaucha.",
  },
  {
    id: "tomattis",
    name: "Tomattis",
    city: "Canoas",
    neighborhood: "Centro",
    tone: "versatil, familiar e convidativo",
    color_palette: "#B51F1A,#1F1F1F,#F6C247,#FFF3E0",
    typography: "Montserrat,Playfair Display",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/site, nao em manual oficial.",
      "Instagram: @instatommattis.",
      "Especialidade: restaurante com proposta ampla, rodizio, pizzas, massas e experiencia para grupos.",
      "Tom de voz: proximo, familiar, alegre e seguro.",
      "Direcao visual: comida em abundancia, mesa compartilhada, vermelho gastronomico, preto, dourado e creme.",
      "Regras de IA: nao recriar logo, selo ou lettering; usar fotos reais como base e nao inventar pratos fora do briefing.",
      "Conteudo: confirmar cidade, unidade, horario e modalidade antes de falar em reserva, rodizio ou delivery.",
    ]),
    instagram: "@instatommattis",
    manual_status: "Manual sintetico provisiorio. Precisa ser refinado com referencias visuais do perfil.",
    synthetic_manual: "Restaurante familiar e versatil, com energia de encontro, variedade e mesa farta.",
  },
  {
    id: "picanha-no-disco",
    name: "Picanha no Disco",
    city: "Porto Alegre",
    neighborhood: "Sao Geraldo",
    tone: "popular, objetivo e saboroso",
    color_palette: "#111111,#D32F23,#F5A623,#F6EFE3",
    typography: "Bebas Neue,Montserrat",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/site, nao em manual oficial.",
      "Instagram: @picanhanodiscopoa.",
      "Especialidade: picanha, comida de fogo, almoco forte e prato bem servido.",
      "Tom de voz: direto, apetitoso, popular e sem frescura.",
      "Direcao visual: chapa/disco, fumaca, carne cortada, textura, preto, vermelho, amarelo brasa e creme.",
      "Foco operacional conhecido: almoco e comida de prato. Nao mencionar jantar/noite sem briefing confirmado.",
      "Regras de IA: nao recriar logo, placa, selo ou lettering; preservar marcas fotografadas sem redesenhar.",
    ]),
    instagram: "@picanhanodiscopoa",
    manual_status: "Manual sintetico provisiorio. Validar funcionamento antes de campanhas noturnas.",
    synthetic_manual: "Marca popular de carne, brasa e prato farto, com foco em desejo imediato e almoco bem servido.",
  },
  {
    id: "pizzaria-venus",
    name: "Pizzaria Venus",
    city: "Porto Alegre",
    neighborhood: "Centro Historico",
    tone: "nostalgico, divertido e caloroso",
    color_palette: "#3B1C5A,#F6C443,#E84A3C,#FFF4D7",
    typography: "Cooper Black,Montserrat",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/site, nao em manual oficial.",
      "Instagram: @pizzariavenuspoa.",
      "Especialidade: pizzaria tradicional, pizza, encontro casual e apelo afetivo.",
      "Tom de voz: leve, divertido, nostalgico e apetitoso.",
      "Direcao visual: pizza quente, queijo puxando, universo Venus/cosmico quando fizer sentido, roxo, amarelo, vermelho e creme.",
      "Regras de IA: nao recriar logo, mascote, lettering ou elementos proprietarios; usar fotos reais e manter a pizza fiel.",
      "Conteudo: evitar preco, combo e promocao agressiva sem briefing confirmado.",
    ]),
    instagram: "@pizzariavenuspoa",
    manual_status: "Manual sintetico provisiorio. A paleta deve ser validada com prints do perfil.",
    synthetic_manual: "Pizzaria afetiva e tradicional, com possibilidade de linguagem cosmica leve ligada ao nome Venus.",
  },
  {
    id: "fornellone",
    name: "Fornellone",
    city: "Porto Alegre",
    neighborhood: "Petropolis/Auxiliadora",
    tone: "italiano, elegante e acolhedor",
    color_palette: "#74211D,#123527,#D7A84E,#FFF3DF",
    typography: "Cormorant Garamond,Montserrat",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/site, nao em manual oficial.",
      "Instagram: @fornellonepetropolis.",
      "Especialidade: gastronomia italiana, pizza, forno, vinho e experiencia de jantar.",
      "Tom de voz: elegante, acolhedor, gastronomico e sem exagero.",
      "Direcao visual: forno, massa, vinho, mesa posta, luz quente, vermelho vinho, verde profundo, dourado e creme.",
      "Perfil de experiencia noturna. Nao mencionar almoco sem briefing confirmado.",
      "Regras de IA: nao recriar logo, brasao, monograma, placa ou lettering; usar fotos reais e preservar marcas fotografadas.",
    ]),
    instagram: "@fornellonepetropolis",
    manual_status: "Manual sintetico provisiorio. Validar se unidade/bairro e proposta estao corretos antes de escalar.",
    synthetic_manual: "Italiano acolhedor, com clima de forno, vinho, jantar e restaurante de bairro premium.",
  },
  {
    id: "frango-na-brazza",
    name: "Frango na Brazza",
    city: "A confirmar",
    neighborhood: "",
    tone: "energetico, popular e apetitoso",
    color_palette: "#161616,#F2A51A,#D63B22,#FFF5E5",
    typography: "Bebas Neue,Montserrat",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/Linktree, nao em manual oficial.",
      "Instagram: @frangonabrazza.",
      "Especialidade: frango, brasa, porcoes e comida com apelo de desejo rapido.",
      "Cidade/unidade a confirmar; fontes publicas do handle apontam para MS, entao nao citar bairro ou cidade sem briefing.",
      "Tom de voz: direto, quente, jovem-popular e apetitoso.",
      "Direcao visual: fogo, frango dourado, crocancia, molho, preto, laranja brasa, vermelho e creme.",
      "Regras de IA: nao recriar logo, mascote, selo ou lettering; usar fotos reais e nao transformar o prato em outra categoria.",
      "Conteudo: confirmar modalidade, horario e unidade antes de mencionar delivery, retirada ou consumo no local.",
    ]),
    instagram: "@frangonabrazza",
    manual_status: "Manual sintetico provisiorio. Precisa de fotos do perfil para travar melhor a identidade.",
    synthetic_manual: "Marca de frango e brasa com energia forte, contraste alto e linguagem de fome imediata.",
  },
  {
    id: "limas-pizzaria",
    name: "Limas Pizzaria",
    city: "Porto Alegre",
    neighborhood: "Petropolis",
    tone: "familiar, generoso e descontraido",
    color_palette: "#B32018,#F4B83A,#1D1D1D,#FFF0D8",
    typography: "Montserrat,Bitter",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/site, nao em manual oficial.",
      "Instagram: @limaspizzaria304.",
      "Especialidade: pizzaria, rodizio, tele-entrega e variedade de sabores.",
      "Tom de voz: familiar, generoso, pratico e convidativo.",
      "Direcao visual: pizza em mesa, queijo, forno, familia, vermelho, amarelo, preto e creme.",
      "Atendimento forte a noite. Nao mencionar almoco sem briefing confirmado.",
      "Regras de IA: nao recriar logo, selo, placa ou lettering; usar fotos reais e preservar marcas fotografadas sem redesenhar.",
    ]),
    instagram: "@limaspizzaria304",
    manual_status: "Manual sintetico provisiorio. Validar horarios e oferta antes de falar em rodizio/delivery.",
    synthetic_manual: "Pizzaria familiar de bairro, com foco em variedade, rodizio, tele-entrega e desejo visual.",
  },
  {
    id: "bella-mama",
    name: "Bella Mama",
    city: "Porto Alegre",
    neighborhood: "Santana",
    tone: "italiano, familiar e tradicional",
    color_palette: "#0E5A3A,#B72218,#F2D6A2,#FFF7EA",
    typography: "Cormorant Garamond,Montserrat",
    media_source_url: "",
    notes: clientNotes([
      "Manual sintetico provisorio baseado em sinais publicos do Instagram/site, nao em manual oficial.",
      "Instagram: @galeteriabellamamma.",
      "Especialidade: galeteria, galeto, massas, comida italiana familiar e tradicao.",
      "Tom de voz: acolhedor, familiar, classico e afetivo.",
      "Direcao visual: mesa italiana, galeto, massa, toalha, verde, vermelho, creme e dourado suave.",
      "Regras de IA: nao recriar logo, brasao, selo ou lettering; aplicar fotos reais e preservar marcas fotografadas sem redesenhar.",
      "Conteudo: confirmar unidade, horario e modalidade antes de mencionar reserva, rodizio ou delivery.",
    ]),
    instagram: "@galeteriabellamamma",
    manual_status: "Manual sintetico provisiorio. Refinar com prints do perfil para fixar paleta e fontes.",
    synthetic_manual: "Galeteria italiana familiar, tradicional e afetiva, com linguagem de casa cheia e mesa farta.",
  },
];

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "restaurante";
}

function loadClients() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENTS_STORAGE_KEY) || "[]");
    const byId = new Map(DEFAULT_CLIENTS.map((client) => [client.id, client]));
    saved.forEach((client) => byId.set(client.id, client));
    return Array.from(byId.values());
  } catch {
    return DEFAULT_CLIENTS;
  }
}

function saveClients(clients) {
  localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fieldControls() {
  return Array.from(form.querySelectorAll("input, select, textarea"));
}

function fieldLabel(control) {
  return control.closest("label");
}

function shouldShowError(control) {
  return Boolean(control.required && !control.disabled && !control.value.trim() && (formSubmitted || control.dataset.touched === "true"));
}

function isRequiredControlEmpty(control) {
  return Boolean(control.required && !control.value.trim());
}

function formReady() {
  return !fieldControls().some((control) => control.required && !control.value.trim());
}

function updateFieldStates() {
  let lockRemaining = false;
  const controls = fieldControls();

  controls.forEach((control) => {
    const label = fieldLabel(control);
    if (!label) return;

    const shouldDisable = lockRemaining;
    control.disabled = shouldDisable || isBusy;

    label.classList.toggle("is-filled", Boolean(control.value && String(control.value).trim()));
    label.classList.toggle("is-error", shouldShowError(control));
    label.classList.toggle("is-disabled", control.disabled);

    if (!lockRemaining && isRequiredControlEmpty(control)) {
      lockRemaining = true;
    }
  });

  if (generateFixedBtn) {
    generateFixedBtn.disabled = isBusy || !formReady();
  }
}

function setLoading(active, title = "Produzindo postagem", detail = "Os agentes estao montando o criativo.") {
  isBusy = active;
  if (loadingTab) {
    loadingTab.hidden = !active;
  }
  if (loadingTitle) {
    loadingTitle.textContent = title;
  }
  if (loadingDetail) {
    loadingDetail.textContent = detail;
  }
  form.setAttribute("aria-busy", String(active));
  if (generateFixedBtn) {
    generateFixedBtn.textContent = active ? "Produzindo postagem..." : "Gerar pacote de stories";
  }
  updateFieldStates();
}

function markControlTouched(event) {
  event.currentTarget.dataset.touched = "true";
  updateFieldStates();
}

function currentClientFromForm() {
  const savedClient = loadClients().find((client) => client.id === clientSelect.value) || {};
  return {
    id: clientIdInput.value.trim() || slugify(restaurantNameInput.value),
    name: restaurantNameInput.value.trim() || "Restaurante",
    city: form.elements.city.value,
    neighborhood: form.elements.neighborhood.value,
    tone: form.elements.tone_of_voice.value,
    color_palette: form.elements.color_palette.value,
    typography: form.elements.typography.value,
    media_source_url: form.elements.media_source_url.value,
    notes: form.elements.client_notes.value,
    instagram: savedClient.instagram || "",
    manual_status: savedClient.manual_status || "Manual salvo manualmente pela OTG.",
    synthetic_manual: savedClient.synthetic_manual || "",
  };
}

function renderClientOptions(selectedId = "heim") {
  const clients = loadClients();
  clientSelect.innerHTML = clients
    .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`)
    .join("");
  clientSelect.value = clients.some((client) => client.id === selectedId) ? selectedId : clients[0]?.id;
}

function renderClientRules(notes) {
  const rules = splitLines(notes).slice(0, 5);
  clientRules.innerHTML = (rules.length ? rules : ["Sem observacoes especificas"])
    .map((rule) => `<span>${escapeHtml(rule.replace(/^nao mencionar/i, "Sem"))}</span>`)
    .join("");
}

function renderSyntheticManual(client) {
  if (manualAsset) return;
  if (!client.synthetic_manual && !client.manual_status && !client.instagram) {
    manualInsights.innerHTML = "";
    return;
  }

  const instagram = client.instagram ? `<p><strong>Instagram:</strong> ${escapeHtml(client.instagram)}</p>` : "";
  const status = client.manual_status || "Manual sintetico provisiorio.";
  const summary = client.synthetic_manual || "Identidade provisoria criada pela OTG com base nas referencias disponiveis.";
  manualInsights.innerHTML = `
    <p><strong>Manual sintetico:</strong> ${escapeHtml(status)}</p>
    ${instagram}
    <p><strong>Resumo visual:</strong> ${escapeHtml(summary)}</p>
  `;
}

function resetClientAssets() {
  manualAsset = null;
  mediaAssets = [];
  driveCatalogItems = [];
  localImageUrls.forEach((url) => URL.revokeObjectURL(url));
  localImageUrls = [];
  aiImageUrlsByFrame.clear();
  aiImageFilesByFrame.clear();
  manualFileInput.value = "";
  mediaFilesInput.value = "";
  manualUploadStatus.textContent = "";
  mediaUploadStatus.textContent = "";
  manualInsights.innerHTML = "";
  if (driveCatalogEl) {
    driveCatalogEl.hidden = true;
    driveCatalogEl.innerHTML = "";
  }
  updateDriveSelectionState();
}

function applyClient(client) {
  restaurantNameInput.value = client.name;
  clientIdInput.value = client.id;
  form.elements.city.value = client.city || "Porto Alegre";
  form.elements.neighborhood.value = client.neighborhood || "";
  form.elements.tone_of_voice.value = client.tone || "tradicional e acolhedor";
  form.elements.color_palette.value = client.color_palette || "#0B2A1E,#4598B2,#F0B05F";
  form.elements.typography.value = client.typography || "Dragon EF,Quiche Display";
  form.elements.media_source_url.value = client.media_source_url || "";
  form.elements.client_notes.value = client.notes || "";
  activeClientName.textContent = client.name;
  renderClientRules(client.notes || "");
  renderSyntheticManual(client);
  updateFieldStates();
}

function assetUrl(asset) {
  if (!asset?.url) return "";
  if (asset.url.startsWith("http")) return asset.url;
  return `${API_BASE}${asset.url}`;
}

function imageUrlForFrame(frameIndex) {
  if (localImageUrls.length) {
    return localImageUrls[(frameIndex - 1) % localImageUrls.length];
  }

  const imageAssets = mediaAssets.filter((asset) => asset.file_type?.startsWith("image/") && asset.url);
  if (!imageAssets.length) return "";
  return assetUrl(imageAssets[(frameIndex - 1) % imageAssets.length]);
}

function imageUrlForFrameData(frame) {
  if (localImageUrls.length) {
    return localImageUrls[(frame.index - 1) % localImageUrls.length];
  }

  const imageAssets = mediaAssets.filter((asset) => asset.file_type?.startsWith("image/") && asset.url);
  if (!imageAssets.length) return "";

  const selected = imageAssets.find((asset) => asset.asset_id === frame.media_asset_id);
  return assetUrl(selected || imageAssets[(frame.index - 1) % imageAssets.length]);
}

function imageUrlForFrameOutput(frame) {
  return aiImageUrlsByFrame.get(frame.index) || imageUrlForFrameData(frame);
}

function uploadPathFromUrl(imageUrl) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith(API_BASE)) return imageUrl.slice(API_BASE.length);
  if (imageUrl.startsWith("/uploads/")) return imageUrl;
  return "";
}

function frameImageFileName(frame, kind = "preview") {
  const suffix = kind === "ia" ? "ia" : "preview";
  const frameNumber = String(frame.index).padStart(2, "0");
  return `${slugify(getClientId())}-story-${frameNumber}-${suffix}.png`;
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadStoredImage(imageUrl, fileName) {
  const uploadPath = uploadPathFromUrl(imageUrl);
  if (!uploadPath) {
    throw new Error("Esta imagem ainda nao esta salva na biblioteca do sistema.");
  }

  const response = await fetch(`${API_BASE}/v1/assets/download?url=${encodeURIComponent(uploadPath)}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Falha ao baixar imagem (${response.status}): ${message}`);
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, fileName);
}

async function downloadAiImagesZip() {
  const frames = currentJob?.result?.pack?.frames || [];
  const urls = frames
    .map((frame) => uploadPathFromUrl(aiImageUrlsByFrame.get(frame.index)))
    .filter(Boolean);

  if (!urls.length) {
    throw new Error("Gere pelo menos uma imagem com IA antes de baixar o pacote.");
  }

  const response = await fetch(`${API_BASE}/v1/assets/download-zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getClientId(),
      urls,
      file_name: `${slugify(getClientId())}-imagens-ia.zip`,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Falha ao baixar ZIP (${response.status}): ${message}`);
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, `${slugify(getClientId())}-imagens-ia.zip`);
}

function splitCSV(v) {
  return String(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitLines(v) {
  return String(v)
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function getClientId() {
  return clientIdInput.value.trim() || new FormData(form).get("client_id");
}

function buildPayload() {
  const fd = new FormData(form);
  const restaurantName = fd.get("restaurant_name");
  const manualColors = manualAsset?.detected_colors?.length
    ? manualAsset.detected_colors
    : splitCSV(fd.get("color_palette"));
  const manualTypography = manualAsset?.detected_typography?.length
    ? manualAsset.detected_typography
    : splitCSV(fd.get("typography"));
  const manualTone = manualAsset?.detected_tone || fd.get("tone_of_voice");
  return {
    client_id: fd.get("client_id"),
    campaign: {
      restaurant_name: restaurantName,
      objective: fd.get("objective"),
      offer: fd.get("offer"),
      cta: fd.get("cta"),
      story_type: fd.get("story_type"),
      output_format: fd.get("output_format"),
      frames: Number(fd.get("frames")),
      manual: {
        brand_name: restaurantName,
        tone_of_voice: manualTone,
        color_palette: manualColors,
        typography: manualTypography,
        forbidden_elements: splitLines(fd.get("client_notes")),
        city: fd.get("city"),
        neighborhood: fd.get("neighborhood"),
        manual_asset: manualAsset,
        manual_summary: manualAsset?.extracted_text_preview || (manualAsset ? `Manual enviado: ${manualAsset.file_name}` : null),
      },
      media_assets: mediaAssets,
      media_source_url: fd.get("media_source_url"),
    },
  };
}

function renderManualInsights(asset) {
  if (!asset) {
    manualInsights.innerHTML = "";
    return;
  }

  const colors = asset.detected_colors?.length ? asset.detected_colors.join(", ") : "nao detectadas automaticamente";
  const typography = asset.detected_typography?.length ? asset.detected_typography.join(", ") : "nao detectada automaticamente";
  const tone = asset.detected_tone || "nao detectado automaticamente";

  manualInsights.innerHTML = `
    <p><strong>Leitura do manual:</strong> ${escapeHtml(asset.notes)}</p>
    <p><strong>Cores:</strong> ${escapeHtml(colors)}</p>
    <p><strong>Fontes:</strong> ${escapeHtml(typography)}</p>
    <p><strong>Tom sugerido:</strong> ${escapeHtml(tone)}</p>
  `;
}

async function uploadFiles(role, files) {
  const clientId = getClientId();
  if (!clientId || !files.length) return [];

  const body = new FormData();
  body.append("client_id", clientId);
  body.append("role", role);
  Array.from(files).forEach((file) => body.append("files", file));

  const response = await fetch(`${API_BASE}/v1/assets/upload`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar arquivo (${response.status})`);
  }

  const data = await response.json();
  return data.items;
}

async function createGeneration(payload) {
  const response = await fetch(`${API_BASE}/v1/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Falha HTTP ${response.status}: ${message}`);
  }
  return response.json();
}

async function loadDriveStatus() {
  if (!driveStatusEl) return;
  driveStatusEl.textContent = "Verificando conexao com Google Drive...";
  driveStatusEl.className = "drive-status";

  try {
    const response = await fetch(`${API_BASE}/v1/drive/status`);
    if (!response.ok) {
      throw new Error(`Falha HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.configured) {
      driveStatusEl.classList.add("connected");
      driveStatusEl.textContent = data.service_account_email
        ? `Drive API conectada: compartilhe pastas com ${data.service_account_email}`
        : "Drive API conectada. Compartilhe as pastas dos clientes com a service account.";
    } else {
      driveStatusEl.classList.add("pending");
      driveStatusEl.textContent = "Modo publico/manual ativo. Drive privado fica para depois; por enquanto use pasta publica ou upload manual.";
    }
  } catch (error) {
    driveStatusEl.classList.add("pending");
    driveStatusEl.textContent = `Nao consegui verificar o Drive: ${error.message}`;
  }
}

async function generateAiImage(frame, sourceImageUrl) {
  const response = await fetch(`${API_BASE}/v1/ai-images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getClientId(),
      source_image_url: sourceImageUrl.replace(API_BASE, ""),
      headline: frame.headline,
      body: frame.body,
      cta: frame.cta,
      visual_direction: frame.visual_direction,
      layout_style: frame.layout_style,
      output_format: currentPayload?.campaign?.output_format || "stories",
      quality: "medium",
      restaurant_name: currentPayload?.campaign?.restaurant_name || restaurantNameInput.value,
      color_palette: currentPayload?.campaign?.manual?.color_palette || [],
      operational_notes: currentPayload?.campaign?.manual?.forbidden_elements || [],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  return response.json();
}

function formatDriveSize(bytes) {
  if (!bytes) return "tamanho nao informado";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDriveDate(value) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function selectedDriveFileIds() {
  if (!driveCatalogEl) return [];
  return Array.from(driveCatalogEl.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value);
}

function updateDriveSelectionState() {
  const count = selectedDriveFileIds().length;
  if (importSelectedDriveBtn) {
    importSelectedDriveBtn.disabled = count === 0;
    importSelectedDriveBtn.textContent = count
      ? `Importar ${count} selecionada(s)`
      : "Importar selecionadas";
  }
}

function renderDriveCatalog(items) {
  driveCatalogItems = items;
  if (!driveCatalogEl) return;

  driveCatalogEl.hidden = false;
  if (!items.length) {
    driveCatalogEl.innerHTML = "<p class=\"drive-file-meta\">Nenhuma imagem ou video encontrado nessa pasta.</p>";
    updateDriveSelectionState();
    return;
  }

  driveCatalogEl.innerHTML = items
    .map((item) => {
      const isImage = item.mime_type?.startsWith("image/");
      const thumbnail = item.thumbnail_url && isImage
        ? `<img src="${escapeHtml(item.thumbnail_url)}" alt="">`
        : `<span>${isImage ? "IMG" : "VID"}</span>`;
      const folder = item.folder_path?.length ? `${item.folder_path.join(" / ")} · ` : "";
      return `
        <label class="drive-catalog-item">
          <input type="checkbox" value="${escapeHtml(item.drive_file_id)}" />
          <span class="drive-thumb">${thumbnail}</span>
          <span>
            <span class="drive-file-name">${escapeHtml(item.name)}</span>
            <span class="drive-file-meta">${escapeHtml(folder)}${escapeHtml(formatDriveSize(item.size_bytes))} · ${escapeHtml(formatDriveDate(item.modified_time))}</span>
          </span>
        </label>
      `;
    })
    .join("");
  updateDriveSelectionState();
}

function previewSize() {
  const format = currentPayload?.campaign?.output_format;
  return format === "carrossel" ? { width: 1080, height: 1350 } : { width: 1080, height: 1920 };
}

function fitImage(ctx, image, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

function applyOverlay(ctx, color, alpha, width, height) {
  ctx.fillStyle = color.replace(")", `, ${alpha})`).replace("rgb(", "rgba(");
  ctx.fillRect(0, 0, width, height);
}

async function drawFrameToCanvas(frame, imageUrl) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const { width, height } = previewSize();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const colors = currentPayload?.campaign?.manual?.color_palette || ["#0B2A1E", "#4598B2", "#F0B05F"];

  const primary = colors[0] || "#0B2A1E";
  const secondary = colors[1] || "#4598B2";
  const accent = colors[2] || "#F0B05F";
  const layout = frame.layout_style || "editorial";
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(1, secondary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (imageUrl) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
    fitImage(ctx, image, width, height);
  }

  if (layout === "split") {
    ctx.fillStyle = primary;
    ctx.fillRect(0, height * 0.58, width, height * 0.42);
    ctx.fillStyle = accent;
    ctx.fillRect(72, height * 0.58, 180, 12);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 72px Sora";
    wrapText(ctx, frame.headline, 72, height * 0.68, width - 144, 82);
  } else if (layout === "sticker") {
    ctx.fillStyle = "rgba(11, 42, 30, 0.34)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(72, height * 0.56, width - 144, 250, 42);
    ctx.fill();
    ctx.fillStyle = primary;
    ctx.font = "800 68px Sora";
    wrapText(ctx, frame.headline, 112, height * 0.65, width - 224, 76);
  } else if (layout === "full_bleed") {
    ctx.fillStyle = "rgba(11, 42, 30, 0.46)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(52, 52, width - 104, height - 104);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 86px Sora";
    wrapText(ctx, frame.headline, 82, height * 0.52, width - 164, 96);
  } else if (layout === "quote") {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, width, height);
    if (imageUrl) {
      ctx.globalAlpha = 0.38;
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = accent;
    ctx.font = "800 140px Sora";
    ctx.fillText("“", 72, 230);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 76px Sora";
    wrapText(ctx, frame.headline, 92, height * 0.36, width - 184, 88);
  } else if (layout === "save_card") {
    ctx.fillStyle = "rgba(11, 42, 30, 0.52)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(72, height * 0.5, width - 144, 320, 34);
    ctx.fill();
    ctx.fillStyle = primary;
    ctx.font = "800 74px Sora";
    wrapText(ctx, frame.headline, 112, height * 0.61, width - 224, 82);
  } else {
    ctx.fillStyle = "rgba(11, 42, 30, 0.50)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(72, 72, 160, 12);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 82px Sora";
    wrapText(ctx, frame.headline, 72, height * 0.55, width - 144, 92);
  }

  ctx.font = "400 38px Sora";
  ctx.fillStyle = "#fff7ea";
  wrapText(ctx, frame.body.replace(/Selecionar uma midia.*$/, "").replace(/Usar a midia real.*$/, "").trim(), 72, height - 300, width - 144, 48);

  ctx.fillStyle = "rgba(255, 253, 248, 0.92)";
  ctx.beginPath();
  ctx.roundRect(96, height - 190, width - 192, 96, 44);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = primary;
  ctx.font = "800 38px Sora";
  wrapText(ctx, frame.cta, 132, height - 130, width - 264, 44);

  return canvas;
}

async function downloadFrame(frame, imageUrl) {
  const canvas = await drawFrameToCanvas(frame, imageUrl);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Nao foi possivel montar o PNG deste frame."));
      }
    }, "image/png");
  });
  triggerBlobDownload(blob, frameImageFileName(frame, "preview"));
}

function renderPack(job) {
  const pack = job.result.pack;
  approved = false;
  approveBtn.textContent = "Aprovar pacote";
  metaEl.classList.remove("empty-state");

  metaEl.innerHTML = `
    <div class="job-summary">
      <div><span>Cliente</span><strong>${escapeHtml(job.client_id)}</strong></div>
      <div><span>Marca</span><strong>${escapeHtml(pack.restaurant_name)}</strong></div>
      <div><span>Custo</span><strong>R$ ${job.estimated_cost_brl.toFixed(2)}</strong></div>
      <div><span>Scores</span><strong>${pack.brand_score} / ${pack.performance_score}</strong></div>
    </div>
    <p class="rationale">${escapeHtml(pack.rationale)}</p>
  `;

  framesEl.innerHTML = "";
  pack.frames.forEach((frame) => {
    const hasAiImage = aiImageUrlsByFrame.has(frame.index);
    const aiFileName = aiImageFilesByFrame.get(frame.index);
    const imageUrl = imageUrlForFrameOutput(frame);
    const layoutClass = frame.layout_style || "editorial";
    const previewBackground = imageUrl
      ? `background-image: ${hasAiImage ? "" : "linear-gradient(rgba(11,42,30,.38), rgba(11,42,30,.38)), "}url('${imageUrl}')`
      : "";
    const card = document.createElement("article");
    card.className = "frame";
    card.innerHTML = `
      <div class="frame-header">
        <h4>Frame ${String(frame.index).padStart(2, "0")}</h4>
        ${hasAiImage ? `<div class="status-pill" title="${escapeHtml(aiFileName || "")}">IA pronta</div>` : ""}
      </div>
      <div class="creative-preview ${layoutClass} ${hasAiImage ? "ai-final-preview" : ""}" style="${previewBackground}">
        ${hasAiImage ? "" : `<span>${escapeHtml(frame.headline)}</span>`}
      </div>
      <div class="frame-copy">
        <p><strong>Headline:</strong> ${escapeHtml(frame.headline)}</p>
        <p>${escapeHtml(frame.body)}</p>
        <p><strong>Chamada organica:</strong> ${escapeHtml(frame.cta)}</p>
        <p><strong>Midia:</strong> ${escapeHtml(frame.media_file_name || "sem midia selecionada")}</p>
        <p><strong>Layout:</strong> ${escapeHtml(frame.layout_style)} · <strong>Visual:</strong> ${escapeHtml(frame.visual_direction)}</p>
      </div>
      <div class="frame-actions">
        <button type="button" class="ai-generate" data-frame="${frame.index}">Gerar com IA</button>
        <button type="button" class="ghost regen" data-frame="${frame.index}">Regenerar</button>
        <button type="button" class="ghost download-frame" data-frame="${frame.index}">${hasAiImage ? "Baixar IA" : "Baixar preview"}</button>
      </div>
    `;
    framesEl.appendChild(card);
  });

  traceEl.innerHTML = "";
  job.result.trace.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = `${step.name}: ${step.output_summary}`;
    traceEl.appendChild(item);
  });
}

async function importDriveAssets() {
  const fd = new FormData(form);
  const folderUrl = fd.get("media_source_url");
  if (!folderUrl) {
    mediaUploadStatus.textContent = "Cole o link da pasta do Google Drive antes de importar.";
    return;
  }

  importDriveBtn.textContent = "Importando...";
  importDriveBtn.disabled = true;
  mediaUploadStatus.textContent = "Acessando a pasta do Drive e importando imagens/videos...";

  try {
    const response = await fetch(`${API_BASE}/v1/assets/import-drive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: getClientId(),
        folder_url: folderUrl,
        max_files: 12,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message);
    }

    const data = await response.json();
    mediaAssets = data.items;
    localImageUrls.forEach((url) => URL.revokeObjectURL(url));
    localImageUrls = [];
    mediaUploadStatus.textContent = `${mediaAssets.length} midia(s) importada(s) do Drive e prontas para usar.`;
  } catch (error) {
    mediaUploadStatus.textContent = `Erro ao buscar Drive: ${error.message}`;
  } finally {
    importDriveBtn.textContent = "Importar primeiras 12";
    importDriveBtn.disabled = false;
  }
}

async function loadDriveCatalog() {
  const fd = new FormData(form);
  const folderUrl = fd.get("media_source_url");
  if (!folderUrl) {
    mediaUploadStatus.textContent = "Cole o link da pasta do Google Drive antes de ver o catalogo.";
    return;
  }

  loadDriveCatalogBtn.textContent = "Lendo Drive...";
  loadDriveCatalogBtn.disabled = true;
  mediaUploadStatus.textContent = "Listando arquivos do Drive sem baixar as pastas...";

  try {
    const response = await fetch(`${API_BASE}/v1/drive/catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_url: folderUrl,
        max_files: 120,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message);
    }

    const data = await response.json();
    renderDriveCatalog(data.items);
    mediaUploadStatus.textContent = `${data.items.length} arquivo(s) encontrados no Drive. Marque so os que quer trazer para a biblioteca.`;
  } catch (error) {
    mediaUploadStatus.textContent = `Erro ao listar catalogo do Drive: ${error.message}`;
  } finally {
    loadDriveCatalogBtn.textContent = "Ver catalogo do Drive";
    loadDriveCatalogBtn.disabled = false;
  }
}

async function importSelectedDriveAssets() {
  const fileIds = selectedDriveFileIds();
  if (!fileIds.length) {
    mediaUploadStatus.textContent = "Selecione pelo menos uma imagem ou video no catalogo.";
    return;
  }

  importSelectedDriveBtn.disabled = true;
  importSelectedDriveBtn.textContent = "Importando selecionadas...";
  mediaUploadStatus.textContent = "Baixando apenas os arquivos selecionados para a biblioteca do cliente...";

  try {
    const response = await fetch(`${API_BASE}/v1/assets/import-drive-selected`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: getClientId(),
        file_ids: fileIds,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message);
    }

    const data = await response.json();
    mediaAssets = [...mediaAssets, ...data.items];
    localImageUrls.forEach((url) => URL.revokeObjectURL(url));
    localImageUrls = [];
    mediaUploadStatus.textContent = `${data.items.length} arquivo(s) selecionado(s) importado(s). Biblioteca atual: ${mediaAssets.length} midia(s).`;
  } catch (error) {
    mediaUploadStatus.textContent = `Erro ao importar selecionadas: ${error.message}`;
  } finally {
    updateDriveSelectionState();
  }
}

async function loadLocalMediaAssets() {
  loadLocalMediaBtn.textContent = "Carregando...";
  loadLocalMediaBtn.disabled = true;
  mediaUploadStatus.textContent = "Buscando midias ja importadas deste restaurante...";

  try {
    const response = await fetch(`${API_BASE}/v1/clients/${getClientId()}/assets?role=media`);
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message);
    }
    const data = await response.json();
    mediaAssets = data.items;
    localImageUrls.forEach((url) => URL.revokeObjectURL(url));
    localImageUrls = [];
    mediaUploadStatus.textContent = `${mediaAssets.length} midia(s) local(is) encontrada(s).`;
  } catch (error) {
    mediaUploadStatus.textContent = `Erro ao carregar midias locais: ${error.message}`;
  } finally {
    loadLocalMediaBtn.textContent = "Usar midias importadas";
    loadLocalMediaBtn.disabled = false;
  }
}

async function loadHistory() {
  const clientId = getClientId();
  if (!clientId) return;

  const [jobsRes, usageRes] = await Promise.all([
    fetch(`${API_BASE}/v1/clients/${clientId}/generations`),
    fetch(`${API_BASE}/v1/clients/${clientId}/usage`),
  ]);

  if (!jobsRes.ok || !usageRes.ok) {
    throw new Error("Nao foi possivel carregar historico deste cliente");
  }

  const jobsData = await jobsRes.json();
  const usage = await usageRes.json();

  usageEl.innerHTML = `
    <p><strong>Total de jobs:</strong> ${usage.total_jobs}</p>
    <p><strong>Concluidos:</strong> ${usage.completed_jobs}</p>
    <p><strong>Custo estimado acumulado:</strong> R$ ${usage.estimated_total_cost_brl.toFixed(2)}</p>
  `;

  historyEl.innerHTML = "";
  jobsData.items.slice(0, 8).forEach((job) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${job.status}</strong> - ${job.job_id} - R$ ${job.estimated_cost_brl.toFixed(2)}`;
    historyEl.appendChild(item);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formSubmitted = true;
  updateFieldStates();

  if (!formReady()) {
    metaEl.classList.add("empty-state");
    metaEl.textContent = "Preencha os campos obrigatorios em ordem para liberar a geracao.";
    return;
  }

  framesEl.innerHTML = "";
  traceEl.innerHTML = "";
  metaEl.classList.remove("empty-state");
  metaEl.textContent = "Preparando briefing...";

  try {
    if (manualFileInput.files.length) {
      manualUploadStatus.textContent = "Enviando manual...";
      const uploadedManual = await uploadFiles("manual", manualFileInput.files);
      manualAsset = uploadedManual[0] || null;
      manualUploadStatus.textContent = manualAsset ? `Manual recebido: ${manualAsset.file_name}` : "";
      renderManualInsights(manualAsset);
    }

    if (mediaFilesInput.files.length) {
      mediaUploadStatus.textContent = "Enviando fotos e videos...";
      localImageUrls.forEach((url) => URL.revokeObjectURL(url));
      localImageUrls = Array.from(mediaFilesInput.files)
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => URL.createObjectURL(file));
      mediaAssets = await uploadFiles("media", mediaFilesInput.files);
      mediaUploadStatus.textContent = `${mediaAssets.length} midia(s) recebida(s).`;
    }

    const payload = buildPayload();
    currentPayload = payload;
    aiImageUrlsByFrame.clear();
    aiImageFilesByFrame.clear();
    setLoading(true, "Produzindo postagem", "Briefing validado. Os agentes estao criando a pre-aprovacao visual.");
    const job = await createGeneration(payload);
    setLoading(false);
    currentJob = job;
    renderPack(job);
    await loadHistory();
  } catch (error) {
    setLoading(false);
    metaEl.textContent = `Erro ao gerar: ${error.message}`;
  }
});

loadHistoryBtn.addEventListener("click", async () => {
  usageEl.textContent = "Carregando...";
  historyEl.innerHTML = "";
  try {
    await loadHistory();
  } catch (error) {
    usageEl.textContent = `Erro: ${error.message}`;
  }
});

importDriveBtn.addEventListener("click", importDriveAssets);
loadDriveCatalogBtn.addEventListener("click", loadDriveCatalog);
importSelectedDriveBtn.addEventListener("click", importSelectedDriveAssets);
driveCatalogEl.addEventListener("change", updateDriveSelectionState);
loadLocalMediaBtn.addEventListener("click", loadLocalMediaAssets);

clientSelect.addEventListener("change", () => {
  const client = loadClients().find((item) => item.id === clientSelect.value);
  if (client) {
    resetClientAssets();
    applyClient(client);
    metaEl.classList.add("empty-state");
    metaEl.textContent = `Cliente ativo: ${client.name}. Carregue as midias deste restaurante para gerar o pacote.`;
    framesEl.innerHTML = "";
    traceEl.innerHTML = "";
    usageEl.innerHTML = "";
    historyEl.innerHTML = "";
    currentJob = null;
    currentPayload = null;
  }
});

restaurantNameInput.addEventListener("input", () => {
  activeClientName.textContent = restaurantNameInput.value || "Novo restaurante";
  if (!clientIdInput.dataset.touched) {
    clientIdInput.value = slugify(restaurantNameInput.value);
  }
  updateFieldStates();
});

clientIdInput.addEventListener("input", () => {
  clientIdInput.dataset.touched = "true";
  updateFieldStates();
});

form.elements.client_notes.addEventListener("input", () => {
  renderClientRules(form.elements.client_notes.value);
  updateFieldStates();
});

saveClientBtn.addEventListener("click", () => {
  const client = currentClientFromForm();
  const clients = loadClients().filter((item) => item.id !== client.id);
  clients.push(client);
  clients.sort((a, b) => a.name.localeCompare(b.name));
  saveClients(clients);
  renderClientOptions(client.id);
  applyClient(client);
  metaEl.textContent = `Restaurante salvo: ${client.name}.`;
  updateFieldStates();
});

approveBtn.addEventListener("click", () => {
  if (!currentJob) {
    metaEl.textContent = "Gere um pacote antes de aprovar.";
    return;
  }
  approved = true;
  approveBtn.textContent = "Pacote aprovado";
});

exportBtn.addEventListener("click", () => {
  if (!currentJob) {
    metaEl.textContent = "Gere um pacote antes de exportar.";
    return;
  }

  const payload = {
    approved,
    exported_at: new Date().toISOString(),
    job: currentJob,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${currentJob.client_id}-${currentJob.job_id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

downloadAiPackBtn.addEventListener("click", async () => {
  if (!currentJob) {
    metaEl.textContent = "Gere um pacote antes de baixar as imagens.";
    return;
  }

  try {
    downloadAiPackBtn.textContent = "Preparando ZIP...";
    downloadAiPackBtn.disabled = true;
    await downloadAiImagesZip();
    metaEl.textContent = "ZIP com imagens IA baixado.";
  } catch (error) {
    metaEl.textContent = `Erro ao baixar imagens IA: ${error.message}`;
  } finally {
    downloadAiPackBtn.textContent = "Baixar imagens IA";
    downloadAiPackBtn.disabled = false;
  }
});

framesEl.addEventListener("click", async (event) => {
  const aiButton = event.target.closest("button.ai-generate");
  if (aiButton && currentJob) {
    const frameNumber = Number(aiButton.getAttribute("data-frame"));
    const frame = currentJob.result.pack.frames.find((item) => item.index === frameNumber);
    const sourceImageUrl = frame ? imageUrlForFrameData(frame) : "";

    if (!frame || !sourceImageUrl) {
      metaEl.textContent = "Esse frame ainda nao tem uma imagem real vinculada.";
      return;
    }

    try {
      aiButton.textContent = "Gerando IA...";
      aiButton.disabled = true;
      setLoading(true, "Gerando imagem com IA", `Frame ${frame.index} em producao com gpt-image-2.`);
      const result = await generateAiImage(frame, sourceImageUrl);
      aiImageUrlsByFrame.set(frame.index, `${API_BASE}${result.image_url}`);
      aiImageFilesByFrame.set(frame.index, result.file_name);
      renderPack(currentJob);
      metaEl.innerHTML = `<p><strong>Imagem com IA gerada:</strong> ${result.file_name}</p>`;
    } catch (error) {
      metaEl.textContent = `Erro ao gerar com IA: ${error.message}`;
    } finally {
      setLoading(false);
      aiButton.textContent = "Gerar com IA";
      aiButton.disabled = false;
    }
    return;
  }

  const downloadButton = event.target.closest("button.download-frame");
  if (downloadButton && currentJob) {
    const frameNumber = Number(downloadButton.getAttribute("data-frame"));
    const frame = currentJob.result.pack.frames.find((item) => item.index === frameNumber);
    const aiImageUrl = frame ? aiImageUrlsByFrame.get(frame.index) : "";
    const previewImageUrl = frame ? imageUrlForFrameData(frame) : "";
    if (frame) {
      try {
        downloadButton.textContent = "Baixando...";
        downloadButton.disabled = true;
        if (aiImageUrl) {
          await downloadStoredImage(aiImageUrl, frameImageFileName(frame, "ia"));
          metaEl.textContent = `Imagem IA do frame ${frame.index} baixada.`;
        } else {
          await downloadFrame(frame, previewImageUrl);
          metaEl.textContent = `Preview do frame ${frame.index} baixado. Para baixar a arte final, gere com IA primeiro.`;
        }
      } catch (error) {
        metaEl.textContent = `Erro ao baixar PNG: ${error.message}`;
      } finally {
        downloadButton.textContent = aiImageUrl ? "Baixar IA" : "Baixar preview";
        downloadButton.disabled = false;
      }
    }
    return;
  }

  const button = event.target.closest("button.regen");
  if (!button || !currentPayload || !currentJob) {
    return;
  }

  const frameNumber = Number(button.getAttribute("data-frame"));
  button.textContent = "Regenerando...";
  button.disabled = true;
  setLoading(true, "Regenerando frame", `Os agentes estao recalculando o frame ${frameNumber}.`);

  try {
    const regenerated = await createGeneration(currentPayload);
    const newFrame = regenerated.result.pack.frames.find((f) => f.index === frameNumber);
    const currentFrame = currentJob.result.pack.frames.find((f) => f.index === frameNumber);

    if (newFrame && currentFrame) {
      currentFrame.headline = newFrame.headline;
      currentFrame.body = newFrame.body;
      currentFrame.cta = newFrame.cta;
      currentFrame.visual_direction = newFrame.visual_direction;
      renderPack(currentJob);
    }
  } catch (error) {
    metaEl.textContent = `Erro ao regenerar frame: ${error.message}`;
  } finally {
    setLoading(false);
    button.textContent = "Regenerar";
    button.disabled = false;
  }
});

fieldControls().forEach((control) => {
  const label = fieldLabel(control);
  if (label) {
    label.classList.add("field-control");
  }

  control.addEventListener("focus", () => {
    fieldLabel(control)?.classList.add("is-focused");
  });

  control.addEventListener("blur", (event) => {
    fieldLabel(control)?.classList.remove("is-focused");
    markControlTouched(event);
  });

  control.addEventListener("input", updateFieldStates);
  control.addEventListener("change", markControlTouched);
});

renderClientOptions("heim");
applyClient(loadClients().find((client) => client.id === clientSelect.value) || DEFAULT_CLIENTS[0]);
updateFieldStates();
loadDriveStatus();

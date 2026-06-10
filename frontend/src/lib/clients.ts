import type { CampaignFormState, ClientProfile } from "../types";
import { clientNotes, formDefaults } from "./utils";

export const CLIENTS_STORAGE_KEY = "otg_story_clients";

export const DEFAULT_CLIENTS: ClientProfile[] = [
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

export function loadClients(): ClientProfile[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENTS_STORAGE_KEY) || "[]") as ClientProfile[];
    const byId = new Map(DEFAULT_CLIENTS.map((client) => [client.id, client]));
    saved.forEach((client) => byId.set(client.id, client));
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return DEFAULT_CLIENTS;
  }
}

export function saveClients(clients: ClientProfile[]): void {
  localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
}

export function formStateFromClient(client: ClientProfile): CampaignFormState {
  return {
    ...formDefaults(),
    restaurantName: client.name,
    clientId: client.id,
    city: client.city || "Porto Alegre",
    neighborhood: client.neighborhood || "",
    toneOfVoice: client.tone || "tradicional e acolhedor",
    colorPalette: client.color_palette || "#0B2A1E,#4598B2,#F0B05F",
    typography: client.typography || "Dragon EF,Quiche Display",
    mediaSourceUrl: client.media_source_url || "",
    clientNotes: client.notes || "",
  };
}

export function clientFromForm(form: CampaignFormState, savedClient?: ClientProfile): ClientProfile {
  return {
    id: form.clientId,
    name: form.restaurantName,
    city: form.city,
    neighborhood: form.neighborhood,
    tone: form.toneOfVoice,
    color_palette: form.colorPalette,
    typography: form.typography,
    media_source_url: form.mediaSourceUrl,
    notes: form.clientNotes,
    instagram: savedClient?.instagram || "",
    manual_status: savedClient?.manual_status || "Manual salvo manualmente pela OTG.",
    synthetic_manual: savedClient?.synthetic_manual || "",
  };
}

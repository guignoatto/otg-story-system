import "server-only";
import { openai, TEXT_MODEL } from "../openai";
import { splitLines } from "../utils";
import type { Asset, ClientProfile, GenerationBrief } from "../types";

// Pilares de conteúdo por objetivo (porta de content_strategy_agent).
const PILLARS: Record<string, string[]> = {
  vendas: ["Desejo", "Produto", "Momento", "Lembrete"],
  reservas: ["Ambiente", "Experiencia", "Ocasiao", "Lembrete"],
  engajamento: ["Pergunta", "Bastidor", "Interacao", "Compartilhamento"],
  awareness: ["Identidade", "Historia", "Experiencia", "Memoria"],
  alcance_local: ["Localizacao", "Rotina", "Convite", "Compartilhamento"],
  relacionamento: ["Proximidade", "Equipe", "Ritual", "Conversa"],
};

const LAYOUT_STYLES = ["editorial", "split", "full_bleed", "quote", "save_card"];

export type GeneratedFrame = {
  index: number;
  headline: string;
  body: string;
  cta: string;
  visual_direction: string;
  layout_style: string;
  media_filename: string | null;
};

export type GenerationResult = {
  rationale: string;
  brand_score: number;
  performance_score: number;
  frames: GeneratedFrame[];
};

const FRAME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rationale: { type: "string", description: "Resumo curto da estratégia do pacote (pt-BR)." },
    brand_score: { type: "number", description: "0-10, aderência ao manual de marca." },
    performance_score: { type: "number", description: "0-10, potencial de performance orgânica." },
    frames: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          headline: { type: "string" },
          body: { type: "string" },
          cta: { type: "string" },
          visual_direction: { type: "string" },
          layout_style: { type: "string", enum: LAYOUT_STYLES },
          media_filename: {
            type: ["string", "null"],
            description: "Nome de arquivo de uma das mídias reais fornecidas, ou null.",
          },
        },
        required: [
          "index",
          "headline",
          "body",
          "cta",
          "visual_direction",
          "layout_style",
          "media_filename",
        ],
      },
    },
  },
  required: ["rationale", "brand_score", "performance_score", "frames"],
} as const;

function buildSystemPrompt(): string {
  return [
    "Você é o diretor criativo da OTG Mídia, especialista em conteúdo orgânico de Instagram (Stories e carrossel) para restaurantes brasileiros.",
    "Sua tarefa: a partir do briefing e do manual de marca do restaurante, escrever os frames de um pacote de conteúdo em português do Brasil, com copy curta, apetitosa e fiel à marca.",
    "",
    "REGRAS DE QA (obrigatórias):",
    "- Conteúdo é ORGÂNICO, não anúncio pago. Nunca use linguagem de anúncio, preços, número de telefone, endereço ou promessas agressivas sem que estejam no briefing.",
    "- Em Stories, ações válidas são orgânicas: responder no direct, reagir com emoji, enviar/compartilhar no direct, continuar assistindo. NÃO use 'salve', 'salvar', 'guarde', 'comente', 'clique', 'link na bio', enquete, quiz, sticker interativo, caixa de pergunta, botão falso ou 'peça pelo WhatsApp'.",
    "- Em carrossel/feed, salvar/compartilhar/comentar são aceitáveis quando fizerem sentido.",
    "- Respeite estritamente as REGRAS OPERACIONAIS do cliente (ex.: delivery-only, só à noite, não mencionar almoço/salão/reserva/mesa). Se a regra proíbe algo, jamais mencione.",
    "- Não invente itens de cardápio, preços ou fatos fora do briefing.",
    "- A logo NUNCA é descrita como elemento a recriar; a direção visual deve preservar marcas fotografadas como estão.",
    `- layout_style deve ser um de: ${LAYOUT_STYLES.join(", ")}.`,
    "- Se houver mídias reais fornecidas, distribua-as entre os frames usando media_filename (use exatamente o nome listado). Se não houver, use null.",
    "- headline curta (até ~6 palavras). body com 1 frase. cta é uma chamada orgânica curta.",
  ].join("\n");
}

function buildUserPrompt(params: {
  client: ClientProfile;
  brief: GenerationBrief;
  media: Asset[];
}): string {
  const { client, brief, media } = params;
  const rules = splitLines(client.notes);
  const pillars = PILLARS[brief.objective] || ["Gancho", "Autoridade", "Interacao", "Lembrete"];
  const mediaNames = media.map((m) => m.file_name);

  return [
    `RESTAURANTE: ${brief.restaurant_name}`,
    client.city ? `Cidade: ${client.city}` : "",
    client.neighborhood ? `Bairro/região: ${client.neighborhood}` : "",
    client.tone ? `Tom de voz: ${client.tone}` : "",
    client.color_palette.length ? `Paleta: ${client.color_palette.join(", ")}` : "",
    client.typography.length ? `Tipografia: ${client.typography.join(", ")}` : "",
    client.synthetic_manual ? `Manual sintético: ${client.synthetic_manual}` : "",
    client.brand_manual_summary ? `Resumo do manual de marca: ${client.brand_manual_summary}` : "",
    "",
    "REGRAS OPERACIONAIS DO CLIENTE:",
    rules.length ? rules.map((r) => `- ${r}`).join("\n") : "- (sem regras específicas)",
    "",
    "BRIEFING DA CAMPANHA:",
    `- Objetivo: ${brief.objective} (pilares sugeridos: ${pillars.join(", ")})`,
    `- Tipo de conteúdo: ${brief.story_type}`,
    `- Formato: ${brief.output_format}`,
    `- Tema/produto: ${brief.offer}`,
    `- Chamada desejada: ${brief.cta}`,
    `- Número de frames: ${brief.frames}`,
    "",
    "MÍDIAS REAIS DISPONÍVEIS (use os nomes em media_filename):",
    mediaNames.length ? mediaNames.map((n) => `- ${n}`).join("\n") : "- (nenhuma)",
    "",
    `Gere exatamente ${brief.frames} frames, numerados de 1 a ${brief.frames}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Single structured LLM call that replaces the 9 heuristic agents. */
export async function generateFrames(params: {
  client: ClientProfile;
  brief: GenerationBrief;
  media: Asset[];
}): Promise<GenerationResult> {
  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.8,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(params) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "story_pack", strict: true, schema: FRAME_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("A IA não retornou conteúdo para o pacote.");
  const parsed = JSON.parse(raw) as GenerationResult;

  // Normaliza índices e garante o número de frames pedido.
  parsed.frames = parsed.frames
    .slice(0, params.brief.frames)
    .map((f, i) => ({ ...f, index: i + 1 }));

  return parsed;
}

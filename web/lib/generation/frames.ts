import "server-only";
import { openai, TEXT_MODEL } from "../openai";
import { splitLines } from "../utils";
import type { Asset, BrandContext, ClientProfile, GenerationBrief, MediaInsight } from "../types";

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

function buildSystemPrompt(brandContext?: BrandContext): string {
  const forbiddenNote =
    brandContext?.forbidden_words.length
      ? `- Palavras/expressões ABSOLUTAMENTE PROIBIDAS para este cliente: ${brandContext.forbidden_words.join(", ")}.`
      : "";

  return [
    "Você é o diretor criativo da OTG Mídia, especialista em conteúdo orgânico de Instagram (Stories e carrossel) para restaurantes brasileiros.",
    "Sua tarefa: a partir do briefing e do manual de marca do restaurante, escrever os frames de um pacote de conteúdo em português do Brasil, com copy curta, apetitosa e fiel à marca.",
    "",
    "REGRAS DE QA (obrigatórias):",
    "- Conteúdo é ORGÂNICO, não anúncio pago. Nunca use linguagem de anúncio, preços, número de telefone, endereço ou promessas agressivas sem que estejam no briefing.",
    "- Em Stories, ações válidas são orgânicas: responder no direct, reagir com emoji, enviar/compartilhar no direct, continuar assistindo. NÃO use 'salve', 'salvar', 'guarde', 'comente', 'clique', 'link na bio', enquete, quiz, sticker interativo, caixa de pergunta, botão falso ou 'peça pelo WhatsApp'.",
    "- Em carrossel/feed, salvar/compartilhar/comentar são aceitáveis quando fizerem sentido.",
    "- Respeite estritamente as REGRAS OPERACIONAIS do cliente (ex.: delivery-only, só à noite, não mencionar almoço/salão/reserva/mesa). Se a regra proíbe algo, jamais mencione.",
    forbiddenNote,
    "- Não invente itens de cardápio, preços ou fatos fora do briefing.",
    "- A logo NUNCA é descrita como elemento a recriar; a direção visual deve preservar marcas fotografadas como estão.",
    `- layout_style deve ser um de: ${LAYOUT_STYLES.join(", ")}.`,
    "- Se houver mídias reais fornecidas, distribua-as entre os frames usando media_filename (use exatamente o nome listado). Se não houver, use null.",
    "- headline curta (até ~6 palavras). body com 1 frase. cta é uma chamada orgânica curta.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(params: {
  client: ClientProfile;
  brief: GenerationBrief;
  media: Asset[];
  mediaInsights?: MediaInsight[];
  brandContext?: BrandContext;
}): string {
  const { client, brief, media, mediaInsights, brandContext } = params;
  const rules = splitLines(client.notes);
  const pillars = PILLARS[brief.objective] || ["Gancho", "Autoridade", "Interacao", "Lembrete"];

  // Build enriched media list: se há insights de visão, usa a descrição; senão, só o nome.
  const insightByName = new Map((mediaInsights ?? []).map((i) => [i.file_name, i]));
  const mediaLines = media.map((m) => {
    const insight = insightByName.get(m.file_name);
    if (insight) {
      const bestFor = insight.best_for.length ? ` | ideal para: ${insight.best_for.join(", ")}` : "";
      const avoid = insight.avoid_for.length ? ` | evitar para: ${insight.avoid_for.join(", ")}` : "";
      return `- ${m.file_name} → "${insight.visual_description}" | mood: ${insight.mood} | qualidade: ${insight.quality_score}/10${bestFor}${avoid}`;
    }
    return `- ${m.file_name}`;
  });

  // Brand context extra rules from BrandGuard
  const brandLines: string[] = [];
  if (brandContext) {
    if (brandContext.tone_rules.length) brandLines.push(`Tom de voz (detalhado): ${brandContext.tone_rules.join("; ")}`);
    if (brandContext.required_elements.length) brandLines.push(`Elementos obrigatórios: ${brandContext.required_elements.join("; ")}`);
    if (brandContext.visual_constraints.length) brandLines.push(`Restrições visuais: ${brandContext.visual_constraints.join("; ")}`);
    if (brandContext.cta_style) brandLines.push(`Estilo de CTA: ${brandContext.cta_style}`);
  }

  return [
    `RESTAURANTE: ${brief.restaurant_name}`,
    client.city ? `Cidade: ${client.city}` : "",
    client.neighborhood ? `Bairro/região: ${client.neighborhood}` : "",
    client.tone ? `Tom de voz: ${client.tone}` : "",
    client.color_palette.length ? `Paleta: ${client.color_palette.join(", ")}` : "",
    client.typography.length ? `Tipografia: ${client.typography.join(", ")}` : "",
    client.synthetic_manual ? `Manual sintético: ${client.synthetic_manual}` : "",
    client.brand_manual_summary ? `Resumo do manual de marca: ${client.brand_manual_summary}` : "",
    brandLines.length ? "\nCONTEXTO DE MARCA (estruturado):\n" + brandLines.map((l) => `- ${l}`).join("\n") : "",
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
    mediaLines.length ? mediaLines.join("\n") : "- (nenhuma)",
    "",
    `Gere exatamente ${brief.frames} frames, numerados de 1 a ${brief.frames}.`,
    mediaInsights?.length
      ? "Use as descrições visuais das mídias para escrever headlines e direções de arte específicas para cada foto."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Structured LLM call for frame generation. Accepts optional enriched context from pipeline agents. */
export async function generateFrames(params: {
  client: ClientProfile;
  brief: GenerationBrief;
  media: Asset[];
  mediaInsights?: MediaInsight[];
  brandContext?: BrandContext;
}): Promise<GenerationResult> {
  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.8,
    messages: [
      { role: "system", content: buildSystemPrompt(params.brandContext) },
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

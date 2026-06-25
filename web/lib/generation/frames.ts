import "server-only";
import { openai, TEXT_MODEL } from "../openai";
import { splitLines } from "../utils";
import type { Asset, BrandContext, ClientProfile, GenerationBrief, MediaInsight } from "../types";
import { frangoPromptSafetyBlock, hasThirdPartyBrandRisk, isFrangoBrandContext } from "./frango-safety";
import { formatClientMemoryForPrompt, type ClientLearningMemory } from "../feedback";

// Pilares de conteúdo por objetivo (porta de content_strategy_agent).
const PILLARS: Record<string, string[]> = {
  vendas: ["Desejo", "Produto", "Momento", "Lembrete"],
  reservas: ["Ambiente", "Experiencia", "Ocasiao", "Lembrete"],
  engajamento: ["Pergunta", "Bastidor", "Interacao", "Compartilhamento"],
  awareness: ["Identidade", "Historia", "Experiencia", "Memoria"],
  alcance_local: ["Localizacao", "Rotina", "Convite", "Compartilhamento"],
  relacionamento: ["Proximidade", "Equipe", "Ritual", "Conversa"],
};

const LAYOUT_STYLES = ["editorial", "split", "full_bleed", "quote"];
const WEEKLY_DAYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"] as const;
const WEEKLY_SLOTS = [
  "Story 1: gancho leve/contexto do dia para abrir a sequência.",
  "Story 2: prato, produto, bastidor, prova social ou motivo de desejo.",
  "Story 3: chamada orgânica/conversa/compartilhamento, sem cara de anúncio.",
] as const;
const WEEKLY_PILLARS = [
  "desejo de produto",
  "bastidor e preparo",
  "prova social",
  "rotina/ocasião de consumo",
  "cardápio sem parecer panfleto",
  "relacionamento com cliente",
  "awareness de marca",
  "alcance local",
  "lembrete orgânico",
] as const;

export type GeneratedFrame = {
  index: number;
  headline: string;
  body: string;
  cta: string;
  visual_direction: string;
  layout_style: string;
  media_filename: string | null;
  weekly_day: string | null;
  daily_slot: number | null;
  content_pillar: string | null;
  content_goal: string | null;
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
          weekly_day: {
            type: ["string", "null"],
            description: "No modo semanal: dia planejado para o story (segunda, terca, quarta, quinta, sexta, sabado ou domingo). Fora do modo semanal, null.",
          },
          daily_slot: {
            type: ["integer", "null"],
            description: "No modo semanal: posição do story no dia, 1, 2 ou 3. Fora do modo semanal, null.",
          },
          content_pillar: {
            type: ["string", "null"],
            description: "Pilar editorial do frame, ex: desejo de produto, bastidor, prova social, relacionamento, alcance local.",
          },
          content_goal: {
            type: ["string", "null"],
            description: "Proposta específica do story em pt-BR, curta e estratégica.",
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
          "weekly_day",
          "daily_slot",
          "content_pillar",
          "content_goal",
        ],
      },
    },
  },
  required: ["rationale", "brand_score", "performance_score", "frames"],
} as const;

function buildSystemPrompt(params: {
  brandContext?: BrandContext;
  outputFormat: GenerationBrief["output_format"];
}): string {
  const { brandContext, outputFormat } = params;
  const forbiddenNote =
    brandContext?.forbidden_words.length
      ? `- Palavras/expressões ABSOLUTAMENTE PROIBIDAS para este cliente: ${brandContext.forbidden_words.join(", ")}. Essa restrição vale para headline, body, CTA e visual_direction.`
      : "";
  const storySpecific =
    outputFormat === "stories"
      ? [
          "- Para Stories, CTA é texto editorial curto, não componente visual. Nunca peça botão, pill, badge clicável, sticker, enquete ou UI falsa.",
          "- Para Stories, CTA deve ser uma ação orgânica curta como 'Manda para quem iria contigo', 'Compartilha no direct' ou 'Responde com emoji'. Não use slogan contemplativo como CTA.",
          "- Para Stories, não use layout de 'save card' nem incentive salvar/guardar.",
          "- Para Stories, evite CTA grande no rodapé porque conflita com a área de resposta do Instagram.",
        ]
      : [
          "- Para carrossel/feed, salvar/compartilhar pode aparecer se fizer sentido, mas sem visual de anúncio pago.",
        ];
  const frangoSpecific = brandContext && isFrangoBrandContext(brandContext)
    ? [
        "- Para Frango na Brazza, o território obrigatório é comida caseira, almoço, marmitex, prato feito e delivery.",
        "- Para Frango na Brazza, nunca use brasa/fogo/churrasco/grelhado/frango assado/crocância como texto, conceito ou direção visual.",
        "- Para Frango na Brazza, lata/refrigerante secundário na foto é permitido; só evite a mídia quando lata/refrigerante/marca de terceiro for dominante ou competir com a comida.",
        "- Regra preventiva de imagem para Frango na Brazza: " + frangoPromptSafetyBlock(),
      ]
    : [];

  return [
    "Você é o diretor criativo da OTG Mídia, especialista em conteúdo orgânico de Instagram (Stories e carrossel) para restaurantes brasileiros.",
    "Sua tarefa: a partir do briefing e do manual de marca do restaurante, escrever os frames de um pacote de conteúdo em português do Brasil, com copy curta, apetitosa e fiel à marca.",
    "",
    "REGRAS DE QA (obrigatórias):",
    "- Conteúdo é ORGÂNICO, não anúncio pago. Nunca use linguagem de anúncio, preços, número de telefone, endereço ou promessas agressivas sem que estejam no briefing.",
    "- Em Stories, ações válidas são orgânicas: responder no direct, reagir com emoji, enviar/compartilhar no direct, continuar assistindo. NÃO use 'salve', 'salvar', 'guarde', 'comente', 'clique', 'link na bio', enquete, quiz, sticker interativo, caixa de pergunta, botão falso ou 'peça pelo WhatsApp'.",
    ...storySpecific,
    "- Em carrossel/feed, salvar/compartilhar/comentar são aceitáveis quando fizerem sentido.",
    "- Respeite estritamente as REGRAS OPERACIONAIS do cliente (ex.: delivery-only, só à noite, não mencionar almoço/salão/reserva/mesa). Se a regra proíbe algo, jamais mencione.",
    forbiddenNote,
    "- Não invente itens de cardápio, preços ou fatos fora do briefing.",
    "- A logo NUNCA é descrita como elemento a recriar; a direção visual deve preservar marcas fotografadas como estão.",
    "- Nunca peça 'logo ao fundo', 'logotipo em destaque' ou aplicação de marca dentro da geração. A logo oficial, quando usada, é aplicada depois por overlay de PNG transparente.",
    "- Se uma mídia tiver refrigerante/lata/marca de terceiros, isso pode permanecer secundário; não transforme em foco do frame e não escreva como se fosse parceria.",
    "- visual_direction deve orientar composição editorial; não deve pedir chamas, faíscas, brush grunge ou cartaz agressivo quando isso não estiver explicitamente no manual.",
    ...frangoSpecific,
    `- layout_style deve ser um de: ${LAYOUT_STYLES.join(", ")}.`,
    "- Se houver mídias reais fornecidas, distribua-as entre os frames usando media_filename (use exatamente o nome listado). Se não houver, use null.",
    "- headline curta (até ~6 palavras). body com 1 frase. cta é uma chamada orgânica curta, sem instrução visual de botão.",
    "- No modo semanal, use weekly_day, daily_slot, content_pillar e content_goal para explicitar a estratégia editorial de cada story.",
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
  clientMemory?: ClientLearningMemory;
}): string {
  const { client, brief, media, mediaInsights, brandContext, clientMemory } = params;
  const rules = splitLines(client.notes);
  const pillars = PILLARS[brief.objective] || ["Gancho", "Autoridade", "Interacao", "Lembrete"];
  const isFrango = brandContext ? isFrangoBrandContext(brandContext) : false;
  const syntheticManualLine = isFrango
    ? "Manual sintético seguro: Frango na Brazza é comida caseira, almoço, marmitex, prato feito e delivery. Não usar brasa, fogo, churrasco, grelhado, frango assado, frango suculento, suculência ou crocância. Lata/refrigerante na foto é permitido quando secundário; não pode virar foco."
    : client.synthetic_manual
      ? `Manual sintético: ${client.synthetic_manual}`
      : "";
  const brandManualLine = isFrango
    ? "Resumo do manual de marca: identidade popular, direta e quente para comida caseira; preto, amarelo e vermelho apenas como detalhes; foto real de almoço/marmitex como protagonista."
    : client.brand_manual_summary
      ? `Resumo do manual de marca: ${client.brand_manual_summary}`
      : "";
  const weeklyPlan = brief.weekly_batch
    ? [
        "PLANEJAMENTO SEMANAL OTG:",
        "- Modo piloto automático: objetivo, tipo, tema/produto e chamada do briefing são diretrizes de automação, não pauta fixa.",
        "- Você deve decidir autonomamente o objetivo editorial de cada dia e de cada story, respeitando fotos disponíveis, manual, operação e memória de aprovações/reprovações.",
        "- A OTG posta 3 stories por dia para cada cliente. Este pacote deve ter 21 stories: 7 dias x 3 stories.",
        "- Gere exatamente 21 frames, nesta ordem: segunda 1/3, segunda 2/3, segunda 3/3, terça 1/3... até domingo 3/3.",
        "- Cada dia precisa ter mini-narrativa própria: abrir com gancho/contexto, desenvolver com desejo/prova/bastidor/cardápio, fechar com chamada orgânica.",
        "- Varie as propostas editoriais ao longo da semana. Não faça 21 variações do mesmo texto.",
        "- Varie também as chamadas orgânicas. Não repita o mesmo CTA em sequência e nunca use WhatsApp, salvar, guardar, enquete, botão falso ou linguagem de anúncio.",
        "- Use a inteligência do sistema para decidir o mix ideal, combinando objetivo, fotos disponíveis, memória de aprovações, operação do restaurante e tipo de cliente.",
        `- Pilares disponíveis para variar: ${WEEKLY_PILLARS.join(", ")}.`,
        "- Não precisa usar todos os pilares, mas evite repetir o mesmo pilar em frames consecutivos.",
        "- Campos obrigatórios no modo semanal: weekly_day, daily_slot, content_pillar e content_goal.",
        "- daily_slot deve ser 1, 2 ou 3. weekly_day deve seguir a sequência: " + WEEKLY_DAYS.join(", ") + ".",
        "- Função dos slots: " + WEEKLY_SLOTS.join(" | "),
      ].join("\n")
    : "";

  // Build enriched media list: se há insights de visão, usa a descrição; senão, só o nome.
  const insightByName = new Map((mediaInsights ?? []).map((i) => [i.file_name, i]));
  const mediaLines = media.map((m) => {
    const insight = insightByName.get(m.file_name);
    if (insight) {
      const bestFor = insight.best_for.length ? ` | ideal para: ${insight.best_for.join(", ")}` : "";
      const avoid = insight.avoid_for.length ? ` | evitar para: ${insight.avoid_for.join(", ")}` : "";
      const thirdPartyWarning = isFrango && hasThirdPartyBrandRisk(
        `${insight.visual_description} ${insight.mood} ${insight.avoid_for.join(" ")}`
      )
        ? " | risco Frango: não usar como hero de IA; trocar se houver alternativa"
        : "";
      return `- ${m.file_name} → "${insight.visual_description}" | mood: ${insight.mood} | qualidade: ${insight.quality_score}/10${bestFor}${avoid}${thirdPartyWarning}`;
    }
    return `- ${m.file_name}`;
  });

  // Brand context extra rules from BrandGuard
  const brandLines: string[] = [];
  if (brandContext) {
    if (brandContext.tone_rules.length) brandLines.push(`Tom de voz (detalhado): ${brandContext.tone_rules.join("; ")}`);
    if (brandContext.forbidden_words.length) brandLines.push(`Palavras e conceitos proibidos: ${brandContext.forbidden_words.join("; ")}`);
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
    syntheticManualLine,
    brandManualLine,
    brandLines.length ? "\nCONTEXTO DE MARCA (estruturado):\n" + brandLines.map((l) => `- ${l}`).join("\n") : "",
    "",
    "REGRAS OPERACIONAIS DO CLIENTE:",
    rules.length ? rules.map((r) => `- ${r}`).join("\n") : "- (sem regras específicas)",
    "",
    "BRIEFING DA CAMPANHA:",
    `- Objetivo: ${brief.objective} (pilares sugeridos: ${pillars.join(", ")})`,
    `- Tipo de conteúdo: ${brief.story_type}`,
    `- Formato: ${brief.output_format}`,
    brief.weekly_batch
      ? "- Modo: lote semanal OTG com 21 stories, 3 por dia, distribuídos em calendário editorial."
      : "",
    brief.weekly_batch
      ? "- Tema/produto: decidir automaticamente por frame a partir das mídias, manual, operação e memória do cliente."
      : `- Tema/produto: ${brief.offer}`,
    brief.weekly_batch
      ? "- Chamada desejada: decidir automaticamente uma chamada orgânica específica por frame, sem repetir fórmula."
      : `- Chamada desejada: ${brief.cta}`,
    `- Número de frames: ${brief.frames}`,
    "",
    formatClientMemoryForPrompt(clientMemory),
    weeklyPlan,
    "",
    "MÍDIAS REAIS DISPONÍVEIS (use os nomes em media_filename):",
    mediaLines.length ? mediaLines.join("\n") : "- (nenhuma)",
    mediaLines.length
      ? "Se uma mídia tiver lata/refrigerante/logo de terceiro dominante ou elemento que distraia, escolha outra quando possível. Se for secundário, pode usar, mantendo esse elemento fora do foco e sem citar como destaque."
      : "",
    "",
    `Gere exatamente ${brief.frames} frames, numerados de 1 a ${brief.frames}.`,
    brief.weekly_batch
      ? "No modo semanal, o pacote precisa parecer uma semana real de conteúdo orgânico, não uma sequência de anúncios. Priorize variedade, ritmo e progressão editorial."
      : "",
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
  clientMemory?: ClientLearningMemory;
}): Promise<GenerationResult> {
  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt({
          brandContext: params.brandContext,
          outputFormat: params.brief.output_format,
        }),
      },
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

  // O schema descreve 0-10, mas a descrição não é imposta pelo strict mode.
  parsed.brand_score = Math.max(0, Math.min(10, Number(parsed.brand_score) || 0));
  parsed.performance_score = Math.max(0, Math.min(10, Number(parsed.performance_score) || 0));

  // Normaliza índices e garante o número de frames pedido (trunca excesso).
  parsed.frames = parsed.frames
    .slice(0, params.brief.frames)
    .map((f, i) => ({ ...f, index: i + 1 }));

  // Se a IA gerou menos frames do que o pedido, completa repetindo o último
  // frame (ou um placeholder, se nenhum foi retornado) até atingir a contagem.
  while (parsed.frames.length < params.brief.frames) {
    const base: GeneratedFrame = parsed.frames[parsed.frames.length - 1] ?? {
      index: 0,
      headline: "",
      body: "",
      cta: "",
      visual_direction: "",
      layout_style: LAYOUT_STYLES[0],
      media_filename: null,
      weekly_day: params.brief.weekly_batch ? WEEKLY_DAYS[Math.floor((parsed.frames.length) / 3)] ?? null : null,
      daily_slot: params.brief.weekly_batch ? ((parsed.frames.length % 3) + 1) : null,
      content_pillar: null,
      content_goal: null,
    };
    parsed.frames.push({ ...base, index: parsed.frames.length + 1 });
  }

  if (params.brief.weekly_batch) {
    parsed.frames = parsed.frames.map((frame, i) => ({
      ...frame,
      weekly_day: WEEKLY_DAYS[Math.floor(i / 3)] ?? frame.weekly_day ?? null,
      daily_slot: (i % 3) + 1,
      content_pillar: frame.content_pillar || "conteúdo orgânico",
      content_goal: frame.content_goal || "Manter presença semanal com variedade editorial.",
    }));
  }

  return parsed;
}

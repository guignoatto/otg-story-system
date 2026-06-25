import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import type { BrandContext, GenerationBrief } from "../../types";
import type { GeneratedFrame } from "../frames";
import {
  buildFrangoSafeVisualDirection,
  frangoPromptSafetyBlock,
  isFrangoBrandContext,
  sanitizeFrangoText,
} from "../frango-safety";

const LAYOUT_STYLES = ["editorial", "split", "full_bleed", "quote"] as const;

const QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved: { type: "boolean" },
    issues_found: { type: "integer" },
    qa_notes: {
      type: "string",
      description: "Resumo curto em pt-BR do que foi corrigido ou aprovado.",
    },
    frames: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          passed: { type: "boolean" },
          headline: { type: "string" },
          body: { type: "string" },
          cta: { type: "string" },
          visual_direction: { type: "string" },
          layout_style: { type: "string", enum: [...LAYOUT_STYLES] },
          media_filename: { type: ["string", "null"] },
          weekly_day: { type: ["string", "null"] },
          daily_slot: { type: ["integer", "null"] },
          content_pillar: { type: ["string", "null"] },
          content_goal: { type: ["string", "null"] },
        },
        required: [
          "index",
          "passed",
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
  required: ["approved", "issues_found", "qa_notes", "frames"],
} as const;

export type QAResult = {
  approved: boolean;
  issues_found: number;
  qa_notes: string;
  frames: GeneratedFrame[];
};

const STORY_CTA_FORBIDDEN = [
  /\bsalv(e|ar|a)\b/i,
  /\bguard(e|ar|a)\b/i,
  /\bclique\b/i,
  /\blink na bio\b/i,
  /\bwhats(app)?\b/i,
  /\bzap\b/i,
  /\bbot[aã]o\b/i,
  /\benquete\b/i,
  /\bquiz\b/i,
  /\bsticker\b/i,
];

const STORY_CTA_ACTIONS = [
  /\bmanda\b/i,
  /\benvia\b/i,
  /\bcompartilh(a|e)\b/i,
  /\bresponde\b/i,
  /\breage\b/i,
  /\bchama\b/i,
  /\bdirect\b/i,
  /\bquem\s+vem\b/i,
  /\bquem\s+iria\b/i,
];

const FORBIDDEN_REPLACEMENTS: [RegExp, string][] = [
  [/\bfrango\s+assad(o|a|os|as)\b/gi, "frango caseiro"],
  [/\bassad(o|a|os|as)\b/gi, "caseiro"],
  [/\bbrasa(s)?\b/gi, "comida caseira"],
  [/\bchurrasc(o|aria|ueira)\b/gi, "comida caseira"],
  [/\bsteakhouse\b/gi, "restaurante caseiro"],
  [/\bgrelhad(o|a|os|as)\b/gi, "bem servido"],
  [/\bfogo\b/gi, "calor de comida caseira"],
  [/\bchama(s)?\b/gi, "sabor"],
  [/\blabareda(s)?\b/gi, "calor"],
  [/\bcroc[âa]ncia\b/gi, "sabor"],
  [/\bcrocante(s)?\b/gi, "saboroso"],
  [/\bdourado perfeito\b/gi, "almoço bem servido"],
  [/\bderrete\s+na\s+boca\b/gi, "bem servido"],
  [/\bacolhimento no prato\b/gi, "comida caseira no prato"],
];

function sanitizeForbiddenTerms(value: string, brandContext: BrandContext): string {
  if (isFrangoBrandContext(brandContext)) return sanitizeFrangoText(value);

  const forbiddenText = brandContext.forbidden_words.join(" ").toLowerCase();
  if (!forbiddenText) return value;
  return FORBIDDEN_REPLACEMENTS.reduce((text, [pattern, replacement]) => {
    const source = pattern.source.toLowerCase();
    const shouldApply =
      forbiddenText.includes("brasa") ||
      forbiddenText.includes("churrasco") ||
      forbiddenText.includes("fogo") ||
      forbiddenText.includes("grelhado") ||
      source.includes("dourado") ||
      source.includes("acolhimento");
    return shouldApply ? text.replace(pattern, replacement) : text;
  }, value);
}

function sanitizeStoryCta(cta: string, brandContext: BrandContext): string {
  const clean = sanitizeForbiddenTerms(cta.trim(), brandContext);
  if (
    !clean ||
    STORY_CTA_FORBIDDEN.some((pattern) => pattern.test(clean)) ||
    !STORY_CTA_ACTIONS.some((pattern) => pattern.test(clean))
  ) {
    if (isFrangoBrandContext(brandContext)) {
      return "Manda para quem ama comida caseira";
    }
    return "Manda para quem iria contigo";
  }
  return clean;
}

function sanitizeLogoDirection(value: string): string {
  return value
    .replace(/\b(logotipo|logo)\s+(ao fundo|no fundo|em destaque|vis[ií]vel|aplicad[ao]|da marca)\b/gi, "marca fotografada preservada sem redesenho")
    .replace(/\b(usar|adicionar|colocar|inserir|aplicar)\s+(a\s+)?(logo|logotipo)\b/gi, "preservar apenas marcas já fotografadas")
    .replace(/\bcom\s+(logo|logotipo)\b/gi, "com marca original da foto preservada")
    .trim();
}

function sanitizeVisualDirection(value: string, brandContext: BrandContext): string {
  const original = value.trim();
  if (isFrangoBrandContext(brandContext)) return buildFrangoSafeVisualDirection(sanitizeLogoDirection(original));

  return sanitizeLogoDirection(sanitizeForbiddenTerms(original, brandContext))
    .replace(/\b(bot[aã]o|pill|badge|sticker|enquete|quiz|brush grunge|grunge pesado)\b/gi, "texto editorial discreto")
    .replace(/\b(chamas|fa[ií]scas|labaredas)\b/gi, "luz quente");
}

function sanitizeFrame(
  frame: GeneratedFrame,
  brandContext: BrandContext,
  outputFormat: GenerationBrief["output_format"]
): GeneratedFrame {
  const isStory = outputFormat === "stories";
  return {
    ...frame,
    headline: sanitizeForbiddenTerms(frame.headline, brandContext),
    body: sanitizeForbiddenTerms(frame.body, brandContext),
    cta: isStory ? sanitizeStoryCta(frame.cta, brandContext) : sanitizeForbiddenTerms(frame.cta, brandContext),
    visual_direction: sanitizeVisualDirection(frame.visual_direction, brandContext),
    layout_style: LAYOUT_STYLES.includes(frame.layout_style as (typeof LAYOUT_STYLES)[number])
      ? frame.layout_style
      : "editorial",
  };
}

export async function runQA(params: {
  frames: GeneratedFrame[];
  brandContext: BrandContext;
  brief: GenerationBrief;
}): Promise<QAResult> {
  const { frames, brandContext, brief } = params;

  const framesJson = JSON.stringify(
    frames.map((f) => ({
      index: f.index,
      headline: f.headline,
      body: f.body,
      cta: f.cta,
      visual_direction: f.visual_direction,
      layout_style: f.layout_style,
      media_filename: f.media_filename,
      weekly_day: f.weekly_day,
      daily_slot: f.daily_slot,
      content_pillar: f.content_pillar,
      content_goal: f.content_goal,
    })),
    null,
    2
  );

  const userPrompt = [
    "FORMATO DE SAÍDA: " + brief.output_format,
    "OBJETIVO: " + brief.objective,
    "",
    "REGRAS DE MARCA:",
    `- Tom: ${brandContext.tone_rules.join("; ")}`,
    `- Palavras proibidas: ${brandContext.forbidden_words.join(", ") || "nenhuma"}`,
    `- Elementos obrigatórios: ${brandContext.required_elements.join("; ") || "nenhum"}`,
    `- Restrições visuais: ${brandContext.visual_constraints.join("; ")}`,
    `- Estilo de CTA: ${brandContext.cta_style}`,
    "",
    "FRAMES GERADOS PARA REVISÃO:",
    framesJson,
    "",
    "Para cada frame: verifique e corrija se necessário. Retorne o frame com headline/body/cta/visual_direction corrigidos.",
    "Se a regra de marca proíbe uma palavra/conceito, corrija também quando aparecer em visual_direction.",
    brief.weekly_batch
      ? "Este é um pacote semanal OTG. Preserve a ordem 7 dias x 3 stories, com weekly_day, daily_slot, content_pillar e content_goal coerentes e variados."
      : "",
  ].join("\n");

  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "Você é um revisor de qualidade criativa da OTG Mídia.",
          "Revise cada frame de conteúdo contra as regras de marca e as regras de conteúdo orgânico.",
          "",
          "REGRAS DE QA — Stories:",
          "- CTAs permitidas: responder no direct, reagir com emoji, enviar no direct, compartilhar no direct.",
          "- CTAs proibidas: salve, salvar, guarde, comente, clique, link na bio, enquete, quiz, sticker interativo, caixa de pergunta, botão falso, peça pelo WhatsApp.",
          "- CTA nunca deve ser orientada como botão/pill/badge visual. Deve ser texto discreto.",
          "- Não use layout de save card em Stories.",
          "",
          "REGRAS DE QA — Carrossel/Feed:",
          "- Salvar e comentar são permitidos quando naturais.",
          "- Nunca use linguagem de anúncio pago, preço, endereço ou telefone.",
          "",
          "REGRAS GERAIS:",
          "- Nunca invente itens de cardápio ou fatos fora do briefing.",
          "- Não recriar ou descrever logo para ser gerado por IA.",
          "- Se visual_direction pedir logo/logotipo, substitua por preservação da marca já fotografada ou deixe a logo para overlay externo; nunca peça à IA para redesenhar/aplicar logo.",
          "- Bloqueie linguagem visual que contradiz a operação: ex. comida caseira não deve virar churrasco premium/brasa/fogo/grunge.",
          "- Se houver refrigerante/lata/marca de terceiro na foto, ela não pode virar foco do frame.",
          "- Para Frango na Brazza, aplique esta regra preventiva sem exceção: " + frangoPromptSafetyBlock(),
          "- Corrija violações diretamente no campo, não apenas liste o problema.",
          "- Responda apenas em português do Brasil.",
        ].join("\n"),
      },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "qa_result", strict: true, schema: QA_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return {
      approved: true,
      issues_found: 0,
      qa_notes: "QA não executado.",
      frames,
    };
  }

  const parsed = JSON.parse(raw) as {
    approved: boolean;
    issues_found: number;
    qa_notes: string;
    frames: GeneratedFrame[];
  };

  return {
    ...parsed,
    frames: parsed.frames.map((frame) => sanitizeFrame(frame, brandContext, brief.output_format)),
  };
}

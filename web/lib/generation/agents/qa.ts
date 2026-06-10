import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import type { BrandContext, GenerationBrief } from "../../types";
import type { GeneratedFrame } from "../frames";

const LAYOUT_STYLES = ["editorial", "split", "full_bleed", "quote", "save_card"] as const;

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
        },
        required: ["index", "passed", "headline", "body", "cta", "visual_direction", "layout_style", "media_filename"],
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
          "",
          "REGRAS DE QA — Carrossel/Feed:",
          "- Salvar e comentar são permitidos quando naturais.",
          "- Nunca use linguagem de anúncio pago, preço, endereço ou telefone.",
          "",
          "REGRAS GERAIS:",
          "- Nunca invente itens de cardápio ou fatos fora do briefing.",
          "- Não recriar ou descrever logo para ser gerado por IA.",
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

  return parsed;
}

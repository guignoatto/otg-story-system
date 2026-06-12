import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import { splitLines } from "../../utils";
import type { BrandContext, ClientProfile } from "../../types";

const BRAND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tone_rules: {
      type: "array",
      items: { type: "string" },
      description: "Regras de tom de voz extraídas do perfil (ex: 'informal mas sofisticado').",
    },
    forbidden_words: {
      type: "array",
      items: { type: "string" },
      description: "Palavras e expressões que nunca devem aparecer no conteúdo deste cliente.",
    },
    required_elements: {
      type: "array",
      items: { type: "string" },
      description: "Elementos obrigatórios em todo conteúdo (ex: 'mencionar delivery noturno').",
    },
    visual_constraints: {
      type: "array",
      items: { type: "string" },
      description: "Restrições visuais (ex: 'não recriar logo', 'fundo escuro preferencial').",
    },
    cta_style: {
      type: "string",
      description: "Estilo de chamada para ação permitido (ex: 'orgânico, nunca imperativo agressivo').",
    },
  },
  required: ["tone_rules", "forbidden_words", "required_elements", "visual_constraints", "cta_style"],
} as const;

/** Contexto mínimo seguro quando o agente não consegue responder. */
export function fallbackBrandContext(client: ClientProfile): BrandContext {
  return {
    tone_rules: [client.tone || "equilibrado"],
    forbidden_words: [],
    required_elements: [],
    visual_constraints: ["não recriar logo"],
    cta_style: "orgânico",
  };
}

export async function runBrandGuard(client: ClientProfile): Promise<BrandContext> {
  const notes = splitLines(client.notes);

  const userPrompt = [
    `RESTAURANTE: ${client.name}`,
    client.tone ? `Tom declarado: ${client.tone}` : "",
    client.color_palette.length ? `Paleta: ${client.color_palette.join(", ")}` : "",
    client.brand_manual_summary ? `Resumo do manual: ${client.brand_manual_summary}` : "",
    client.synthetic_manual ? `Manual sintético: ${client.synthetic_manual}` : "",
    "",
    "REGRAS OPERACIONAIS (notas do cliente):",
    notes.length ? notes.map((r) => `- ${r}`).join("\n") : "- (sem regras específicas)",
    "",
    "Extraia e estruture as regras de marca para guiar a geração de conteúdo.",
    "Em forbidden_words inclua variações com/sem acento.",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: [
          "Você é um brand strategist especializado em restaurantes brasileiros.",
          "Sua tarefa é ler o perfil de um cliente e extrair regras de marca estruturadas.",
          "Seja preciso: inclua apenas o que está explicitamente nas notas ou é fortemente implícito pelo tipo de operação.",
          "Responda apenas em português do Brasil.",
        ].join("\n"),
      },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "brand_context", strict: true, schema: BRAND_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return fallbackBrandContext(client);

  return JSON.parse(raw) as BrandContext;
}

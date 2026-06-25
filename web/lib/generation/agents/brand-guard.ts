import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import { splitLines } from "../../utils";
import type { BrandContext, ClientProfile } from "../../types";
import { isFrangoNaBrazzaClient } from "../frango-safety";

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
  return applyDeterministicBrandRules(client, {
    tone_rules: [client.tone || "equilibrado"],
    forbidden_words: [
      "salve",
      "salvar",
      "guarde",
      "clique",
      "botão",
      "botao",
      "WhatsApp",
      "zap",
    ],
    required_elements: [],
    visual_constraints: [
      "não recriar logo",
      "não pedir logo ao fundo nem logotipo em destaque; logo oficial só pode ser aplicada por overlay de PNG transparente",
      "não desenhar botão falso, sticker, enquete, quiz ou UI do Instagram",
    ],
    cta_style: "orgânico, discreto, sem linguagem de anúncio pago",
  });
}

function appendUnique(base: string[], additions: string[]): string[] {
  const seen = new Set(base.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const merged = [...base];
  for (const item of additions) {
    const clean = item.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(clean);
  }
  return merged;
}

function removeForbiddenTerms(base: string[], removals: string[]): string[] {
  const blocked = new Set(removals.map((item) => item.trim().toLowerCase()));
  return base.filter((item) => !blocked.has(item.trim().toLowerCase()));
}

function applyDeterministicBrandRules(
  client: ClientProfile,
  context: BrandContext
): BrandContext {
  const baseForbidden = [
    "salve",
    "salvar",
    "guarde",
    "clique",
    "botão",
    "botao",
    "peça pelo WhatsApp",
    "peca pelo WhatsApp",
    "chame no WhatsApp",
    "link na bio",
  ];

  const safeContext: BrandContext = {
    ...context,
    forbidden_words: appendUnique(context.forbidden_words, baseForbidden),
    visual_constraints: appendUnique(context.visual_constraints, [
      "CTA de Stories deve ser texto editorial discreto, nunca botão, pill, badge clicável ou sticker falso",
      "não usar layout de anúncio pago com CTA gigante",
      "não inventar, redesenhar, melhorar ou completar logotipo",
      "não orientar a IA a criar, redesenhar ou aplicar logo; preservar apenas marcas já fotografadas e usar overlay oficial quando configurado",
      "lata/refrigerante pode aparecer quando for secundário; não tornar refrigerante, lata ou marca de terceiros o foco da arte",
    ]),
  };

  if (!isFrangoNaBrazzaClient(client)) return safeContext;

  const frangoForbiddenWords = removeForbiddenTerms(
    appendUnique(safeContext.forbidden_words, [
      "brasa",
      "brasas",
      "churrasco",
      "churrascaria",
      "churrasqueira",
      "steakhouse",
      "grelhado",
      "grelhada",
      "fogo",
      "chama",
      "chamas",
      "faísca",
      "faisca",
      "faíscas",
      "faiscas",
      "labareda",
      "labaredas",
      "carvão",
      "carvao",
      "frango assado",
      "assado",
      "assada",
      "assados",
      "assadas",
      "crocância",
      "crocancia",
      "crocante",
      "crocantes",
      "frango suculento",
      "suculento",
      "suculenta",
      "suculentos",
      "suculentas",
      "suculência",
      "suculencia",
      "dourado perfeito",
      "acolhimento no prato",
      "logo antigo",
      "círculo vermelho",
      "circulo vermelho",
    ]),
    [
      // These can be mentioned in internal art direction, e.g. "keep the soda can secondary".
      // The visual constraint below blocks turning third-party brands into the creative focus.
      "destaque",
      "refrigerante",
      "refrigerantes",
      "lata",
      "latas",
      "bebida",
      "bebidas",
    ]
  );

  return {
    tone_rules: appendUnique(safeContext.tone_rules, [
      "caseiro, popular, direto e caloroso",
      "foco em almoço, marmitex, prato feito, delivery e rotina",
      "evitar tom premium, churrascaria ou brasa literal",
    ]),
    forbidden_words: frangoForbiddenWords,
    required_elements: appendUnique(safeContext.required_elements, [
      "identidade correta do perfil @frangonabrazza",
      "comida caseira, almoço, marmitex ou prato feito como território principal",
      "paleta preta, amarela e vermelha quando houver elementos gráficos",
    ]),
    visual_constraints: appendUnique(safeContext.visual_constraints, [
      "não usar chamas, faíscas, labaredas, brasas, carvão ou estética de churrasco",
      "não usar brush strokes agressivos, textura grunge pesada ou cartaz de fast-food",
      "não transformar o prato em churrascaria premium ou grelhado gourmet",
      "lata/refrigerante presente na foto é permitido se for secundário; não usar como foco visual, não ampliar e não redesenhar rótulo",
      "valorizar comida caseira real, prato bem servido, marmitex e rotina de almoço",
    ]),
    cta_style:
      "Stories orgânicos: CTA curto e discreto como texto, ex. 'Manda para quem ama comida caseira'. Nunca botão, pill, sticker ou chamada de anúncio.",
  };
}

export async function runBrandGuard(client: ClientProfile): Promise<BrandContext> {
  const notes = splitLines(client.notes);
  const isFrango = isFrangoNaBrazzaClient(client);

  const userPrompt = [
    `RESTAURANTE: ${client.name}`,
    client.tone ? `Tom declarado: ${client.tone}` : "",
    client.color_palette.length ? `Paleta: ${client.color_palette.join(", ")}` : "",
    isFrango
      ? "Resumo do manual: comida caseira, almoço, marmitex, prato feito e delivery. Identidade preta/amarela/vermelha em detalhes. Não usar brasa, fogo, churrasco, grelhado, frango assado, frango suculento, suculência ou crocância. Lata/refrigerante na foto é permitido quando secundário; não pode virar foco."
      : client.brand_manual_summary
        ? `Resumo do manual: ${client.brand_manual_summary}`
        : "",
    !isFrango && client.synthetic_manual ? `Manual sintético: ${client.synthetic_manual}` : "",
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

  return applyDeterministicBrandRules(client, JSON.parse(raw) as BrandContext);
}

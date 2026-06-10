import "server-only";
import { openai, TEXT_MODEL } from "./openai";

const KNOWN_FONT_HINTS = [
  "Poppins",
  "Montserrat",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Raleway",
  "Playfair",
  "Cormorant",
  "Bebas",
  "Dragon EF",
  "Dragon EF ExtraBold",
  "Quiche Display",
  "Quiche Display light",
];

export type ManualAnalysis = {
  notes: string;
  extracted_text_preview: string | null;
  detected_colors: string[];
  detected_typography: string[];
  detected_tone: string | null;
  brand_manual_summary: string | null;
};

type AiManualAnalysis = {
  summary: string;
  tone: string;
  brand_personality: string[];
  color_palette: string[];
  typography: string[];
  voice_rules: string[];
  visual_rules: string[];
  required_elements: string[];
  forbidden_words: string[];
  content_opportunities: string[];
};

const MANUAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    tone: { type: "string" },
    brand_personality: { type: "array", items: { type: "string" } },
    color_palette: { type: "array", items: { type: "string" } },
    typography: { type: "array", items: { type: "string" } },
    voice_rules: { type: "array", items: { type: "string" } },
    visual_rules: { type: "array", items: { type: "string" } },
    required_elements: { type: "array", items: { type: "string" } },
    forbidden_words: { type: "array", items: { type: "string" } },
    content_opportunities: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "tone",
    "brand_personality",
    "color_palette",
    "typography",
    "voice_rules",
    "visual_rules",
    "required_elements",
    "forbidden_words",
    "content_opportunities",
  ],
} as const;

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch {
    return "";
  }
}

function uniqueClean(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function formatAiNotes(ai: AiManualAnalysis): string {
  const sections = [
    ["Resumo", [ai.summary]],
    ["Personalidade", ai.brand_personality],
    ["Voz", ai.voice_rules],
    ["Visual", ai.visual_rules],
    ["Elementos obrigatórios", ai.required_elements],
    ["Evitar", ai.forbidden_words],
    ["Oportunidades de conteúdo", ai.content_opportunities],
  ];

  return sections
    .map(([title, values]) => {
      const items = values as string[];
      if (!items.length) return "";
      return `${title}: ${items.join("; ")}`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildSummary(ai: AiManualAnalysis): string {
  return [
    ai.summary,
    ai.tone ? `Tom: ${ai.tone}` : "",
    ai.brand_personality.length ? `Personalidade: ${ai.brand_personality.join("; ")}` : "",
    ai.voice_rules.length ? `Regras de voz: ${ai.voice_rules.join("; ")}` : "",
    ai.visual_rules.length ? `Regras visuais: ${ai.visual_rules.join("; ")}` : "",
    ai.required_elements.length ? `Elementos obrigatórios: ${ai.required_elements.join("; ")}` : "",
    ai.forbidden_words.length ? `Evitar: ${ai.forbidden_words.join("; ")}` : "",
    ai.content_opportunities.length ? `Oportunidades: ${ai.content_opportunities.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function analyzeManualWithAi(params: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  text: string;
}): Promise<AiManualAnalysis | null> {
  const { fileName, mimeType, bytes, text } = params;
  const isImage = mimeType.startsWith("image/");
  const contentText = text.split(/\s+/).filter(Boolean).join(" ").slice(0, 16000);
  if (!contentText && !isImage) return null;

  type TextContent = { type: "text"; text: string };
  type ImageContent = { type: "image_url"; image_url: { url: string; detail: "low" } };

  const userContent: (TextContent | ImageContent)[] = [
    {
      type: "text",
      text: [
        "Avalie este manual de marca de restaurante e extraia informações úteis para geração de stories orgânicos.",
        "Seja objetivo, em português do Brasil, e só extraia o que estiver indicado ou fortemente inferível.",
        "Priorize regras operacionais, tom de voz, restrições visuais, usos de cor/tipografia e cuidados para não descaracterizar a marca.",
        "",
        `Arquivo: ${fileName}`,
        contentText ? `Texto extraído:\n${contentText}` : "O arquivo é visual; analise a imagem anexada.",
      ].join("\n"),
    },
  ];

  if (isImage) {
    const base64 = Buffer.from(bytes).toString("base64");
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}`, detail: "low" },
    });
  }

  try {
    const completion = await openai().chat.completions.create({
      model: TEXT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "Você é uma estrategista de marca da OTG Mídia.",
            "Transforme manuais de marca em diretrizes práticas para copy, direção de arte e conteúdo orgânico.",
            "Não invente dados ausentes. Use arrays vazios quando não houver evidência.",
          ].join("\n"),
        },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "brand_manual_analysis", strict: true, schema: MANUAL_SCHEMA },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    return raw ? (JSON.parse(raw) as AiManualAnalysis) : null;
  } catch {
    return null;
  }
}

/** Port of the Python `_analyze_manual`: pulls colors/fonts/tone hints from a brand manual. */
export async function analyzeManual(params: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ManualAnalysis> {
  const { fileName, mimeType, bytes } = params;
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isText = /\.(txt|md)$/i.test(fileName);

  let text = "";
  if (isPdf) text = await extractPdfText(bytes);
  else if (isText) text = Buffer.from(bytes).toString("utf-8");

  const colors = Array.from(new Set(text.match(/#[0-9A-Fa-f]{6}/g) ?? [])).sort();
  const lower = text.toLowerCase();
  const normalized = lower.replace(/\s+/g, " ");
  const fonts = KNOWN_FONT_HINTS.filter((font) => normalized.includes(font.toLowerCase()));

  let tone: string | null = null;
  if (/(sofistic|elegante|premium)/.test(lower)) tone = "sofisticado e acolhedor";
  else if (/(divertid|descontra|jovem)/.test(lower)) tone = "leve e descontraido";
  else if (/(tradicional|tradicion|famil|caseir)/.test(lower)) tone = "tradicional e acolhedor";

  const preview = text.split(/\s+/).filter(Boolean).join(" ").slice(0, 900);
  let notes = "Manual recebido.";
  if (preview) notes = "Manual lido automaticamente para extrair pistas de identidade.";
  else if (isPdf) notes = "Manual em PDF recebido (sem texto extraível — provavelmente imagem/scan).";

  const ai = await analyzeManualWithAi({ fileName, mimeType, bytes, text });
  const detectedColors = uniqueClean([...(ai?.color_palette ?? []), ...colors]).slice(0, 12);
  const detectedTypography = uniqueClean([...(ai?.typography ?? []), ...fonts]).slice(0, 12);

  return {
    notes: ai ? formatAiNotes(ai) : notes,
    extracted_text_preview: preview || null,
    detected_colors: detectedColors,
    detected_typography: detectedTypography,
    detected_tone: ai?.tone || tone,
    brand_manual_summary: ai ? buildSummary(ai) : preview || null,
  };
}

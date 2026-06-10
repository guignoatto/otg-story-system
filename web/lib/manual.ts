import "server-only";

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
};

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

  return {
    notes,
    extracted_text_preview: preview || null,
    detected_colors: colors,
    detected_typography: fonts,
    detected_tone: tone,
  };
}

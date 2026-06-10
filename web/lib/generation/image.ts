import "server-only";
import sharp from "sharp";
import heicConvert from "heic-convert";
import type { ClientProfile } from "../types";
import { splitLines } from "../utils";

export type ImageBriefInput = {
  client: ClientProfile;
  headline: string;
  body: string;
  cta: string;
  visual_direction: string;
  layout_style: string;
  output_format: string;
  objective?: string;
  story_type?: string;
  offer?: string;
};

const OBJECTIVE_INTENT: Record<string, string> = {
  vendas: "spark appetite and desire for the product",
  reservas: "evoke a special, planned occasion",
  engajamento: "invite interaction and conversation",
  awareness: "build brand identity and recognition",
  alcance_local: "highlight the local, neighborhood connection",
  relacionamento: "create warmth, closeness and everyday routine",
};

const STORY_TYPE_ANGLE: Record<string, string> = {
  promocao: "feature the product as today's highlight",
  bastidor: "an authentic behind-the-scenes feel",
  prova_social: "a social-proof / testimonial vibe",
  cardapio: "a menu showcase focused on flavor and texture",
  urgencia: "a timely reminder for this moment of the day",
};

function isDeliveryNight(client: ClientProfile): boolean {
  const text = `${client.slug} ${client.name} ${client.notes}`.toLowerCase();
  return (
    text.includes("heim") ||
    (text.includes("delivery") &&
      (text.includes("noite") || text.includes("noturno") || text.includes("night")))
  );
}

function operationalNote(client: ClientProfile, deliveryNight: boolean): string {
  if (deliveryNight) {
    return (
      "Operational context: this client is delivery-only and works at night. The creative must suggest dinner, " +
      "night cravings, comfort at home, delivery, and ordering for the evening. Never mention lunch, dining room, " +
      "restaurant visit, reservations, tables, or eating at the venue."
    );
  }
  const notes = splitLines(client.notes).join(". ");
  if (notes) return `Client operational notes: ${notes}. Follow these notes strictly.`;
  return "No special operational restrictions were provided.";
}

/**
 * Prompt de geração livre: o modelo usa a foto anexada como base, preserva o
 * produto/embalagem e o integra a um design editorial coeso da marca. Usa todo
 * o contexto selecionado no cliente (fontes, tom, cores, manual, local) e no
 * estúdio (objetivo, tipo de conteúdo, tema).
 */
export function buildImagePrompt(input: ImageBriefInput): string {
  const { client, output_format } = input;
  const deliveryNight = isDeliveryNight(client);
  const formatNote =
    output_format === "stories" ? "vertical Instagram story 9:16" : "vertical carousel cover 4:5";
  const colors = client.color_palette.length
    ? client.color_palette.slice(0, 5)
    : ["#0B2A1E", "#4598B2", "#F0B05F"];
  const colorNote = colors.join(", ");

  // Contexto de marca e briefing (tudo que foi selecionado no cliente e no estúdio).
  const fonts = client.typography.filter(Boolean);
  const fontNote = fonts.length
    ? `Typography: use lettering that closely resembles these brand fonts: ${fonts.join(", ")}.`
    : "Typography: use clean, professional lettering with strong hierarchy.";
  const toneNote = client.tone ? `Brand tone of voice: ${client.tone}.` : "";
  const locality = [client.neighborhood, client.city].filter(Boolean).join(", ");
  const localNote = locality ? `Local context: restaurant located in ${locality}.` : "";
  const manualText = [client.brand_manual_summary, client.synthetic_manual]
    .filter(Boolean)
    .join(" ");
  const manualNote = manualText ? `Brand manual summary (follow it): ${manualText}.` : "";
  const objectiveNote = input.objective && OBJECTIVE_INTENT[input.objective]
    ? `Campaign objective: ${OBJECTIVE_INTENT[input.objective]}.`
    : "";
  const angleNote = input.story_type && STORY_TYPE_ANGLE[input.story_type]
    ? `Content angle: ${STORY_TYPE_ANGLE[input.story_type]}.`
    : "";
  const offerNote = input.offer ? `Theme/product being featured: ${input.offer}.` : "";

  return [
    `Create a ${formatNote} creative for ${client.name}, a Brazilian restaurant brand.`,
    operationalNote(client, deliveryNight),

    // --- Contexto de marca + briefing ---
    toneNote,
    localNote,
    manualNote,
    objectiveNote,
    angleNote,
    offerNote,

    // --- Uso da foto base (preservar produto) ---
    "Use the attached photo as the base. PRESERVE the product/packaging exactly as it is — same shape, colors, logo, label, and texture. Do not invent a different dish or product. You may improve the framing, lighting, background and overall art direction so the photo blends into one cohesive editorial layout.",

    // --- Design e cores ---
    `Use ONLY these brand colors in the design and graphic elements: ${colorNote}. The creative should feel premium, appetizing, and professionally art-directed.`,
    fontNote,

    // --- Texto ---
    `Headline (short, bold, Portuguese): "${input.headline}".`,
    `Call-to-action as a small rounded editorial badge/pill: "${input.cta}".`,
    input.body ? `Supporting line in smaller type if there is room: "${input.body}".` : "",
    `Art direction reference: ${input.visual_direction}.`,

    // --- Logo safety ---
    "LOGO SAFETY: never invent, redraw, or add a new logo or wordmark. If a logo already exists in the photo, keep it as photographed. Do not place extra brand marks.",

    // --- Restrições ---
    "Portuguese spelling and accents must be perfect. Keep text minimal with strong hierarchy.",
    "No polls, quizzes, sliders, fake Instagram UI, fake buttons, interactive stickers, phone numbers, prices, or addresses. This is organic content, not a paid ad.",
    "The result must look like a polished restaurant story designed by a senior art director.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Normaliza a foto de origem (inclusive HEIC do iPhone) em um PNG limpo,
 * pronto para a API de edição de imagem da OpenAI (geração livre).
 */
export async function prepareSourceImage(params: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<Buffer> {
  const { bytes, mimeType, fileName } = params;
  const isHeic =
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    /\.(heic|heif)$/i.test(fileName);

  let input = bytes;
  if (isHeic) {
    // sharp normalmente não tem libheif; decodifica HEIC para JPEG antes.
    const out = await heicConvert({ buffer: bytes as Buffer, format: "JPEG", quality: 0.95 });
    input = Buffer.from(out);
  }

  return sharp(input)
    .rotate() // aplica orientação EXIF
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

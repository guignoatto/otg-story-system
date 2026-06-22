import "server-only";
import type { ClientProfile } from "../types";
import { splitLines } from "../utils";

// Módulo separado de image.ts de propósito: aqui não há import de sharp/heic,
// então rotas que só montam o prompt (ex.: /api/ai-images/prompt) não carregam
// binários nativos que não estão traçados para elas na Vercel.

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

function isFrangoNaBrazza(client: ClientProfile): boolean {
  const text = `${client.slug} ${client.name} ${client.instagram} ${client.notes} ${client.brand_manual_summary} ${client.synthetic_manual}`.toLowerCase();
  return text.includes("frango na brazza") || text.includes("frangonabrazza");
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

function clientSpecificCreativeGuard(client: ClientProfile): string {
  if (!isFrangoNaBrazza(client)) return "";
  return [
    "CLIENT-SPECIFIC GUARDRAILS FOR FRANGO NA BRAZZA:",
    "This brand is comida caseira, almoço, marmitex/prato feito and delivery routine. It is NOT a churrascaria, steakhouse, premium grill or fire/brasa concept.",
    "Use black, yellow and red only as graphic accents, with a popular, warm, direct look. The food should feel homemade, well served and real.",
    "Absolutely avoid flames, sparks, embers, charcoal, grill marks, barbecue atmosphere, aggressive grunge brush strokes, fast-food poster style, and words/visuals related to brasa, fogo, churrasco or grelhado.",
    "Do not create headlines such as 'Frango dourado perfeito' or 'Acolhimento no prato'. Prefer simple food-routine language like comida caseira, almoço bem servido, marmitex, prato feito and feito com sabor.",
  ].join(" ");
}

function ctaInstruction(cta: string): string {
  if (!cta.trim()) return "";
  return [
    `Optional CTA text, if it fits naturally: "${cta}".`,
    "Render CTA only as a subtle editorial caption/line of text. Never render it as a button, rounded pill, clickable badge, sticker, fake UI, bottom bar, or large visual component.",
  ].join(" ");
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

    // --- Uso da foto base (fidelidade de comida e produto) ---
    "Use the attached photo as the base. FOOD FIDELITY: the food must remain exactly as photographed — same texture, doneness, portion size, plating, dishware and sides. PRESERVE any product/packaging exactly as it is — same shape, colors, logo, label, and texture. Do not invent a different dish or product. Do not add or remove ingredients, garnishes, plates, cutlery, hands, or people.",
    "THIRD-PARTY BRAND SAFETY: do not add new soda cans, labels, logos or packaged products. If a beverage can or third-party brand already exists in the source photo, keep it secondary, do not enlarge it, do not make it the focal point, and do not redraw or repair the label. Prefer cropping it out when it is not essential.",

    // --- Fidelidade de ambiente ---
    "SCENE FIDELITY: keep the original environment of the photo — same location, surface, background and atmosphere. If you need to extend or clean up the background to fit the vertical format or the text, the extension must look like a natural continuation of the SAME photographed environment. NEVER relocate the dish to an invented setting (studio table, generic restaurant, landscape, marble countertop, or any place not present in the photo).",

    // --- Ajustes permitidos ---
    "The only allowed adjustments are: lighting and color polish, subtle depth of field, reframing/cropping, and GRAPHIC overlay elements (panels, headline, and small editorial caption text) layered on top of the photo.",

    // --- Design e cores ---
    `Use ONLY these brand colors for the graphic/overlay elements: ${colorNote}. Never recolor the food or the photographed scene. The creative should feel polished, appetizing, on-brand, and professionally art-directed.`,
    fontNote,
    clientSpecificCreativeGuard(client),

    // --- Texto ---
    `Headline (short, bold, Portuguese): "${input.headline}".`,
    ctaInstruction(input.cta),
    input.body ? `Supporting line in smaller type if there is room: "${input.body}".` : "",
    `Art direction reference: ${input.visual_direction}.`,

    // --- Logo safety ---
    "LOGO SAFETY: never invent, redraw, or add a new logo or wordmark. If a logo already exists in the photo, keep it as photographed. Do not place extra brand marks.",

    // --- Instagram ---
    output_format === "stories"
      ? "INSTAGRAM SAFE AREA: keep headline, supporting text and any CTA caption inside the central safe zone — avoid the top ~12% and bottom ~18% of the canvas, where Instagram overlays its UI and reply field. Never place a CTA bar at the bottom."
      : "INSTAGRAM: compose for the feed — text clearly legible at thumbnail size, key elements centered.",
    "The design must stop the scroll on a phone screen at first glance: one clear focal point, strong hierarchy, minimal text. Do not let typography cover more than about one third of the canvas; the real food remains the hero.",

    // --- Restrições ---
    "Portuguese spelling and accents must be perfect. Keep text minimal with strong hierarchy.",
    "No polls, quizzes, sliders, fake Instagram UI, fake buttons, CTA pills, CTA badges, bottom CTA bars, interactive stickers, phone numbers, prices, or addresses. This is organic content, not a paid ad.",
    "The result must look like a polished restaurant story designed by a senior art director.",
  ]
    .filter(Boolean)
    .join(" ");
}

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
  if (isFrangoNaBrazza(client)) {
    return (
      "Operational context: everyday Brazilian lunch, comida caseira, prato feito, marmitex and delivery routine. " +
      "Keep the real photographed meal and original restaurant environment as the core of the creative."
    );
  }
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

function sanitizeFrangoPromptText(value: string): string {
  return value
    .replace(/\bque\s+chama\s+sua\s+fome\b/gi, "que desperta sua fome")
    .replace(/\bchama\s+sua\s+fome\b/gi, "desperta sua fome")
    .replace(/\bfrango\s+assad(o|a|os|as)\b/gi, "frango caseiro")
    .replace(/\bassad(o|a|os|as)\b/gi, "caseiro")
    .replace(/\bbrasa(s)?\b/gi, "comida caseira")
    .replace(/\bchurrasc(o|aria|ueira)\b/gi, "comida caseira")
    .replace(/\bsteakhouse\b/gi, "restaurante caseiro")
    .replace(/\bgrelhad(o|a|os|as)\b/gi, "bem servido")
    .replace(/\bfogo\b/gi, "sabor")
    .replace(/\bchama(s)?\b/gi, "sabor")
    .replace(/\bfa[ií]sca(s)?\b/gi, "detalhes")
    .replace(/\blabareda(s)?\b/gi, "detalhes")
    .replace(/\bcarv[aã]o\b/gi, "mesa")
    .replace(/\bgrill(ed)?\b/gi, "homemade")
    .replace(/\bbarbecue\b/gi, "homemade food")
    .replace(/\bflame(s)?\b/gi, "warmth")
    .replace(/\bspark(s)?\b/gi, "details")
    .replace(/\bember(s)?\b/gi, "details")
    .replace(/\bcharcoal\b/gi, "table")
    .replace(/\bbrush\b/gi, "clean")
    .replace(/\bgrunge\b/gi, "clean")
    .replace(/\bfast-?food\b/gi, "everyday food")
    .replace(/\bcta\s+gigante\b/gi, "small plain caption")
    .replace(/rodap[eé]/gi, "central safe area")
    .replace(/\b(bot[aã]o|pill|badge|sticker|enquete|quiz)\b/gi, "plain text")
    .replace(/\bwhats(app)?\b/gi, "direct message")
    .replace(/\bzap\b/gi, "direct message")
    .replace(/\bsalv(e|ar|a)\b/gi, "envie")
    .replace(/\bguard(e|ar|a)\b/gi, "envie")
    .replace(/\b(sprite|coca-?cola|coca|fanta)\b/gi, "beverage can")
    .replace(/\bem destaque\b/gi, "em segundo plano")
    .replace(/\bdourado perfeito\b/gi, "almoço bem servido")
    .replace(/\bacolhimento no prato\b/gi, "comida caseira no prato")
    .replace(/\bcroc[âa]ncia\b/gi, "sabor")
    .replace(/\bcrocante(s)?\b/gi, "saboroso")
    .replace(/\s+/g, " ")
    .trim();
}

function clientSpecificCreativeGuidance(client: ClientProfile): string {
  if (!isFrangoNaBrazza(client)) return "";
  return [
    "CLIENT-SPECIFIC STYLE:",
    "Popular Brazilian lunch food: comida caseira, almoço, marmitex, prato feito and delivery routine.",
    "Use black, yellow and red as small graphic accents only, with a clean, direct, everyday look.",
    "The meal should feel homemade, abundant, accessible, realistic and well served.",
    "Use simple editorial composition: real photo first, clean typography, generous margins, soft contrast and food-first hierarchy.",
  ].join(" ");
}

function ctaInstruction(cta: string): string {
  if (!cta.trim()) return "";
  return [
    `Optional CTA text, if it fits naturally: "${cta}".`,
    "Render CTA only as a subtle editorial caption/line of text. Never render it as a button, rounded pill, clickable badge, sticker, fake UI, bottom bar, or large visual component.",
  ].join(" ");
}

function frangoCtaInstruction(cta: string): string {
  if (!cta.trim()) return "";
  return [
    `Optional small caption text: "${sanitizeFrangoPromptText(cta)}".`,
    "If used, place it as plain small type inside the central safe area, without icon, container, outline, colored background or platform symbol.",
  ].join(" ");
}

function visibleTextLock(input: ImageBriefInput, isFrango: boolean): string {
  const headline = isFrango ? sanitizeFrangoPromptText(input.headline) : input.headline.trim();
  const body = isFrango ? sanitizeFrangoPromptText(input.body) : input.body.trim();
  const cta = isFrango ? sanitizeFrangoPromptText(input.cta) : input.cta.trim();
  const allowedText = [headline, body, cta]
    .map((item) => item.trim())
    .filter(Boolean);

  if (!allowedText.length) {
    return "VISIBLE TEXT LOCK: keep the design mostly photographic, with no invented visible text.";
  }

  return [
    `VISIBLE TEXT LOCK: use only these exact Portuguese text strings: ${allowedText.map((item) => `"${item}"`).join("; ")}.`,
    "No additional headline, slogan, menu claim, restaurant name, product label, schedule, phone number, price or social-platform symbol.",
    "If exact text rendering is uncertain, use fewer words from the approved strings and keep the food photo clean.",
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
  const isFrango = isFrangoNaBrazza(client);
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
  const manualText = isFrango
    ? "Popular, direct and warm identity for comida caseira, almoço, marmitex, prato feito and delivery. Graphic accents in black, yellow and red. Real food photography is the hero."
    : [client.brand_manual_summary, client.synthetic_manual]
        .filter(Boolean)
        .join(" ");
  const manualNote = manualText ? `Brand manual summary (follow it): ${manualText}.` : "";
  const objectiveNote = input.objective && OBJECTIVE_INTENT[input.objective]
    ? isFrango
      ? "Campaign objective: create appetite and desire for a generous homemade meal."
      : `Campaign objective: ${OBJECTIVE_INTENT[input.objective]}.`
    : "";
  const angleNote = input.story_type && STORY_TYPE_ANGLE[input.story_type]
    ? `Content angle: ${STORY_TYPE_ANGLE[input.story_type]}.`
    : "";
  const offer = isFrango ? sanitizeFrangoPromptText(input.offer || "") : input.offer;
  const headline = isFrango ? sanitizeFrangoPromptText(input.headline) : input.headline;
  const body = isFrango ? sanitizeFrangoPromptText(input.body) : input.body;
  const visualDirection = isFrango ? sanitizeFrangoPromptText(input.visual_direction) : input.visual_direction;
  const offerNote = offer ? `Theme/product being featured: ${offer}.` : "";
  const openingBrand = isFrango ? "this Brazilian restaurant brand" : `${client.name}, a Brazilian restaurant brand`;
  const sourcePhotoRule = isFrango
    ? "Use the attached photo as the base. FOOD FIDELITY: the food must remain exactly as photographed — same texture, doneness, portion size, plating, dishware and sides. Preserve any package, can, label or object exactly as it appears in the photo. Keep the photographed meal as the only focal point. Add no new food, package, can, label, person, hand, utensil or extra object."
    : "Use the attached photo as the base. FOOD FIDELITY: the food must remain exactly as photographed — same texture, doneness, portion size, plating, dishware and sides. PRESERVE any product/packaging exactly as it is — same shape, colors, logo, label, and texture. Do not invent a different dish or product. Do not add or remove ingredients, garnishes, plates, cutlery, hands, or people.";
  const thirdPartyRule = isFrango
    ? "THIRD-PARTY BRAND SAFETY: if a beverage can or packaged brand already exists in the source photo, crop it out when possible or leave it small in the background. The meal stays dominant and all existing labels remain untouched."
    : "THIRD-PARTY BRAND SAFETY: do not add new soda cans, labels, logos or packaged products. If a beverage can or third-party brand already exists in the source photo, keep it secondary, do not enlarge it, do not make it the focal point, and do not redraw or repair the label. Prefer cropping it out when it is not essential.";
  const overlayRule = isFrango
    ? "The only allowed adjustments are: lighting and color polish, subtle depth of field, reframing/cropping, and clean editorial overlay elements such as simple panels, headline and small caption text."
    : "The only allowed adjustments are: lighting and color polish, subtle depth of field, reframing/cropping, and GRAPHIC overlay elements (panels, headline, and small editorial caption text) layered on top of the photo.";
  const instagramRule = output_format === "stories"
    ? isFrango
      ? "INSTAGRAM SAFE AREA: keep every approved text line inside the central safe zone, away from the top and bottom interface areas. Plain text only; the meal remains the hero."
      : "INSTAGRAM SAFE AREA: keep headline, supporting text and any CTA caption inside the central safe zone — avoid the top ~12% and bottom ~18% of the canvas, where Instagram overlays its UI and reply field. Never place a CTA bar at the bottom."
    : "INSTAGRAM: compose for the feed — text clearly legible at thumbnail size, key elements centered.";
  const finalOrganicRule = isFrango
    ? "Organic story layout: editorial food photo, minimal approved text, clean accents and no social-media interface elements. The result must feel like a senior designer polished a real restaurant photo, not like a paid ad poster."
    : "No polls, quizzes, sliders, fake Instagram UI, fake buttons, CTA pills, CTA badges, bottom CTA bars, interactive stickers, phone numbers, prices, or addresses. This is organic content, not a paid ad.";

  return [
    `Create a ${formatNote} creative for ${openingBrand}.`,
    operationalNote(client, deliveryNight),

    // --- Contexto de marca + briefing ---
    toneNote,
    localNote,
    manualNote,
    objectiveNote,
    angleNote,
    offerNote,

    // --- Uso da foto base (fidelidade de comida e produto) ---
    sourcePhotoRule,
    thirdPartyRule,

    // --- Fidelidade de ambiente ---
    "SCENE FIDELITY: keep the original environment of the photo — same location, surface, background and atmosphere. If you need to extend or clean up the background to fit the vertical format or the text, the extension must look like a natural continuation of the SAME photographed environment. NEVER relocate the dish to an invented setting (studio table, generic restaurant, landscape, marble countertop, or any place not present in the photo).",

    // --- Ajustes permitidos ---
    overlayRule,

    // --- Design e cores ---
    `Use ONLY these brand colors for the graphic/overlay elements: ${colorNote}. Never recolor the food or the photographed scene. The creative should feel polished, appetizing, on-brand, and professionally art-directed.`,
    fontNote,
    clientSpecificCreativeGuidance(client),

    // --- Texto ---
    visibleTextLock(input, isFrango),
    `Headline (short, bold, Portuguese): "${headline}".`,
    isFrango ? frangoCtaInstruction(input.cta) : ctaInstruction(input.cta),
    body ? `Supporting line in smaller type if there is room: "${body}".` : "",
    `Art direction reference: ${visualDirection}.`,

    // --- Logo safety ---
    "LOGO SAFETY: never invent, redraw, or add a new logo or wordmark. If a logo already exists in the photo, keep it as photographed. Do not place extra brand marks.",

    // --- Instagram ---
    instagramRule,
    "The design must stop the scroll on a phone screen at first glance: one clear focal point, strong hierarchy, minimal text. Do not let typography cover more than about one third of the canvas; the real food remains the hero.",

    // --- Restrições ---
    "Portuguese spelling and accents must be perfect. Keep text minimal with strong hierarchy.",
    finalOrganicRule,
    "The result must look like a polished restaurant story designed by a senior art director.",
  ]
    .filter(Boolean)
    .join(" ");
}

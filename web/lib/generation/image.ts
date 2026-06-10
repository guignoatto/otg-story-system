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

/** Port of `_build_ai_image_prompt`: brand-safe, logo-safe organic Stories prompt. */
export function buildImagePrompt(input: ImageBriefInput): string {
  const { client, output_format } = input;
  const deliveryNight = isDeliveryNight(client);
  const formatNote =
    output_format === "stories" ? "vertical story 9:16" : "vertical carousel cover 4:5";
  const organicActionRules =
    output_format === "stories"
      ? "For Instagram Stories, valid organic actions are: reply by DM, emoji reaction, share/send in Direct, or continue watching the next story. Do not use save/salve/guardar, comments, feed saves, fake buttons, or link prompts unless a real native sticker will be added later outside the image."
      : "For carousel/feed content, save/share/comment language can be used when it fits the concept, but do not draw fake app buttons or fake Instagram UI.";
  const colors = client.color_palette.length
    ? client.color_palette.slice(0, 5)
    : ["#0B2A1E", "#4598B2", "#F0B05F"];
  const colorNote = colors.join(", ");

  return [
    `Create a premium social media creative for ${client.name}, a restaurant brand served by OTG Midia.`,
    `Brand context for mood only: ${client.name}. Do not render the brand name as a logo or wordmark.`,
    operationalNote(client, deliveryNight),
    "Use the provided image as the real product/order reference and preserve the dish/order accurately. Do not invent a different dish. Improve lighting, composition, background and editorial polish while keeping the food realistic and appetizing.",
    `Format: ${formatNote}. Brand colors: ${colorNote}.`,
    "Brand feeling: respect the restaurant's own brand manual, tone, cuisine, and positioning. The creative should feel appetizing, polished, local, and professionally art-directed.",
    "CRITICAL BRAND SAFETY RULE: never create, redraw, restyle, complete, enhance, sharpen, reconstruct, move, duplicate, or invent any logo, wordmark, crown, roof icon, flag icon, monogram, embroidered mark, packaging logo, glass logo, napkin logo, or any stylized text that looks like a brand mark. Do not place any logo at the top, bottom, corner, or center of the creative. If a logo or brand mark already exists inside the source photo, preserve it exactly as photographed: same blur, crop, angle, distortion, partial visibility, and imperfections. Do not fix it. If the logo would be unclear, leave it unclear or crop around it; never regenerate it. The official logo will be added later by the design system outside the AI generation.",
    organicActionRules,
    `Creative layout style: ${input.layout_style}. Visual direction: ${input.visual_direction}.`,
    `Main headline to include if legible: ${input.headline}.`,
    `Support copy: ${input.body}. Organic story interaction cue: ${input.cta}.`,
    "Use very little text on the image. Do not create polls, quizzes, question boxes, sliders, reaction bars, Instagram UI elements, fake buttons, or interactive stickers. Do not invent poll options, menu items, phone numbers, handles, prices, addresses, or extra claims. Treat the organic cue as a small editorial text badge only, never as an app component.",
    "Double-check Portuguese spelling and accents. If text clarity is uncertain, keep only the headline and the organic cue.",
    "This is organic Instagram Stories content, not a paid Meta ad. Do not add WhatsApp buttons, fake app buttons, click-to-WhatsApp CTAs, prices, hard-sell language, or ad-style conversion buttons. Prefer quiet organic behaviors that are native to the selected format.",
    "Use clean Portuguese typography, strong hierarchy, enough safe margins for Instagram UI, and avoid clutter. The final image should feel like a polished restaurant story designed by a senior art director.",
  ].join(" ");
}

/**
 * Normalizes a source photo (incl. iPhone HEIC) into a clean PNG buffer
 * suitable for the OpenAI image edit API. Port of `_prepare_openai_image`.
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
    // sharp builds usually lack libheif; decode HEIC to JPEG first.
    const out = await heicConvert({ buffer: bytes as Buffer, format: "JPEG", quality: 0.95 });
    input = Buffer.from(out);
  }

  return sharp(input)
    .rotate() // apply EXIF orientation
    .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

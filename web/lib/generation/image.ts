import "server-only";
import sharp from "sharp";
import heicConvert from "heic-convert";

// O prompt de imagem mora em image-prompt.ts (sem dependências nativas).
// Este módulo fica restrito ao que precisa de sharp/heic, cujos binários só
// estão traçados para /api/ai-images/generate no next.config.ts.
export { buildImagePrompt, type ImageBriefInput } from "./image-prompt";

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

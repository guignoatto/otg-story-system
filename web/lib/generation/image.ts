import "server-only";
import sharp from "sharp";
import heicConvert from "heic-convert";

type SharpPipeline = ReturnType<typeof sharp>;
type SharpWithExtract = SharpPipeline & {
  extract(region: { left: number; top: number; width: number; height: number }): SharpPipeline;
};

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

/**
 * Reenquadra fotos do Frango na Brazza para priorizar o prato e reduzir
 * elementos de fundo que costumam virar protagonistas na geração.
 */
export async function prepareFrangoMealFocusImage(pngBytes: Buffer): Promise<Buffer> {
  const meta = await sharp(pngBytes).rotate().metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return pngBytes;

  const targetAspect = 2 / 3;
  const cropWidth = Math.max(1, Math.min(width, Math.round(width * 0.7)));
  const cropHeight = Math.max(1, Math.min(height, Math.round(cropWidth / targetAspect)));
  const left = Math.max(0, Math.min(width - cropWidth, Math.round(width * 0.3)));
  const top = Math.max(0, Math.min(height - cropHeight, Math.round(height * 0.43)));

  return (sharp(pngBytes).rotate() as unknown as SharpWithExtract)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: 1024, height: 1536, fit: "cover" })
    .png()
    .toBuffer();
}

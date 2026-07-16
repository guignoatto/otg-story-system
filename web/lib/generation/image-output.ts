import sharp from "sharp";

export type ImageOutputFormat = "stories" | "carrossel";

export type ImageOutputSpec = {
  format: ImageOutputFormat;
  generationSize: string;
  exportWidth: number;
  exportHeight: number;
  aspectRatio: "9:16" | "4:5";
};

const IMAGE_OUTPUT_SPECS: Record<ImageOutputFormat, ImageOutputSpec> = {
  stories: {
    format: "stories",
    generationSize: "1152x2048",
    exportWidth: 1080,
    exportHeight: 1920,
    aspectRatio: "9:16",
  },
  carrossel: {
    format: "carrossel",
    generationSize: "1280x1600",
    exportWidth: 1080,
    exportHeight: 1350,
    aspectRatio: "4:5",
  },
};

export function getImageOutputSpec(outputFormat?: string): ImageOutputSpec {
  return outputFormat === "carrossel"
    ? IMAGE_OUTPUT_SPECS.carrossel
    : IMAGE_OUTPUT_SPECS.stories;
}

export async function normalizeImageOutput(params: {
  bytes: Buffer;
  spec: ImageOutputSpec;
}): Promise<Buffer> {
  const { bytes, spec } = params;
  const normalized = await sharp(bytes)
    .rotate()
    .resize({
      width: spec.exportWidth,
      height: spec.exportHeight,
      fit: "cover",
    })
    .png()
    .toBuffer();

  const metadata = await sharp(normalized).metadata();
  if (metadata.width !== spec.exportWidth || metadata.height !== spec.exportHeight) {
    throw new Error(
      `Falha ao normalizar a arte para ${spec.aspectRatio}: esperado ${spec.exportWidth}x${spec.exportHeight}, recebido ${metadata.width ?? 0}x${metadata.height ?? 0}.`
    );
  }

  return normalized;
}

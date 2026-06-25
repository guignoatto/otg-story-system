import "server-only";
import sharp from "sharp";
import type { Asset } from "../types";

export type LogoPolicy = "none" | "discreet" | "required" | "source_only";

export function isLogoPolicy(value: unknown): value is LogoPolicy {
  return value === "none" || value === "discreet" || value === "required" || value === "source_only";
}

type SharpWithAlphaTools = {
  ensureAlpha: () => SharpRawPipeline;
  extract: (options: { left: number; top: number; width: number; height: number }) => ReturnType<typeof sharp>;
};

const sharpFactory = sharp as unknown as (
  input?: Buffer,
  options?: { raw: { width: number; height: number; channels: 4 } }
) => ReturnType<typeof sharp>;

type SharpRawPipeline = {
  raw: () => {
    toBuffer: (options: { resolveWithObject: true }) => Promise<{
      data: Buffer;
      info: { width: number; height: number };
    }>;
  };
};

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

function averageCorner(
  data: Buffer,
  width: number,
  height: number,
  startX: number,
  startY: number
): { color: [number, number, number]; opaqueRatio: number } {
  const sample = 24;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  let opaque = 0;
  for (let y = startY; y < Math.min(height, startY + sample); y += 1) {
    for (let x = startX; x < Math.min(width, startX + sample); x += 1) {
      const index = (y * width + x) * 4;
      if ((data[index + 3] ?? 0) > 12) {
        r += data[index] ?? 0;
        g += data[index + 1] ?? 0;
        b += data[index + 2] ?? 0;
        opaque += 1;
      }
      count += 1;
    }
  }
  const divisor = Math.max(1, opaque);
  return { color: [r / divisor, g / divisor, b / divisor], opaqueRatio: opaque / Math.max(1, count) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function removeEdgeConnectedBackground(data: Buffer, width: number, height: number): void {
  const cornerColors = [
    averageCorner(data, width, height, 0, 0),
    averageCorner(data, width, height, Math.max(0, width - 24), 0),
    averageCorner(data, width, height, 0, Math.max(0, height - 24)),
    averageCorner(data, width, height, Math.max(0, width - 24), Math.max(0, height - 24)),
  ]
    .filter((corner) => corner.opaqueRatio > 0.5)
    .map((corner) => corner.color)
    .reduce<[number, number, number][]>((colors, color) => {
    if (!colors.some((existing) => colorDistance(existing, color) < 35)) colors.push(color);
    return colors;
  }, []);
  if (cornerColors.length === 0) return;

  const edgeDistances: number[] = [];
  const distanceFromBackground = (x: number, y: number): number => {
    const index = (y * width + x) * 4;
    const color: [number, number, number] = [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0];
    return Math.min(...cornerColors.map((background) => colorDistance(color, background)));
  };
  for (let x = 0; x < width; x += 1) {
    edgeDistances.push(distanceFromBackground(x, 0), distanceFromBackground(x, height - 1));
  }
  for (let y = 0; y < height; y += 1) {
    edgeDistances.push(distanceFromBackground(0, y), distanceFromBackground(width - 1, y));
  }
  const threshold = Math.max(38, Math.min(92, median(edgeDistances) + 30));
  const visited = new Uint8Array(width * height);
  const queue: Array<[number, number]> = [];
  const isBackgroundLike = (x: number, y: number): boolean => {
    const index = (y * width + x) * 4;
    const alpha = data[index + 3] ?? 0;
    return alpha < 8 || distanceFromBackground(x, y) <= threshold;
  };
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index] || !isBackgroundLike(x, y)) return;
    visited[index] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index]!;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let index = 0; index < visited.length; index += 1) {
    if (visited[index]) data[index * 4 + 3] = 0;
  }
}

async function removeBackgroundAndTrimEdges(bytes: Buffer): Promise<Buffer> {
  const image = (sharp(bytes) as unknown as SharpWithAlphaTools).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  removeEdgeConnectedBackground(data, info.width, info.height);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return bytes;
  const padding = 2;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(info.width - 1, maxX + padding);
  maxY = Math.min(info.height - 1, maxY + padding);

  return (sharpFactory(Buffer.from(data), { raw: { width: info.width, height: info.height, channels: 4 } }) as unknown as SharpWithAlphaTools)
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();
}

export async function normalizeLogoPng(bytes: Buffer): Promise<Buffer> {
  const tightLogo = await removeBackgroundAndTrimEdges(bytes);
  return sharp(tightLogo)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

export async function applyOfficialLogo(params: {
  imageBytes: Buffer;
  logoBytes: Buffer;
  logo: Asset;
  policy: LogoPolicy;
}): Promise<Buffer> {
  const { imageBytes, logoBytes, policy } = params;
  if (policy === "none" || policy === "source_only") return imageBytes;

  const baseMeta = await sharp(imageBytes).metadata();
  const baseWidth = baseMeta.width ?? 1024;
  const baseHeight = baseMeta.height ?? 1536;
  const maxLogoWidth = Math.round(baseWidth * (policy === "required" ? 0.18 : 0.14));
  const maxLogoHeight = Math.round(baseHeight * 0.08);
  const margin = Math.round(baseWidth * 0.055);
  const tightLogo = await removeBackgroundAndTrimEdges(logoBytes);

  const normalizedLogo = await sharp(tightLogo)
    .rotate()
    .resize({
      width: maxLogoWidth,
      height: maxLogoHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const logoMeta = await sharp(normalizedLogo).metadata();
  const logoWidth = logoMeta.width ?? maxLogoWidth;
  const logoHeight = logoMeta.height ?? maxLogoHeight;

  return sharp(imageBytes)
    .composite([
      {
        input: normalizedLogo,
        left: Math.max(margin, baseWidth - logoWidth - margin),
        top: Math.max(margin, baseHeight - logoHeight - margin),
      },
    ])
    .png()
    .toBuffer();
}

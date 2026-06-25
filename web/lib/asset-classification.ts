import type { Asset } from "./types";

const LOGO_FILE_PATTERNS = [
  /\blogo\b/i,
  /\blogotipo\b/i,
  /\blogomarca\b/i,
  /\bwordmark\b/i,
  /\bs[íi]mbolo\b/i,
  /\bicone\b/i,
  /\bícone\b/i,
  /\bassinatura\b/i,
  /\bbrand\b/i,
  /\bidentidade\b/i,
  /\bsvg\b/i,
  /\bpng\s*transparente\b/i,
];

const NON_GENERATABLE_FILE_PATTERNS = [
  ...LOGO_FILE_PATTERNS,
  /\bcard[aá]pio\b/i,
  /\bmenu\b/i,
  /\bprint\b/i,
  /\bscreenshot\b/i,
  /\bcaptura\b/i,
  /\bmockup\b/i,
  /\barte\b/i,
  /\bpost\b/i,
  /\bstory\b/i,
  /\bfeed\b/i,
  /\bbanner\b/i,
  /\bflyer\b/i,
  /\bpanfleto\b/i,
  /\btemplate\b/i,
  /\bcriativo\b/i,
  /\bdesign\b/i,
  /\bcapa\b/i,
  /\bqr\b/i,
  /\bqrcode\b/i,
];

function assetSearchText(asset: Pick<Asset, "file_name" | "notes" | "extracted_text_preview" | "storage_path" | "role">): string {
  return [
    asset.role,
    asset.file_name,
    asset.storage_path,
    asset.notes ?? "",
    asset.extracted_text_preview ?? "",
  ].join(" ");
}

export function isProbablyLogoAsset(asset: Pick<Asset, "file_name" | "notes" | "extracted_text_preview" | "storage_path" | "role">): boolean {
  if (asset.role === "logo") return true;
  const text = assetSearchText(asset);
  return /\[asset_type:logo\]/i.test(text) || LOGO_FILE_PATTERNS.some((pattern) => pattern.test(text));
}

export function isGeneratableMediaAsset(asset: Asset): boolean {
  if (asset.role !== "media") return false;
  if (!asset.mime_type.startsWith("image/")) return false;
  const text = assetSearchText(asset);
  if (NON_GENERATABLE_FILE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return !isProbablyLogoAsset(asset);
}

export function uniqueAssetsById(assets: Asset[]): Asset[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

import type { CampaignFormState, StoryFrame } from "../types";

type DrawOptions = {
  frame: StoryFrame;
  imageUrl: string;
  form: CampaignFormState;
};

function previewSize(outputFormat: CampaignFormState["outputFormat"]): { width: number; height: number } {
  return outputFormat === "carrossel" ? { width: 1080, height: 1350 } : { width: 1080, height: 1920 };
}

function fitImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const scale = Math.max(width / image.width, height / image.height);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel carregar a imagem do frame."));
    image.src = imageUrl;
  });
}

export async function drawFrameToCanvas({ frame, imageUrl, form }: DrawOptions): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const { width, height } = previewSize(form.outputFormat);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponivel neste navegador.");

  const colors = form.colorPalette.split(",").map((item) => item.trim()).filter(Boolean);
  const primary = colors[0] || "#0B2A1E";
  const secondary = colors[1] || "#4598B2";
  const accent = colors[2] || "#F0B05F";
  const layout = frame.layout_style || "editorial";
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(1, secondary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (imageUrl) {
    const image = await loadImage(imageUrl);
    fitImage(ctx, image, width, height);
  }

  if (layout === "split") {
    ctx.fillStyle = primary;
    ctx.fillRect(0, height * 0.58, width, height * 0.42);
    ctx.fillStyle = accent;
    ctx.fillRect(72, height * 0.58, 180, 12);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 72px Sora";
    wrapText(ctx, frame.headline, 72, height * 0.68, width - 144, 82);
  } else if (layout === "sticker") {
    ctx.fillStyle = "rgba(11, 42, 30, 0.34)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(72, height * 0.56, width - 144, 250, 42);
    ctx.fill();
    ctx.fillStyle = primary;
    ctx.font = "800 68px Sora";
    wrapText(ctx, frame.headline, 112, height * 0.65, width - 224, 76);
  } else if (layout === "full_bleed") {
    ctx.fillStyle = "rgba(11, 42, 30, 0.46)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(52, 52, width - 104, height - 104);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 86px Sora";
    wrapText(ctx, frame.headline, 82, height * 0.52, width - 164, 96);
  } else if (layout === "quote") {
    ctx.fillStyle = primary;
    ctx.globalAlpha = imageUrl ? 0.82 : 1;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.font = "800 140px Sora";
    ctx.fillText("\u201C", 72, 230);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 76px Sora";
    wrapText(ctx, frame.headline, 92, height * 0.36, width - 184, 88);
  } else if (layout === "save_card") {
    ctx.fillStyle = "rgba(11, 42, 30, 0.52)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(72, height * 0.5, width - 144, 320, 34);
    ctx.fill();
    ctx.fillStyle = primary;
    ctx.font = "800 74px Sora";
    wrapText(ctx, frame.headline, 112, height * 0.61, width - 224, 82);
  } else {
    ctx.fillStyle = "rgba(11, 42, 30, 0.50)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(72, 72, 160, 12);
    ctx.fillStyle = "#fffdf8";
    ctx.font = "800 82px Sora";
    wrapText(ctx, frame.headline, 72, height * 0.55, width - 144, 92);
  }

  ctx.font = "400 38px Sora";
  ctx.fillStyle = "#fff7ea";
  const body = frame.body.replace(/Selecionar uma midia.*$/, "").replace(/Usar a midia real.*$/, "").trim();
  wrapText(ctx, body, 72, height - 300, width - 144, 48);

  ctx.fillStyle = "rgba(255, 253, 248, 0.92)";
  ctx.beginPath();
  ctx.roundRect(96, height - 190, width - 192, 96, 44);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = primary;
  ctx.font = "800 38px Sora";
  wrapText(ctx, frame.cta, 132, height - 130, width - 264, 44);

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Nao foi possivel montar o PNG deste frame."));
    }, "image/png");
  });
}

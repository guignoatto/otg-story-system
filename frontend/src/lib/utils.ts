import type { CampaignFormState, StoryFrame } from "../types";

export function clientNotes(items: string[]): string {
  return items.join("\n");
}

export function slugify(value: string): string {
  return (
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "restaurante"
  );
}

export function splitCsv(value: string): string[] {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitLines(value: string): string[] {
  return String(value)
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatDriveSize(bytes?: number | null): string {
  if (!bytes) return "tamanho nao informado";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDriveDate(value?: string | null): string {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function frameImageFileName(clientId: string, frame: StoryFrame, kind: "ia" | "preview" = "preview"): string {
  const frameNumber = String(frame.index).padStart(2, "0");
  return `${slugify(clientId)}-story-${frameNumber}-${kind}.png`;
}

export function formDefaults(): CampaignFormState {
  return {
    restaurantName: "Heim",
    clientId: "heim",
    objective: "vendas",
    outputFormat: "stories",
    storyType: "promocao",
    frames: 4,
    offer: "Pedido especial da noite",
    cta: "Mande para quem pediria junto",
    clientNotes: "Heim e apenas delivery.\nFunciona a noite.\nNao mencionar almoco.\nNao mencionar salao, reserva, visita ou mesa no restaurante.",
    city: "Porto Alegre",
    neighborhood: "",
    toneOfVoice: "tradicional e acolhedor",
    colorPalette: "#0B2A1E,#4598B2,#F0B05F",
    typography: "Dragon EF,Quiche Display",
    mediaSourceUrl: "https://drive.google.com/drive/folders/1iSIrPzJbNbl0II8AqSpEaKkIFTRzz9Na?usp=sharing",
  };
}

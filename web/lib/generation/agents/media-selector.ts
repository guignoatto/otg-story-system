import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import type { Asset, MediaAssignment, MediaInsight } from "../../types";
import type { GeneratedFrame } from "../frames";

const ASSIGNMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          frame_index: { type: "integer" },
          asset_id: { type: ["string", "null"] },
          file_name: { type: ["string", "null"] },
          rationale: {
            type: "string",
            description: "Motivo curto em pt-BR para a escolha da mídia.",
          },
        },
        required: ["frame_index", "asset_id", "file_name", "rationale"],
      },
    },
  },
  required: ["assignments"],
} as const;

function frameLine(frame: GeneratedFrame): string {
  return [
    `#${frame.index}`,
    frame.weekly_day ? `dia=${frame.weekly_day}` : "",
    frame.daily_slot ? `slot=${frame.daily_slot}/3` : "",
    frame.content_pillar ? `pilar=${frame.content_pillar}` : "",
    frame.content_goal ? `proposta=${frame.content_goal}` : "",
    `headline="${frame.headline}"`,
    frame.body ? `body="${frame.body}"` : "",
    frame.visual_direction ? `direcao="${frame.visual_direction}"` : "",
  ].filter(Boolean).join(" | ");
}

function mediaLine(asset: Asset, insight?: MediaInsight): string {
  if (!insight) {
    return `- asset_id="${asset.id}" file_name="${asset.file_name}"`;
  }

  const bestFor = insight.best_for.length ? ` | ideal=${insight.best_for.join(", ")}` : "";
  const avoidFor = insight.avoid_for.length ? ` | evitar=${insight.avoid_for.join(", ")}` : "";
  return [
    `- asset_id="${asset.id}" file_name="${asset.file_name}"`,
    `descricao="${insight.visual_description}"`,
    `mood="${insight.mood}"`,
    `qualidade=${insight.quality_score}/10`,
    bestFor,
    avoidFor,
  ].filter(Boolean).join(" | ");
}

function deterministicFallback(frames: GeneratedFrame[], media: Asset[]): MediaAssignment[] {
  return frames.map((frame, index) => {
    const asset = media[index % Math.max(1, media.length)] ?? null;
    return {
      frame_index: frame.index,
      asset_id: asset?.id ?? null,
      file_name: asset?.file_name ?? null,
      rationale: asset
        ? "Fallback automático: distribuição em rodízio porque o seletor de mídia ficou indisponível."
        : "Nenhuma mídia disponível para este frame.",
    };
  });
}

export async function selectMediaForFrames(params: {
  frames: GeneratedFrame[];
  media: Asset[];
  mediaInsights: MediaInsight[];
}): Promise<MediaAssignment[]> {
  const { frames, media, mediaInsights } = params;
  if (!media.length) return deterministicFallback(frames, media);

  const insightByAssetId = new Map(mediaInsights.map((insight) => [insight.asset_id, insight]));
  const insightByName = new Map(mediaInsights.map((insight) => [insight.file_name, insight]));

  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "Você é o agente de seleção de mídias da OTG Mídia.",
          "Você NÃO cria pauta, texto nem estratégia. Sua única tarefa é casar cada ideia de story com a melhor mídia real disponível.",
          "",
          "REGRAS:",
          "- Use somente asset_id e file_name listados. Nunca invente arquivo.",
          "- Priorize aderência entre ideia do frame, conteúdo visual, qualidade da foto e variedade da semana.",
          "- Evite escolher fotos de molho, condimento, detalhe secundário ou assunto repetitivo para muitos frames.",
          "- Evite mídia com avoid_for contendo ai_generation ou hero quando houver alternativa melhor.",
          "- Não use a mesma foto em frames consecutivos.",
          "- Tente variar assunto visual ao longo do dia e da semana: produto, embalagem, bastidor, detalhe, sobremesa, ambiente, textura.",
          "- Se todas as opções forem ruins para um frame, escolha a menos ruim e explique no rationale.",
          "- Para cada frame, retorne exatamente um asset_id e file_name quando houver mídia disponível.",
          "- Responda apenas em português do Brasil.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "FRAMES PLANEJADOS:",
          frames.map(frameLine).join("\n"),
          "",
          "BANCO DE MÍDIAS DISPONÍVEL:",
          media.map((asset) => mediaLine(asset, insightByAssetId.get(asset.id) ?? insightByName.get(asset.file_name))).join("\n"),
          "",
          `Retorne ${frames.length} assignments, um para cada frame_index.`,
        ].join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "media_assignments", strict: true, schema: ASSIGNMENT_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return deterministicFallback(frames, media);

  const parsed = JSON.parse(raw) as { assignments: MediaAssignment[] };
  const validById = new Map(media.map((asset) => [asset.id, asset]));
  const validByName = new Map(media.map((asset) => [asset.file_name, asset]));
  const fallback = deterministicFallback(frames, media);
  const fallbackByFrame = new Map(fallback.map((assignment) => [assignment.frame_index, assignment]));
  const assignmentByFrame = new Map<number, MediaAssignment>();

  for (const assignment of parsed.assignments) {
    const asset = assignment.asset_id
      ? validById.get(assignment.asset_id)
      : assignment.file_name
        ? validByName.get(assignment.file_name)
        : null;
    if (!asset) continue;
    assignmentByFrame.set(assignment.frame_index, {
      frame_index: assignment.frame_index,
      asset_id: asset.id,
      file_name: asset.file_name,
      rationale: assignment.rationale || "Mídia escolhida por aderência ao frame.",
    });
  }

  return frames.map((frame) => assignmentByFrame.get(frame.index) ?? fallbackByFrame.get(frame.index)!);
}

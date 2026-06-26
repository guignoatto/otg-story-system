import "server-only";
import { runMediaCurator } from "./agents/media-curator";
import { runBrandGuard, fallbackBrandContext } from "./agents/brand-guard";
import { runQA } from "./agents/qa";
import { selectMediaForFrames } from "./agents/media-selector";
import { generateFrames } from "./frames";
import { getClientLearningMemory } from "../data/feedback";
import type { Asset, ClientProfile, GenerationBrief } from "../types";
import type { GenerationResult } from "./frames";

export type PipelineResult = GenerationResult & {
  qa_notes: string;
};

/**
 * Multi-agent pipeline:
 * 1. MediaCurator + BrandGuard em paralelo (independentes)
 * 2. CreativeGenerator com contexto enriquecido
 * 3. QA independente para validação e correção
 *
 * Os agentes auxiliares degradam graciosamente: uma falha pontual neles não
 * derruba a geração — só o CreativeGenerator é indispensável.
 */
export async function generatePackage(params: {
  client: ClientProfile;
  brief: GenerationBrief;
  media: Asset[];
}): Promise<PipelineResult> {
  const { client, brief, media } = params;

  // Fase 1: agentes de contexto em paralelo (enriquecimento opcional)
  const [mediaInsights, brandContext, clientMemory] = await Promise.all([
    runMediaCurator(media).catch((err) => {
      console.error("MediaCurator falhou; gerando sem insights de mídia.", err);
      return [];
    }),
    runBrandGuard(client).catch((err) => {
      console.error("BrandGuard falhou; usando contexto de marca mínimo.", err);
      return fallbackBrandContext(client);
    }),
    getClientLearningMemory(client.id).catch((err) => {
      console.error("Memória do cliente indisponível; gerando sem histórico de aprovações.", err);
      return { approved: [], rejected: [], approval_patterns: [], rejection_patterns: [] };
    }),
  ]);

  // Fase 2: geração com contexto enriquecido (obrigatória — erro propaga)
  const generation = await generateFrames({
    client,
    brief,
    media,
    mediaInsights,
    brandContext,
    clientMemory,
    deferMediaSelection: brief.defer_media_selection || brief.weekly_batch,
  });

  // Fase 3: QA independente (opcional — em falha, publica os frames originais)
  let frames = generation.frames;
  let qaNotes = "";
  try {
    const qa = await runQA({
      frames: generation.frames,
      brandContext,
      brief,
    });
    // Reconcilia por índice: usa a versão revisada pelo QA quando existir,
    // mantendo a contagem original mesmo que o QA omita ou adicione frames.
    const qaByIndex = new Map(qa.frames.map((f) => [f.index, f]));
    frames = generation.frames.map((f) => qaByIndex.get(f.index) ?? f);
    qaNotes = qa.qa_notes;
  } catch (err) {
    console.error("QA falhou; frames publicados sem revisão automática.", err);
    qaNotes = "QA indisponível nesta geração; frames publicados sem revisão automática.";
  }

  if ((brief.defer_media_selection || brief.weekly_batch) && media.length) {
    try {
      const assignments = await selectMediaForFrames({ frames, media, mediaInsights });
      const assignmentByFrame = new Map(assignments.map((assignment) => [assignment.frame_index, assignment]));
      frames = frames.map((frame) => {
        const assignment = assignmentByFrame.get(frame.index);
        return assignment ? { ...frame, media_filename: assignment.file_name } : frame;
      });
      const selectionNotes = assignments
        .slice(0, 6)
        .map((assignment) => `#${assignment.frame_index}: ${assignment.file_name ?? "sem mídia"} - ${assignment.rationale}`)
        .join("\n");
      qaNotes = [qaNotes, `Seleção de mídia pós-pauta aplicada.\n${selectionNotes}`]
        .filter(Boolean)
        .join("\n\n");
    } catch (err) {
      console.error("MediaSelector falhou; usando fallback por ordem.", err);
      frames = frames.map((frame, index) => ({
        ...frame,
        media_filename: media[index % media.length]?.file_name ?? frame.media_filename,
      }));
      qaNotes = [qaNotes, "MediaSelector indisponível; mídias distribuídas em rodízio como fallback."]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  return {
    ...generation,
    frames,
    qa_notes: qaNotes,
  };
}

import "server-only";
import { runMediaCurator } from "./agents/media-curator";
import { runBrandGuard, fallbackBrandContext } from "./agents/brand-guard";
import { runQA } from "./agents/qa";
import { generateFrames } from "./frames";
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
  const [mediaInsights, brandContext] = await Promise.all([
    runMediaCurator(media).catch((err) => {
      console.error("MediaCurator falhou; gerando sem insights de mídia.", err);
      return [];
    }),
    runBrandGuard(client).catch((err) => {
      console.error("BrandGuard falhou; usando contexto de marca mínimo.", err);
      return fallbackBrandContext(client);
    }),
  ]);

  // Fase 2: geração com contexto enriquecido (obrigatória — erro propaga)
  const generation = await generateFrames({
    client,
    brief,
    media,
    mediaInsights,
    brandContext,
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

  return {
    ...generation,
    frames,
    qa_notes: qaNotes,
  };
}

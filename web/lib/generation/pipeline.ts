import "server-only";
import { runMediaCurator } from "./agents/media-curator";
import { runBrandGuard } from "./agents/brand-guard";
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
 */
export async function generatePackage(params: {
  client: ClientProfile;
  brief: GenerationBrief;
  media: Asset[];
}): Promise<PipelineResult> {
  const { client, brief, media } = params;

  // Fase 1: agentes de contexto em paralelo
  const [mediaInsights, brandContext] = await Promise.all([
    runMediaCurator(media),
    runBrandGuard(client),
  ]);

  // Fase 2: geração com contexto enriquecido
  const generation = await generateFrames({
    client,
    brief,
    media,
    mediaInsights,
    brandContext,
  });

  // Fase 3: QA independente
  const qa = await runQA({
    frames: generation.frames,
    brandContext,
    brief,
  });

  // Reconcilia por índice: usa a versão revisada pelo QA quando existir,
  // mantendo a contagem original mesmo que o QA omita ou adicione frames.
  const qaByIndex = new Map(qa.frames.map((f) => [f.index, f]));
  const frames = generation.frames.map((f) => qaByIndex.get(f.index) ?? f);

  return {
    ...generation,
    frames,
    qa_notes: qa.qa_notes,
  };
}

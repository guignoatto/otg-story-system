import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import type { Asset, MediaInsight } from "../../types";

const INSIGHT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          asset_id: { type: "string" },
          file_name: { type: "string" },
          visual_description: {
            type: "string",
            description: "Descrição objetiva do conteúdo visual em pt-BR (ex: 'close-up de picanha na brasa, fundo escuro, fumaça visível').",
          },
          mood: {
            type: "string",
            description: "Sensação transmitida pela imagem (ex: 'quente, apetitoso, noturno').",
          },
          quality_score: {
            type: "number",
            description: "0-10, onde 10 é fotografia profissional limpa e 0 é desfocada/escura demais.",
          },
          best_for: {
            type: "array",
            items: { type: "string" },
            description: "Objetivos de campanha para os quais esta foto funciona melhor.",
          },
          avoid_for: {
            type: "array",
            items: { type: "string" },
            description: "Objetivos ou usos nos quais esta foto seria inapropriada ou fraca. Pode incluir ai_generation, hero e frango_na_brazza.",
          },
        },
        required: ["asset_id", "file_name", "visual_description", "mood", "quality_score", "best_for", "avoid_for"],
      },
    },
  },
  required: ["insights"],
} as const;

const CURATOR_BATCH_SIZE = 8;

async function runMediaCuratorBatch(assets: Asset[]): Promise<MediaInsight[]> {
  const withUrl = assets.filter((a) => a.public_url);
  if (!withUrl.length) return [];

  type ImageContent = { type: "image_url"; image_url: { url: string; detail: "low" } };
  type TextContent = { type: "text"; text: string };

  const imageBlocks: ImageContent[] = withUrl.map((a) => ({
    type: "image_url",
    image_url: { url: a.public_url!, detail: "low" },
  }));

  const assetList = withUrl
    .map((a, i) => `[${i + 1}] asset_id="${a.id}" file_name="${a.file_name}"`)
    .join("\n");

  const userContent: (TextContent | ImageContent)[] = [
    {
      type: "text",
      text: [
        "Analise cada imagem abaixo e retorne um insight para cada uma.",
        "Use exatamente os asset_id e file_name listados abaixo — não invente valores.",
        "",
        "ATIVOS:",
        assetList,
        "",
        "Imagens na mesma ordem:",
      ].join("\n"),
    },
    ...imageBlocks,
  ];

  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "Você é um diretor de arte especializado em fotografia gastronômica brasileira.",
          "Analise imagens de alimentos/restaurantes com olhar técnico e comercial.",
          "Se a foto tiver lata de refrigerante, marca de terceiro, rótulo ou embalagem não pertencente ao restaurante, mencione isso claramente em visual_description.",
          "Se a foto tiver logo, logotipo, placa, embalagem com marca ou texto legível do próprio restaurante, mencione como elemento fotografado que deve ser preservado exatamente, nunca redesenhado.",
          "Não recomende usar logo como elemento gráfico. A logo oficial é um asset separado e só pode ser aplicada por overlay de PNG transparente.",
          "Ter lata/refrigerante pequeno ou secundário na foto não é problema; descreva apenas como elemento secundário da cena.",
          "Quando uma marca de terceiro ou lata dominar a cena, quality_score deve ser no máximo 3 e avoid_for deve incluir ai_generation e hero, pois ela não deve virar foco do criativo.",
          "Só inclua hero em avoid_for quando a lata/marca realmente competir com a comida ou parecer protagonista.",
          "Fotos só de molho, pote de molho, condimento, acompanhamento isolado ou detalhe secundário podem ser úteis, mas não devem dominar uma seleção de stories. Se a foto não tiver prato/produto principal claro, quality_score deve ser no máximo 5 e avoid_for deve incluir secondary_subject.",
          "Se houver várias fotos parecidas do mesmo item (ex.: vários molhos), sinalize isso na descrição como 'variação de molho' ou 'assunto secundário', para o sistema diversificar a seleção.",
          "Seja conciso e objetivo. Responda apenas em português do Brasil.",
          "best_for usa objetivos: vendas, reservas, engajamento, awareness, alcance_local, relacionamento.",
          "avoid_for pode usar esses objetivos e também flags operacionais: ai_generation, hero, frango_na_brazza, logo_recreation, readable_background_text, secondary_subject, repetitive_sauce.",
        ].join("\n"),
      },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "media_insights", strict: true, schema: INSIGHT_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];

  const parsed = JSON.parse(raw) as { insights: MediaInsight[] };
  // Descarta insights de arquivos que a IA inventou — eles contaminariam o
  // prompt do gerador com fotos que não existem.
  const validNames = new Set(withUrl.map((a) => a.file_name));
  return parsed.insights.filter((i) => validNames.has(i.file_name));
}

export async function runMediaCurator(assets: Asset[]): Promise<MediaInsight[]> {
  const withUrl = assets.filter((a) => a.public_url);
  if (withUrl.length <= CURATOR_BATCH_SIZE) return runMediaCuratorBatch(withUrl);

  const batches: Asset[][] = [];
  for (let index = 0; index < withUrl.length; index += CURATOR_BATCH_SIZE) {
    batches.push(withUrl.slice(index, index + CURATOR_BATCH_SIZE));
  }

  const insights: MediaInsight[] = [];
  for (const batch of batches) {
    insights.push(...await runMediaCuratorBatch(batch));
  }
  return insights;
}

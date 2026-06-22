import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import type { ClientProfile } from "../../types";

const IMAGE_OUTPUT_QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved: { type: "boolean" },
    issues: {
      type: "array",
      items: { type: "string" },
    },
    notes: { type: "string" },
  },
  required: ["approved", "issues", "notes"],
} as const;

export type ImageOutputQAResult = {
  approved: boolean;
  issues: string[];
  notes: string;
};

function isFrangoNaBrazza(client: ClientProfile): boolean {
  const text = `${client.slug} ${client.name} ${client.instagram} ${client.notes} ${client.brand_manual_summary} ${client.synthetic_manual}`.toLowerCase();
  return text.includes("frango na brazza") || text.includes("frangonabrazza");
}

export async function runImageOutputQA(params: {
  client: ClientProfile;
  pngBytes: Buffer;
}): Promise<ImageOutputQAResult> {
  const { client, pngBytes } = params;

  if (!isFrangoNaBrazza(client)) {
    return { approved: true, issues: [], notes: "QA visual não aplicado para este cliente." };
  }

  const imageUrl = `data:image/png;base64,${pngBytes.toString("base64")}`;

  const completion = await openai().chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "Você é o guardião visual da OTG Mídia para conteúdo orgânico de restaurantes.",
          "Avalie a imagem gerada antes de ela ser aprovada para o cliente Frango na Brazza.",
          "Reprove se encontrar qualquer uma destas falhas:",
          "- texto visível sobre brasa, fogo, churrasco, churrascaria, grelhado, frango assado ou crocância inventada;",
          "- elementos visuais de fogo, chamas, faíscas, labaredas, carvão, churrasqueira, estética de churrasco ou cartaz fast-food agressivo;",
          "- CTA desenhado como botão, barra inferior, sticker, badge, pill, ícone de Telegram/WhatsApp ou UI falsa;",
          "- refrigerante/lata/marca de terceiro como protagonista da arte;",
          "- texto principal inventado que não pareça comida caseira, almoço, prato feito ou marmitex.",
          "Aprove somente se a arte parecer comida caseira real, foto gastronômica editorial limpa e conteúdo orgânico de Stories.",
          "Responda em português do Brasil.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise a imagem e diga se ela pode ser aprovada. Seja rigoroso.",
          },
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "low" },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "image_output_qa",
        strict: true,
        schema: IMAGE_OUTPUT_QA_SCHEMA,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return {
      approved: false,
      issues: ["QA visual não retornou resposta."],
      notes: "A imagem não foi aprovada porque o QA visual falhou.",
    };
  }

  return JSON.parse(raw) as ImageOutputQAResult;
}

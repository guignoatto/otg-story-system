import "server-only";
import { openai, TEXT_MODEL } from "../../openai";
import type { ClientProfile } from "../../types";
import {
  classifyFrangoQaIssues,
  FRANGO_ISSUE_CODES,
  frangoPromptSafetyBlock,
  getFrangoIssueDetails,
  isFrangoNaBrazzaClient,
  type FrangoIssueCode,
} from "../frango-safety";

const IMAGE_OUTPUT_QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved: { type: "boolean" },
    issues: {
      type: "array",
      items: { type: "string" },
    },
    issue_codes: {
      type: "array",
      items: { type: "string", enum: [...FRANGO_ISSUE_CODES] },
    },
    remediation_steps: {
      type: "array",
      items: { type: "string" },
    },
    notes: { type: "string" },
  },
  required: ["approved", "issues", "issue_codes", "remediation_steps", "notes"],
} as const;

export type ImageOutputQAResult = {
  approved: boolean;
  issues: string[];
  issue_codes: FrangoIssueCode[];
  remediation_steps: string[];
  notes: string;
};

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export async function runImageOutputQA(params: {
  client: ClientProfile;
  pngBytes: Buffer;
}): Promise<ImageOutputQAResult> {
  const { client, pngBytes } = params;

  if (!isFrangoNaBrazzaClient(client)) {
    return {
      approved: true,
      issues: [],
      issue_codes: [],
      remediation_steps: [],
      notes: "QA visual não aplicado para este cliente.",
    };
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
          "Além de issues em linguagem humana, classifique cada falha em issue_codes usando apenas estes códigos:",
          "- FORBIDDEN_VISIBLE_TEXT: texto visível menciona brasa/fogo/churrasco/grelhado/frango assado/crocância ou similar.",
          "- FORBIDDEN_FIRE_BBQ_VISUAL: há fogo, chamas, carvão, churrasqueira, brasa, churrasco, grelhado, cartaz fast-food agressivo ou grunge.",
          "- INVENTED_SENSORY_CLAIM: texto visível inventa promessa sensorial como frango suculento, suculência, derrete na boca, crocante, crocância ou dourado perfeito.",
          "- THIRD_PARTY_BRAND_FOCUS: refrigerante, lata, rótulo ou marca de terceiro virou protagonista.",
          "- CTA_FAKE_UI: CTA virou botão, barra inferior, sticker, badge, pill, ícone de WhatsApp/Telegram ou UI falsa.",
          "- OFF_BRAND_FOOD_CONTEXT: a arte não parece comida caseira, almoço, prato feito, marmitex ou delivery cotidiano.",
          "Reprove se encontrar qualquer uma destas falhas:",
          "- texto visível sobre brasa, fogo, churrasco, churrascaria, grelhado, frango assado, frango suculento, suculência, derrete na boca, crocância ou promessa sensorial inventada;",
          "- elementos visuais de fogo, chamas, faíscas, labaredas, carvão, churrasqueira, estética de churrasco ou cartaz fast-food agressivo;",
          "- CTA desenhado como botão, barra inferior, sticker, badge, pill, ícone de Telegram/WhatsApp ou UI falsa;",
          "- refrigerante/lata/marca de terceiro como protagonista da arte;",
          "- texto principal inventado que não pareça comida caseira, almoço, prato feito ou marmitex.",
          "Não reprove o nome da marca 'Frango na Brazza' por si só; ele pode aparecer em placa/foto do ambiente e não deve ser interpretado como 'frango assado', fogo ou churrasco sem evidência clara.",
          "Não reprove refrigerante/lata por existir na imagem: reprove apenas se estiver grande, central, nítido como produto principal ou competindo com o prato.",
          "Regra preventiva de referência: " + frangoPromptSafetyBlock(),
          "Em remediation_steps, diga como corrigir a próxima tentativa em frases curtas e operacionais.",
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
      issue_codes: ["OFF_BRAND_FOOD_CONTEXT"],
      remediation_steps: ["Gerar novamente com direção segura de comida caseira, marmitex ou prato feito."],
      notes: "A imagem não foi aprovada porque o QA visual falhou.",
    };
  }

  const parsed = JSON.parse(raw) as ImageOutputQAResult;
  const issueCodes = classifyFrangoQaIssues(parsed.issues, parsed.issue_codes);
  const deterministicSteps = getFrangoIssueDetails(issueCodes).map((detail) => detail.recommendation);

  return {
    ...parsed,
    issue_codes: issueCodes,
    remediation_steps: unique([...(parsed.remediation_steps ?? []), ...deterministicSteps]),
  };
}

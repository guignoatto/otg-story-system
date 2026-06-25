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

const SOURCE_IMAGE_QA_SCHEMA = {
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

export type SourceImageQAResult = {
  approved: boolean;
  issues: string[];
  issue_codes: FrangoIssueCode[];
  remediation_steps: string[];
  notes: string;
};

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export async function runSourceImageQA(params: {
  client: ClientProfile;
  pngBytes: Buffer;
}): Promise<SourceImageQAResult> {
  const { client, pngBytes } = params;

  if (!isFrangoNaBrazzaClient(client)) {
    return {
      approved: true,
      issues: [],
      issue_codes: [],
      remediation_steps: [],
      notes: "QA preventivo de foto fonte não aplicado para este cliente.",
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
          "Você é o guardião preventivo de foto fonte da OTG Mídia.",
          "Avalie a foto ANTES da geração de imagem para o cliente Frango na Brazza.",
          "Sua função é evitar gastar geração em uma foto que já tende a reprovar.",
          "A foto deve ser aprovada somente se puder gerar uma arte de comida caseira, almoço, marmitex, prato feito ou delivery cotidiano.",
          "Ter uma lata/refrigerante na foto NÃO é problema por si só.",
          "Aprove a foto quando a lata/refrigerante estiver lateral, sobre a mesa, parcial, pequena, secundária ou como parte natural da cena.",
          "Reprove a foto fonte por marca de terceiro somente em casos extremos: quando a lata/refrigerante for o assunto principal da foto, ocupar mais área visual que a comida, ou quase não houver comida útil para gerar a arte.",
          "Se houver refrigerante/lata pequeno, lateral ou claramente secundário, aprove. Não peça troca nem corte obrigatório; apenas recomende manter secundário na geração.",
          "Reprove se a foto fonte tiver fogo, brasa, chamas, carvão, churrasqueira, visual de churrasco ou estética de fast-food agressiva como elemento principal.",
          "Não reprove por prato, marmitex, embalagem do restaurante, mesa simples ou comida caseira real.",
          "Classifique issue_codes usando apenas os códigos disponíveis.",
          "Para refrigerante/lata/marca dominante use THIRD_PARTY_BRAND_FOCUS.",
          "Para fogo/brasa/churrasco use FORBIDDEN_FIRE_BBQ_VISUAL.",
          "Em remediation_steps, sempre descreva uma ação operacional que o sistema ou a equipe pode executar: trocar mídia, reenquadrar no prato, cortar elemento lateral, desfocar texto de fundo ou cadastrar nova foto.",
          "Se aprovar com ressalva, notes deve explicar como a geração deve reduzir o risco sem bloquear a criação.",
          "Regra preventiva de referência: " + frangoPromptSafetyBlock(),
          "Responda em português do Brasil.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise a foto fonte. Ela é segura para gerar arte do Frango na Brazza?",
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
        name: "source_image_qa",
        strict: true,
        schema: SOURCE_IMAGE_QA_SCHEMA,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return {
      approved: false,
      issues: ["QA preventivo da foto fonte não retornou resposta."],
      issue_codes: ["OFF_BRAND_FOOD_CONTEXT"],
      remediation_steps: ["Trocar a foto fonte por uma imagem limpa de comida caseira, marmitex ou prato feito."],
      notes: "A geração foi bloqueada porque a foto fonte não pôde ser validada.",
    };
  }

  const parsed = JSON.parse(raw) as SourceImageQAResult;
  const issueCodes = classifyFrangoQaIssues(parsed.issues, parsed.issue_codes);
  const deterministicSteps = getFrangoIssueDetails(issueCodes).map((detail) => detail.recommendation);

  return {
    ...parsed,
    issue_codes: issueCodes,
    remediation_steps: unique([...(parsed.remediation_steps ?? []), ...deterministicSteps]),
  };
}

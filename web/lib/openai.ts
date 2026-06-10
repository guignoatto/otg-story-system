import "server-only";
import OpenAI from "openai";

let cached: OpenAI | null = null;

export function openai(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY nao configurada. Adicione a chave da OpenAI para gerar com IA."
    );
  }
  if (!cached) cached = new OpenAI({ apiKey });
  return cached;
}

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o-2024-08-06";
// gpt-image-1 renderiza texto/fontes mal. Modelos mais novos (gpt-image-1.5,
// gpt-image-2, chatgpt-image-latest) renderizam texto muito melhor — é o que o
// site do ChatGPT usa. Configurável via OPENAI_IMAGE_MODEL.
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";

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
// gpt-image-2 renderiza texto/fontes melhor e deve ser o padrão do sistema.
// Ainda é configurável via OPENAI_IMAGE_MODEL para casos de fallback.
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

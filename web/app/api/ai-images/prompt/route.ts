import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { buildImagePrompt } from "@/lib/generation/image-prompt";
import { buildFrangoPreflightNotes, isFrangoNaBrazzaClient } from "@/lib/generation/frango-safety";

type Body = {
  client_id: string;
  headline?: string;
  body?: string;
  cta?: string;
  visual_direction?: string;
  layout_style?: string;
  output_format?: string;
  objective?: string;
  story_type?: string;
  offer?: string;
};

/** Monta e retorna o prompt de imagem sem gerar nada (preview antes da geração). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const client = await getClient(body.client_id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const prompt = buildImagePrompt({
      client,
      headline: body.headline || "",
      body: body.body || "",
      cta: body.cta || "",
      visual_direction: body.visual_direction || "",
      layout_style: body.layout_style || "editorial",
      output_format: body.output_format || "stories",
      objective: body.objective,
      story_type: body.story_type,
      offer: body.offer,
    });
    const preflight_notes = isFrangoNaBrazzaClient(client)
      ? buildFrangoPreflightNotes([
          body.headline,
          body.body,
          body.cta,
          body.visual_direction,
          body.offer,
        ].filter(Boolean).join(" "))
      : [];

    return NextResponse.json({ prompt, preflight_notes });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { createSignedUpload } from "@/lib/storage";
import type { AssetRole } from "@/lib/types";

type Body = {
  client_id: string;
  role: AssetRole;
  file_name: string;
  mime_type: string;
};

function isSupportedLogoImage(mimeType: string, fileName: string): boolean {
  return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/i.test(fileName);
}

/** Passo 1 do upload: devolve uma URL assinada para o browser enviar o arquivo direto ao Storage. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const clientId = String(body.client_id || "");
    const role = body.role;

    if (!clientId) return NextResponse.json({ detail: "client_id obrigatório." }, { status: 400 });
    if (role !== "manual" && role !== "media" && role !== "logo") {
      return NextResponse.json({ detail: "role deve ser manual, media ou logo." }, { status: 400 });
    }
    if (!body.file_name) {
      return NextResponse.json({ detail: "file_name obrigatório." }, { status: 400 });
    }
    if (role === "logo" && !isSupportedLogoImage(body.mime_type || "", body.file_name)) {
      return NextResponse.json({ detail: "Logo deve ser enviada como imagem." }, { status: 400 });
    }

    const client = await getClient(clientId);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const signed = await createSignedUpload({
      clientSlug: client.slug,
      role,
      fileName: body.file_name,
      mimeType: body.mime_type || "application/octet-stream",
    });

    return NextResponse.json(signed);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

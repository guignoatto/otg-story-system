import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { importDriveFiles } from "@/lib/drive-import";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { client_id, file_ids } = (await req.json()) as { client_id: string; file_ids: string[] };
    const client = await getClient(client_id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });
    if (!file_ids?.length) {
      return NextResponse.json({ detail: "Selecione ao menos um arquivo." }, { status: 400 });
    }
    const items = await importDriveFiles(client, file_ids.slice(0, 40));
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

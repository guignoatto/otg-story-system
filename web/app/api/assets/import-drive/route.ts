import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { driveCatalog } from "@/lib/drive";
import { importDriveFiles } from "@/lib/drive-import";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { client_id, folder_url, max_files } = (await req.json()) as {
      client_id: string;
      folder_url: string;
      max_files?: number;
    };
    const client = await getClient(client_id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const limit = Math.max(1, Math.min(max_files ?? 12, 40));
    const catalog = await driveCatalog(folder_url, limit);
    const items = await importDriveFiles(client, catalog.slice(0, limit).map((c) => c.drive_file_id));
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getClient } from "@/lib/data/clients";
import { listClientReferences } from "@/lib/data/feedback";
import { downloadFromStorage } from "@/lib/storage";
import { slugify } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 120;

function safeName(value: string, fallback: string): string {
  const slug = slugify(value.replace(/\.[^.]+$/i, "")) || fallback;
  return `${slug}.png`;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const approved = (await listClientReferences(client.id))
      .filter((item) => item.feedback.status === "approved")
      .slice(0, 60);

    if (!approved.length) {
      return NextResponse.json({ detail: "Este cliente ainda não tem artes aprovadas." }, { status: 404 });
    }

    const zip = new JSZip();
    const folder = zip.folder(slugify(client.name) || "cliente") ?? zip;

    for (const [index, item] of approved.entries()) {
      const bytes = await downloadFromStorage(item.asset.storage_path);
      const fileName = `${String(index + 1).padStart(2, "0")}-${safeName(item.asset.file_name, `arte-${index + 1}`)}`;
      folder.file(fileName, bytes);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const date = new Date().toISOString().slice(0, 10);
    const zipName = `${slugify(client.name) || "cliente"}-artes-aprovadas-${date}.zip`;
    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

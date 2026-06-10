import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { clientUsage } from "@/lib/data/packages";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });
    const usage = await clientUsage(client.id);
    return NextResponse.json(usage);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

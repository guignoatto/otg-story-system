import { NextRequest, NextResponse } from "next/server";
import { getClient, updateClient, deleteClient } from "@/lib/data/clients";
import type { ClientInput } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ detail: "Cliente nao encontrado." }, { status: 404 });
    return NextResponse.json(client);
  } catch (err) {
    return NextResponse.json({ detail: errMessage(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await getClient(id);
    if (!existing) return NextResponse.json({ detail: "Cliente nao encontrado." }, { status: 404 });
    const body = (await req.json()) as ClientInput;
    const client = await updateClient(existing.id, body);
    return NextResponse.json(client);
  } catch (err) {
    return NextResponse.json({ detail: errMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await getClient(id);
    if (!existing) return NextResponse.json({ detail: "Cliente nao encontrado." }, { status: 404 });
    await deleteClient(existing.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ detail: errMessage(err) }, { status: 500 });
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

import { NextRequest, NextResponse } from "next/server";
import { listClients, createClient } from "@/lib/data/clients";
import type { ClientInput } from "@/lib/types";

export async function GET() {
  try {
    const items = await listClients();
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ detail: errMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClientInput;
    if (!body?.name?.trim()) {
      return NextResponse.json({ detail: "Nome do restaurante e obrigatorio." }, { status: 400 });
    }
    const client = await createClient(body);
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    return NextResponse.json({ detail: errMessage(err) }, { status: 500 });
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { listAssets } from "@/lib/data/assets";
import type { AssetRole } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const roleParam = req.nextUrl.searchParams.get("role");
    const role = roleParam === "manual" || roleParam === "media" || roleParam === "ai" || roleParam === "logo"
      ? (roleParam as AssetRole)
      : undefined;

    const items = await listAssets(client.id, role);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

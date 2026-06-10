import { NextRequest, NextResponse } from "next/server";
import { getPackage } from "@/lib/data/packages";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const pkg = await getPackage(id);
    if (!pkg) return NextResponse.json({ detail: "Pacote não encontrado." }, { status: 404 });
    return NextResponse.json(pkg);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

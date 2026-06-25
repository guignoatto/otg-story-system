import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/data/clients";
import { getClientLearningMemory, listClientReferences } from "@/lib/data/feedback";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ detail: "Cliente não encontrado." }, { status: 404 });

    const [references, memory] = await Promise.all([
      listClientReferences(client.id),
      getClientLearningMemory(client.id),
    ]);

    return NextResponse.json({
      approved: references.filter((item) => item.feedback.status === "approved"),
      rejected: references.filter((item) => item.feedback.status === "rejected"),
      memory,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

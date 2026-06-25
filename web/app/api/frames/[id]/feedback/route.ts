import { NextRequest, NextResponse } from "next/server";
import { updateFrameCreativeFeedback } from "@/lib/data/feedback";
import type { CreativeFeedbackStatus } from "@/lib/feedback";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  status?: CreativeFeedbackStatus;
  reason?: string;
  comment?: string;
};

function clean(value: unknown, fallback = ""): string {
  return String(value ?? fallback).replace(/\s+/g, " ").trim().slice(0, 280);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Body;
    if (body.status !== "approved" && body.status !== "rejected") {
      return NextResponse.json({ detail: "status deve ser approved ou rejected." }, { status: 400 });
    }

    const reference = await updateFrameCreativeFeedback({
      frameId: id,
      status: body.status,
      reason: clean(
        body.reason,
        body.status === "approved" ? "Boa referência para este cliente." : "Evitar repetir este padrão."
      ),
      comment: clean(body.comment),
    });

    return NextResponse.json(reference);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

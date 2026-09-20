import { NextResponse } from "next/server";
import { logUsage } from "@/lib/simulations";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が読めません" }, { status: 400 });
  }
  const body = raw as { eventType?: string; payload?: Record<string, unknown> };
  if (!body.eventType || typeof body.eventType !== "string") {
    return NextResponse.json({ error: "eventType が必要です" }, { status: 400 });
  }
  const payload = body.payload ?? {};
  await logUsage(body.eventType.slice(0, 40), {
    benefitCount: typeof payload.benefitCount === "number" ? payload.benefitCount : 0,
    kinds: Array.isArray(payload.kinds) ? payload.kinds.slice(0, 6) : [],
  });
  return NextResponse.json({ ok: true });
}

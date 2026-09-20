import { NextResponse } from "next/server";
import { logUsage, usageEventSchema } from "@/lib/simulations";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が読めません" }, { status: 400 });
  }
  const parsed = usageEventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "eventType が不正です" }, { status: 400 });
  }
  await logUsage(parsed.data.eventType, {
    benefitCount: parsed.data.payload?.benefitCount ?? 0,
    kinds: parsed.data.payload?.kinds ?? [],
  });
  return NextResponse.json({ ok: true });
}

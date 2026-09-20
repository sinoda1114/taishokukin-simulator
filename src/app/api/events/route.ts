import { NextResponse } from "next/server";
import { z } from "zod";
import { logUsage } from "@/lib/simulations";

const eventSchema = z.object({
  eventType: z.enum(["save", "calculate", "view"]),
  payload: z
    .object({
      benefitCount: z.number().int().min(0).max(6).optional(),
      kinds: z.array(z.enum(["company", "dc", "mutual_aid", "other"])).max(6).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が読めません" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "eventType が不正です" }, { status: 400 });
  }
  await logUsage(parsed.data.eventType, {
    benefitCount: parsed.data.payload?.benefitCount ?? 0,
    kinds: parsed.data.payload?.kinds ?? [],
  });
  return NextResponse.json({ ok: true });
}

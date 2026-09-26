import { NextResponse } from "next/server";
import { CONSULT_BUSY, CONSULT_FAILED, CONSULT_UNAVAILABLE } from "@/lib/consult-copy";
import { consultSlotKey, parseConsultPayload, requestGeminiReply, takeConsultSlot } from "@/lib/consult-gemini";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が読めません" }, { status: 400 });
  }

  let payload: ReturnType<typeof parseConsultPayload>;
  try {
    payload = parseConsultPayload(raw);
  } catch {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: CONSULT_UNAVAILABLE }, { status: 503 });
  }

  if (!takeConsultSlot(consultSlotKey(request.headers.get("x-real-ip")), Date.now())) {
    return NextResponse.json({ error: CONSULT_BUSY }, { status: 429 });
  }

  try {
    const reply = await requestGeminiReply(apiKey, payload);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: CONSULT_FAILED }, { status: 502 });
  }
}

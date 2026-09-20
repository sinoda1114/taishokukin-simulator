import { NextResponse } from "next/server";
import { getCurrentUser } from "@/auth/getCurrentUser";
import { parseSimulationInput } from "@/lib/parse-input";
import { logUsage, saveSimulation } from "@/lib/simulations";

export async function POST(request: Request) {
  await getCurrentUser();
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が読めません" }, { status: 400 });
  }
  try {
    const input = parseSimulationInput(raw);
    const saved = await saveSimulation(input);
    await logUsage("save", {
      benefitCount: input.benefits.length,
      kinds: input.benefits.map((b) => b.kind),
    });
    return NextResponse.json({ token: saved.token, result: saved.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

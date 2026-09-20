import { NextResponse } from "next/server";
import { ZodError } from "zod";
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
    try {
      await logUsage("save", {
        benefitCount: input.benefits.length,
        kinds: input.benefits.map((b) => b.kind),
      });
    } catch {
      // 保存自体は完了している
    }
    return NextResponse.json({ token: saved.token, result: saved.result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
    }
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

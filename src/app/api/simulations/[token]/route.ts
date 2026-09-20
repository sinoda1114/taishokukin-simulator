import { NextResponse } from "next/server";
import { loadSimulation } from "@/lib/simulations";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const loaded = await loadSimulation(token);
  if (!loaded) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }
  return NextResponse.json(loaded);
}

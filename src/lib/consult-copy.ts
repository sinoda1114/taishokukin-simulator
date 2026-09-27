export const CONSULT_UNAVAILABLE = "相談の準備ができていません";
export const CONSULT_FAILED = "返答を受け取れませんでした";
export const CONSULT_BUSY = "しばらくしてからもう一度送ってください";

export function readConsultField(body: unknown, key: "error" | "reply"): string {
  if (body === null || typeof body !== "object" || !(key in body)) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export type ConsultTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function createConsultTurn(
  role: ConsultTurn["role"],
  text: string,
  id: string = crypto.randomUUID(),
): ConsultTurn {
  return { id, role, text };
}

export function consultWireMessages(
  turns: readonly { role: "user" | "assistant"; text: string }[],
): { role: "user" | "assistant"; text: string }[] {
  return turns.map((turn) => ({ role: turn.role, text: turn.text }));
}

export function trimConsultMessages<T extends { role: "user" | "assistant" }>(messages: T[], max = 16): T[] {
  const next = messages.slice();
  while (next.length > max) {
    if (next[0]?.role === "assistant") next.shift();
    else next.splice(0, Math.min(2, next.length));
  }
  while (next[0]?.role === "assistant") next.shift();
  return next;
}

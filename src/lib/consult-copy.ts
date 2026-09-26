export const CONSULT_UNAVAILABLE = "相談の準備ができていません";
export const CONSULT_FAILED = "返答を受け取れませんでした";
export const CONSULT_BUSY = "しばらくしてからもう一度送ってください";

export function trimConsultMessages<T extends { role: "user" | "assistant" }>(messages: T[], max = 16): T[] {
  const next = messages.slice();
  while (next.length > max) {
    if (next[0]?.role === "assistant") next.shift();
    else next.splice(0, Math.min(2, next.length));
  }
  while (next[0]?.role === "assistant") next.shift();
  return next;
}

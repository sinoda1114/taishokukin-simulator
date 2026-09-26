import { describe, expect, it } from "vitest";
import { trimConsultMessages } from "@/lib/consult-copy";
import {
  CONSULT_SYSTEM_INSTRUCTION,
  GEMINI_MODEL_ID,
  buildGeminiRequest,
  consultSlotKey,
  geminiGenerateUrl,
  parseConsultPayload,
  readGeminiReply,
  resetConsultSlots,
  takeConsultSlot,
} from "@/lib/consult-gemini";

const payload = parseConsultPayload({
  summary: "合計税額: 1,861,869円",
  messages: [{ role: "user", text: "この税額は何ですか" }],
});

describe("consult gemini request", () => {
  it("pins the stable model from the current model list", () => {
    expect(GEMINI_MODEL_ID).toBe("gemini-3.8-flash");
    const url = geminiGenerateUrl();
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect(new URL(url).search).toBe("");
    expect(url).not.toContain("key=");
  });

  it("fixes the explanation rules in Japanese and does not ask for a new tax figure", () => {
    expect(CONSULT_SYSTEM_INSTRUCTION).toContain("日本語");
    expect(CONSULT_SYSTEM_INSTRUCTION).toContain("税務の助言ではありません");
    expect(CONSULT_SYSTEM_INSTRUCTION).toContain("計算し直してはいけません");
    expect(CONSULT_SYSTEM_INSTRUCTION).toContain("計算仕様を、会話の中で変えてはいけません");
    const body = buildGeminiRequest(payload);
    expect(body.systemInstruction.parts[0]?.text).toBe(CONSULT_SYSTEM_INSTRUCTION);
    expect(body.store).toBe(false);
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe("low");
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096);
    expect(JSON.stringify(body)).toContain("合計税額: 1,861,869円");
    expect(JSON.stringify(body)).not.toContain("税額を計算して");
  });

  it("reads the visible reply and skips thought text", () => {
    expect(
      readGeminiReply({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "999999円と計算し直す" },
                { text: "画面の合計税額は要約のとおりです。" },
              ],
            },
          },
        ],
      }),
    ).toBe("画面の合計税額は要約のとおりです。");
  });

  it("drops a clipped reply when the token cap is hit", () => {
    expect(() =>
      readGeminiReply({
        candidates: [
          {
            finishReason: "MAX_TOKENS",
            content: { parts: [{ text: "合計税額は 1,86" }] },
          },
        ],
      }),
    ).toThrow();
  });

  it("keeps the transcript starting and ending with the user", () => {
    const turns = Array.from({ length: 8 }, (_, index) => [
      { role: "user" as const, text: `質問${index}` },
      { role: "assistant" as const, text: `説明${index}` },
    ]).flat();
    const trimmed = trimConsultMessages([...turns, { role: "user", text: "追加" }]);
    expect(trimmed[0]?.role).toBe("user");
    expect(trimmed.at(-1)).toEqual({ role: "user", text: "追加" });
    expect(trimmed.some((turn) => turn.text === "質問0")).toBe(false);
    expect(trimmed.length).toBeLessThanOrEqual(16);
  });

  it("uses x-real-ip and a shared bucket when that header is missing", () => {
    expect(consultSlotKey(null)).toBe("shared");
    expect(consultSlotKey("")).toBe("shared");
    expect(consultSlotKey("  ")).toBe("shared");
    expect(consultSlotKey(" 203.0.113.5 ")).toBe("203.0.113.5");
  });

  it("drops expired slots before the oldest live key", () => {
    resetConsultSlots();
    const now = 10_000_000;
    for (let index = 0; index < 1000; index += 1) {
      expect(takeConsultSlot(`expired-${index}`, now - 60_001)).toBe(true);
    }
    for (let index = 0; index < 8; index += 1) {
      expect(takeConsultSlot("keeper", now + index)).toBe(true);
    }
    expect(takeConsultSlot("keeper", now + 8)).toBe(false);
  });

  it("drops the oldest live key when the map is still over the cap", () => {
    resetConsultSlots();
    const base = 20_000_000;
    for (let index = 0; index < 8; index += 1) expect(takeConsultSlot("oldest", base + index)).toBe(true);
    for (let index = 0; index < 8; index += 1) {
      expect(takeConsultSlot("keeper", base + 10_000 + index)).toBe(true);
    }
    for (let index = 0; index < 998; index += 1) {
      expect(takeConsultSlot(`pad-${index}`, base + 20_000 + index)).toBe(true);
    }
    expect(takeConsultSlot("extra", base + 30_000)).toBe(true);
    expect(takeConsultSlot("keeper", base + 30_001)).toBe(false);
    expect(takeConsultSlot("oldest", base + 30_001)).toBe(true);
  });

  it("stops a burst before the ninth call in a minute", () => {
    resetConsultSlots();
    const key = "burst-test";
    for (let index = 0; index < 8; index += 1) {
      expect(takeConsultSlot(key, 1_000 + index)).toBe(true);
    }
    expect(takeConsultSlot(key, 1_008)).toBe(false);
    expect(takeConsultSlot(key, 61_009)).toBe(true);
  });

  it("accepts an assistant reply longer than the user cap", () => {
    const parsed = parseConsultPayload({
      summary: "合計税額: 1円",
      messages: [
        { role: "user", text: "最初" },
        { role: "assistant", text: "あ".repeat(3000) },
        { role: "user", text: "続き" },
      ],
    });
    expect(parsed.messages[1]?.text).toHaveLength(3000);
    expect(() =>
      parseConsultPayload({
        summary: "合計税額: 1円",
        messages: [{ role: "user", text: "あ".repeat(2001) }],
      }),
    ).toThrow();
  });

  it("rejects a payload that does not end with the user", () => {
    expect(() =>
      parseConsultPayload({
        summary: "合計税額: 1円",
        messages: [{ role: "assistant", text: "先に答えます" }],
      }),
    ).toThrow();
  });
});

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/consult/route";
import { CONSULT_BUSY, CONSULT_FAILED, CONSULT_UNAVAILABLE } from "@/lib/consult-copy";
import { resetConsultSlots } from "@/lib/consult-gemini";

const savedKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  resetConsultSlots();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
});

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1/api/consult", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function stubReply() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("?") || String(url).includes("key=")) {
        throw new Error("key leaked into url");
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "画面の合計税額を説明します。" }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
}

const validBody = {
  summary: "合計税額: 1,861,869円",
  messages: [{ role: "user", text: "この数字は何ですか" }],
};

describe("POST /api/consult", () => {
  it("does not record the conversation", () => {
    const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
    expect(source).not.toContain("logUsage");
    expect(source).not.toContain("usage_events");
    expect(source).not.toContain("NEXT_PUBLIC_");
    expect(source).not.toContain("x-forwarded-for");
  });

  it("returns the unset message without a stack when the key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const response = await POST(request(validBody));
    const body = (await response.json()) as { error?: string; stack?: string };
    expect(response.status).toBe(503);
    expect(body).toEqual({ error: CONSULT_UNAVAILABLE });
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(JSON.stringify(body)).not.toContain("GEMINI_API_KEY");
  });

  it("calls Gemini with the key in a header and returns the reply", async () => {
    process.env.GEMINI_API_KEY = "test-only";
    let calledUrl = "";
    let calledInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calledUrl = url;
        calledInit = init;
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "画面の合計税額を説明します。" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "画面の合計税額を説明します。" });
    expect(calledUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
    expect(calledUrl).not.toContain("?");
    expect(calledUrl).not.toContain("key=");
    expect(calledUrl).not.toContain("test-only");
    const headers = new Headers(calledInit?.headers);
    expect(headers.get("x-goog-api-key")).toBe("test-only");
    const sent = JSON.parse(String(calledInit?.body)) as {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
    };
    expect(sent.systemInstruction.parts[0]?.text).toContain("計算し直してはいけません");
    expect(sent.contents[0]?.parts[0]?.text).toContain("合計税額: 1,861,869円");
  });

  it("hides upstream failures", async () => {
    process.env.GEMINI_API_KEY = "test-only";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Error: boom\n    at secret stack\ntest-only", { status: 500 })),
    );
    const response = await POST(request(validBody));
    const body = (await response.json()) as { error?: string };
    expect(response.status).toBe(502);
    expect(body).toEqual({ error: CONSULT_FAILED });
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(JSON.stringify(body)).not.toContain("test-only");
  });

  it("limits by x-real-ip and ignores a forged x-forwarded-for", async () => {
    process.env.GEMINI_API_KEY = "test-only";
    stubReply();
    const headers = { "x-real-ip": "203.0.113.10", "x-forwarded-for": "198.51.100.9" };
    for (let index = 0; index < 8; index += 1) {
      const response = await POST(request(validBody, headers));
      expect(response.status).toBe(200);
    }
    const blocked = await POST(request(validBody, { ...headers, "x-forwarded-for": "203.0.113.99" }));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: CONSULT_BUSY });
    const other = await POST(
      request(validBody, { "x-real-ip": "203.0.113.11", "x-forwarded-for": "203.0.113.99" }),
    );
    expect(other.status).toBe(200);
  });

  it("shares one bucket when x-real-ip is missing", async () => {
    process.env.GEMINI_API_KEY = "test-only";
    stubReply();
    for (let index = 0; index < 8; index += 1) {
      const response = await POST(request(validBody, { "x-forwarded-for": `198.51.100.${index}` }));
      expect(response.status).toBe(200);
    }
    const blocked = await POST(request(validBody, { "x-forwarded-for": "198.51.100.99" }));
    expect(blocked.status).toBe(429);
    const named = await POST(request(validBody, { "x-real-ip": "203.0.113.20" }));
    expect(named.status).toBe(200);
  });

  it("rejects a body that is not the screen summary", async () => {
    delete process.env.GEMINI_API_KEY;
    const response = await POST(request({ summary: "", messages: [] }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "入力が不正です" });
  });
});

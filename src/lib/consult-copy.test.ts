import { describe, expect, it } from "vitest";
import {
  consultWireMessages,
  createConsultTurn,
  readConsultField,
  trimConsultMessages,
} from "@/lib/consult-copy";

describe("consult copy", () => {
  it("reads a missing response as an empty string", () => {
    expect(readConsultField(null, "error")).toBe("");
    expect(readConsultField(undefined, "reply")).toBe("");
    expect(readConsultField({}, "error")).toBe("");
    expect(readConsultField({ error: 1 }, "error")).toBe("");
    expect(readConsultField({ error: "入力が不正です" }, "error")).toBe("入力が不正です");
  });

  it("keeps a stable id when the transcript is trimmed", () => {
    const turns = Array.from({ length: 9 }, (_, index) => [
      createConsultTurn("user", `質問${index}`, `user-${index}`),
      createConsultTurn("assistant", `説明${index}`, `assistant-${index}`),
    ]).flat();
    const trimmed = trimConsultMessages(turns);
    expect(trimmed.map((turn) => turn.id)).toEqual([
      "user-1",
      "assistant-1",
      "user-2",
      "assistant-2",
      "user-3",
      "assistant-3",
      "user-4",
      "assistant-4",
      "user-5",
      "assistant-5",
      "user-6",
      "assistant-6",
      "user-7",
      "assistant-7",
      "user-8",
      "assistant-8",
    ]);
    expect(new Set(trimmed.map((turn) => turn.id)).size).toBe(trimmed.length);
  });

  it("sends role and text without the message id", () => {
    const turn = createConsultTurn("user", "この税額は何ですか", "stable-id");
    expect(consultWireMessages([turn])).toEqual([{ role: "user", text: "この税額は何ですか" }]);
    const ids = new Set(Array.from({ length: 8 }, () => createConsultTurn("assistant", "説明").id));
    expect(ids.size).toBe(8);
  });
});

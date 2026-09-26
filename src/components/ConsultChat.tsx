"use client";

import { useState } from "react";
import { Modal, Stack, Text, Textarea } from "@mantine/core";
import { CONSULT_FAILED, CONSULT_UNAVAILABLE, trimConsultMessages } from "@/lib/consult-copy";

type Turn = { role: "user" | "assistant"; text: string };

function readField(body: unknown, key: "error" | "reply"): string {
  if (!body || typeof body !== "object" || !(key in body)) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function ConsultChat({
  open,
  summary,
  onOpen,
  onClose,
}: {
  open: boolean;
  summary: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    const next = trimConsultMessages([...turns, { role: "user" as const, text }]);
    setTurns(next);
    setDraft("");
    setPending(true);
    try {
      const response = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, messages: next }),
      });
      const body: unknown = await response.json().catch(() => null);
      const error = readField(body, "error");
      const reply = readField(body, "reply");
      if (error === CONSULT_UNAVAILABLE) {
        setTurns((prev) => [...prev, { role: "assistant", text: CONSULT_UNAVAILABLE }]);
        return;
      }
      const safeError = error.length > 0 && error.length <= 80 && !error.includes("\n") ? error : "";
      if (!response.ok || !reply) {
        setTurns((prev) => [...prev, { role: "assistant", text: safeError || CONSULT_FAILED }]);
        return;
      }
      setTurns((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setTurns((prev) => [...prev, { role: "assistant", text: CONSULT_FAILED }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="consult-fab"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="consult-dialog"
      >
        AIに相談
      </button>
      <Modal
        opened={open}
        onClose={onClose}
        title="AIに相談"
        id="consult-dialog"
        zIndex={50}
        size="md"
        classNames={{
          content: "consult-dialog",
          header: "consult-dialog-header",
          title: "consult-dialog-title",
          body: "consult-dialog-body",
        }}
        overlayProps={{ backgroundOpacity: 0.4, color: "#161c28" }}
      >
        <Stack gap="md">
          <Text size="sm" c="var(--ink-muted)" lh={1.7}>
            画面に出ている数字の説明です。税務助言ではありません。会話は保存しません。
          </Text>
          <div className="consult-log" aria-live="polite" aria-busy={pending}>
            {turns.length === 0 ? (
              <Text size="sm" c="dimmed">
                画面に出ている数字について聞けます。
              </Text>
            ) : (
              turns.map((turn, index) => (
                <div
                  key={`${turn.role}-${index}`}
                  className={turn.role === "user" ? "consult-turn consult-turn--user" : "consult-turn"}
                >
                  <Text size="sm" fw={600} c={turn.role === "user" ? "var(--indigo)" : "var(--ink)"}>
                    {turn.role === "user" ? "あなた" : "説明"}
                  </Text>
                  <Text size="sm" mt={4} lh={1.7} style={{ whiteSpace: "pre-wrap" }}>
                    {turn.text}
                  </Text>
                </div>
              ))
            )}
          </div>
          <Textarea
            label="相談内容"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            minRows={3}
            maxLength={2000}
            disabled={pending}
          />
          <button
            type="button"
            className="consult-send"
            onClick={() => void send()}
            disabled={pending || draft.trim() === ""}
          >
            {pending ? "送っています" : "送る"}
          </button>
        </Stack>
      </Modal>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  buildThreePatterns,
  searchReceiptYears,
  simulate,
  type BenefitInput,
  type BenefitKind,
  type RuleMode,
  type SimulationInput,
} from "@/engine";
import { formatYen, KIND_LABELS, RULE_MODE_LABELS } from "@/lib/parse-input";
import { ResultPanel } from "./ResultPanel";

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultInput: SimulationInput = {
  schemaVersion: 1,
  birthYearMonth: { year: 1965, month: 4 },
  ruleMode: "auto",
  benefits: [
    {
      id: "company",
      kind: "company",
      incomeYen: 20_000_000,
      serviceYears: 30,
      receiptYear: 2030,
    },
    {
      id: "dc",
      kind: "dc",
      incomeYen: 10_000_000,
      serviceYears: 20,
      receiptYear: 2030,
      optimizeReceiptYear: true,
    },
  ],
};

type Props = {
  initialInput?: SimulationInput;
  shareToken?: string;
};

export function SimulatorApp({ initialInput, shareToken }: Props) {
  const [input, setInput] = useState<SimulationInput>(initialInput ?? defaultInput);
  const [saveUrl, setSaveUrl] = useState(
    shareToken ? `/s/${shareToken}` : "",
  );
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => simulate(input), [input]);
  const patterns = useMemo(() => buildThreePatterns(input), [input]);
  const search = useMemo(
    () =>
      input.benefits.some((b) => b.optimizeReceiptYear)
        ? searchReceiptYears(input)
        : null,
    [input],
  );

  function updateBenefit(id: string, patch: Partial<BenefitInput>) {
    setInput((prev) => ({
      ...prev,
      benefits: prev.benefits.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function addBenefit() {
    if (input.benefits.length >= 6) return;
    setInput((prev) => ({
      ...prev,
      benefits: [
        ...prev.benefits,
        {
          id: uid(),
          kind: "other",
          incomeYen: 0,
          serviceYears: 20,
          receiptYear: prev.benefits[0]?.receiptYear ?? 2030,
        },
      ],
    }));
  }

  function removeBenefit(id: string) {
    setInput((prev) => ({
      ...prev,
      benefits: prev.benefits.filter((b) => b.id !== id),
    }));
  }

  async function onSave() {
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !body.token) {
        setSaveError(body.error ?? "保存に失敗しました");
        return;
      }
      const url = `${window.location.origin}/s/${body.token}`;
      setSaveUrl(url);
    } catch {
      setSaveError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="stack">
      <section className="card stack">
        <h2>入力</h2>
        <div className="row">
          <label>
            生年
            <input
              type="number"
              value={input.birthYearMonth?.year ?? ""}
              onChange={(e) =>
                setInput((prev) => ({
                  ...prev,
                  birthYearMonth: {
                    year: Number(e.target.value),
                    month: prev.birthYearMonth?.month ?? 1,
                  },
                }))
              }
            />
          </label>
          <label>
            生月
            <input
              type="number"
              min={1}
              max={12}
              value={input.birthYearMonth?.month ?? ""}
              onChange={(e) =>
                setInput((prev) => ({
                  ...prev,
                  birthYearMonth: {
                    year: prev.birthYearMonth?.year ?? 1965,
                    month: Number(e.target.value),
                  },
                }))
              }
            />
          </label>
          <label>
            適用ルール
            <select
              value={input.ruleMode}
              onChange={(e) =>
                setInput((prev) => ({ ...prev, ruleMode: e.target.value as RuleMode }))
              }
            >
              {(Object.keys(RULE_MODE_LABELS) as RuleMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {RULE_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          簡易入力の期間は仮置きです。終了は受取年の12月、開始は（受取年−年数+1）年1月。詳しい年月があるときは区間で入れてください。
        </p>
        {input.benefits.map((benefit, index) => (
          <BenefitEditor
            key={benefit.id}
            index={index}
            benefit={benefit}
            onChange={(patch) => updateBenefit(benefit.id, patch)}
            onRemove={() => removeBenefit(benefit.id)}
            canRemove={input.benefits.length > 1}
          />
        ))}
        <div className="row">
          <button type="button" className="secondary" onClick={addBenefit} disabled={input.benefits.length >= 6}>
            手当を追加（最大6）
          </button>
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? "保存中…" : "共有 URL を作る"}
          </button>
        </div>
        {saveError ? <p className="warn">{saveError}</p> : null}
        {saveUrl ? (
          <p className="share">
            共有 URL: <a href={saveUrl}>{saveUrl}</a>
          </p>
        ) : null}
      </section>
      <ResultPanel result={result} patterns={patterns} search={search} />
    </main>
  );
}

function BenefitEditor({
  index,
  benefit,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  benefit: BenefitInput;
  onChange: (patch: Partial<BenefitInput>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const useIntervals = Boolean(benefit.intervals && benefit.intervals.length > 0);
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3>退職手当等 {index + 1}</h3>
        {canRemove ? (
          <button type="button" className="secondary" onClick={onRemove}>
            削除
          </button>
        ) : null}
      </div>
      <div className="benefit-grid">
        <label>
          種類
          <select
            value={benefit.kind}
            onChange={(e) => onChange({ kind: e.target.value as BenefitKind })}
          >
            {(Object.keys(KIND_LABELS) as BenefitKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label>
          見込み受取額（円）
          <input
            type="number"
            value={benefit.incomeYen}
            onChange={(e) => onChange({ incomeYen: Number(e.target.value) })}
          />
        </label>
        <label>
          受取年
          <input
            type="number"
            value={benefit.receiptYear}
            onChange={(e) => onChange({ receiptYear: Number(e.target.value) })}
          />
        </label>
        <label>
          勤続年数（簡易）
          <input
            type="number"
            value={benefit.serviceYears ?? ""}
            disabled={useIntervals}
            onChange={(e) =>
              onChange({ serviceYears: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </label>
        {benefit.kind === "dc" ? (
          <label>
            拠出終了年齢（任意）
            <input
              type="number"
              value={benefit.contributionEndAge ?? ""}
              onChange={(e) =>
                onChange({
                  contributionEndAge: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        ) : null}
      </div>
      <label className="inline">
        <input
          type="checkbox"
          checked={Boolean(benefit.optimizeReceiptYear)}
          onChange={(e) => onChange({ optimizeReceiptYear: e.target.checked })}
        />
        受取年を探索する（iDeCo は 60〜75歳の暦年）
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={Boolean(benefit.disability)}
          onChange={(e) => onChange({ disability: e.target.checked })}
        />
        障害退職（控除 +100万円）
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={useIntervals}
          onChange={(e) => {
            if (e.target.checked) {
              onChange({
                intervals: [
                  {
                    start: { year: benefit.receiptYear - (benefit.serviceYears ?? 20) + 1, month: 1 },
                    end: { year: benefit.receiptYear, month: 12 },
                  },
                ],
              });
            } else {
              onChange({ intervals: undefined, serviceYears: benefit.serviceYears ?? 20 });
            }
          }}
        />
        勤続期間を年月の区間で入力する
      </label>
      {useIntervals
        ? benefit.intervals?.map((interval, i) => (
            <div className="row" key={`${benefit.id}-iv-${i}`}>
              <label>
                開始
                <input
                  type="month"
                  value={`${interval.start.year}-${String(interval.start.month).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split("-").map(Number);
                    const next = [...(benefit.intervals ?? [])];
                    next[i] = { ...interval, start: { year: y, month: m } };
                    onChange({ intervals: next });
                  }}
                />
              </label>
              <label>
                終了
                <input
                  type="month"
                  value={`${interval.end.year}-${String(interval.end.month).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split("-").map(Number);
                    const next = [...(benefit.intervals ?? [])];
                    next[i] = { ...interval, end: { year: y, month: m } };
                    onChange({ intervals: next });
                  }}
                />
              </label>
            </div>
          ))
        : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { SimulationInput } from "@/engine";
import { IntInput } from "./IntInput";
import { DualIntField } from "./DualIntField";
import { ReceiptAgeField } from "./ReceiptAgeField";
import { FIELD_RANGES } from "@/lib/field-ranges";
import { toInt } from "@/lib/ui-numbers";
import {
  parseBirthYear,
  parseIncomeYen,
  parseMonth,
  parseReceiptAge,
  parseServiceYears,
  receiptYearFromAge,
  serviceConflictsWithReceipt,
} from "@/lib/field-validation";
import {
  answersFromInput,
  inputFromAnswers,
  nextHearingStep,
  prevHearingStep,
  visibleHearingSteps,
  type HearingAnswers,
  type HearingStepId,
} from "@/lib/hearing";

const STEP_COPY: Record<HearingStepId, { title: string; lede: string }> = {
  birth: {
    title: "生年と生月はいつですか",
    lede: "受取年は、その年齢の誕生日を迎える暦年です。iDeCo の 60歳も同じです。",
  },
  company: {
    title: "会社の退職金は、いくらで、何年勤めて、何歳で受けますか",
    lede: "見込みの額と勤続年数、受取年齢です。受取年は生年月から出します。",
  },
  hasDc: {
    title: "iDeCo か企業型 DC の一時金はありますか",
    lede: "あると、受取の順で税が変わります。",
  },
  dc: {
    title: "その額、拠出年数、受取年齢は",
    lede: "拠出年数が勤続年数になります。受取年は生年月から出します。",
  },
  hasExtra: {
    title: "ほかに退職手当はありますか",
    lede: "ある場合は、次の入力欄で額と年を直せます。",
  },
  goal: {
    title: "同時に受け取る場合と、順を変える場合、どちらを見ますか",
    lede: "順を変える比較は、会社1本と DC1本のときだけ出ます。",
  },
};

function Choice({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "choice is-on" : "choice"}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function dcAnswers(
  draft: {
    dcIncomeYen: string;
    dcServiceYears: string;
    dcReceiptAge: string;
  },
  birthYear: number,
): { income: number; service: number; age: number } | { errors: Record<string, string> } {
  const income = parseIncomeYen(draft.dcIncomeYen);
  const service = parseServiceYears(draft.dcServiceYears, "拠出年数");
  const age = parseReceiptAge(draft.dcReceiptAge, birthYear);
  const errors: Record<string, string> = {};
  if (!income.ok) errors.dcIncomeYen = income.error;
  if (!service.ok) errors.dcServiceYears = service.error;
  if (!age.ok) errors.dcReceiptAge = age.error;
  if (Object.keys(errors).length > 0) return { errors };
  if (!income.ok || !service.ok || !age.ok) return { errors };
  return { income: income.value, service: service.value, age: age.value };
}

export function HearingFlow({
  initial,
  onSkip,
  onComplete,
}: {
  initial: SimulationInput;
  onSkip: () => void;
  onComplete: (input: SimulationInput) => void;
}) {
  const seed = useMemo(() => answersFromInput(initial), [initial]);
  const [draft, setDraft] = useState({
    birthYear: String(seed.birthYear),
    birthMonth: String(seed.birthMonth),
    companyIncomeYen: String(seed.companyIncomeYen),
    companyServiceYears: String(seed.companyServiceYears),
    companyReceiptAge: String(seed.companyReceiptAge),
    hasDc: seed.hasDc,
    dcIncomeYen: String(seed.dcIncomeYen),
    dcServiceYears: String(seed.dcServiceYears),
    dcReceiptAge: String(seed.dcReceiptAge),
    hasExtra: seed.hasExtra,
    goal: seed.goal,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<HearingStepId>("birth");
  const steps = useMemo(() => visibleHearingSteps(draft.hasDc), [draft.hasDc]);
  const index = Math.max(0, steps.indexOf(step));
  const copy = STEP_COPY[step];
  const isLast = nextHearingStep(step, draft.hasDc) === "done";
  const birthYearParsed = parseBirthYear(draft.birthYear);
  const birthYear = birthYearParsed.ok ? birthYearParsed.value : null;

  function patch<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function parsedAnswers(): { ok: true; value: HearingAnswers } | { ok: false; errors: Record<string, string> } {
    const nextErrors: Record<string, string> = {};
    const birthY = parseBirthYear(draft.birthYear);
    const birthM = parseMonth(draft.birthMonth, "生月");
    if (!birthY.ok) nextErrors.birthYear = birthY.error;
    if (!birthM.ok) nextErrors.birthMonth = birthM.error;
    const income = parseIncomeYen(draft.companyIncomeYen);
    const service = parseServiceYears(draft.companyServiceYears);
    const age = parseReceiptAge(draft.companyReceiptAge, birthY.ok ? birthY.value : null);
    if (!income.ok) nextErrors.companyIncomeYen = income.error;
    if (!service.ok) nextErrors.companyServiceYears = service.error;
    if (!age.ok) nextErrors.companyReceiptAge = age.error;
    if (birthY.ok && service.ok && age.ok) {
      const conflict = serviceConflictsWithReceipt(
        service.value,
        receiptYearFromAge(birthY.value, age.value),
        { year: birthY.value, month: birthM.ok ? birthM.value : 1 },
      );
      if (conflict) nextErrors.companyReceiptAge = conflict;
    }
    if (draft.hasDc) {
      if (!birthY.ok) {
        nextErrors.dcReceiptAge = "生年月を先に入れてください";
      } else {
        const dc = dcAnswers(draft, birthY.value);
        if ("errors" in dc) Object.assign(nextErrors, dc.errors);
        else {
          const conflict = serviceConflictsWithReceipt(
            dc.service,
            receiptYearFromAge(birthY.value, dc.age),
            { year: birthY.value, month: birthM.ok ? birthM.value : 1 },
          );
          if (conflict) nextErrors.dcReceiptAge = conflict;
        }
      }
    }
    if (Object.keys(nextErrors).length > 0) return { ok: false, errors: nextErrors };
    if (!birthY.ok || !birthM.ok || !income.ok || !service.ok || !age.ok) {
      return { ok: false, errors: nextErrors };
    }
    const dc = draft.hasDc && birthY.ok ? dcAnswers(draft, birthY.value) : null;
    const dcOk = dc && !("errors" in dc) ? dc : { income: 0, service: 1, age: age.value };
    return {
      ok: true,
      value: {
        birthYear: birthY.value,
        birthMonth: birthM.value,
        companyIncomeYen: income.value,
        companyServiceYears: service.value,
        companyReceiptAge: age.value,
        hasDc: draft.hasDc,
        dcIncomeYen: dcOk.income,
        dcServiceYears: dcOk.service,
        dcReceiptAge: dcOk.age,
        hasExtra: draft.hasExtra,
        goal: draft.goal,
      },
    };
  }

  function validateCurrentStep(): boolean {
    const nextErrors: Record<string, string> = {};
    if (step === "birth") {
      const year = parseBirthYear(draft.birthYear);
      const month = parseMonth(draft.birthMonth, "生月");
      if (!year.ok) nextErrors.birthYear = year.error;
      if (!month.ok) nextErrors.birthMonth = month.error;
    }
    if (step === "company") {
      const income = parseIncomeYen(draft.companyIncomeYen);
      const service = parseServiceYears(draft.companyServiceYears);
      const age = parseReceiptAge(draft.companyReceiptAge, birthYear);
      if (!income.ok) nextErrors.companyIncomeYen = income.error;
      if (!service.ok) nextErrors.companyServiceYears = service.error;
      if (!age.ok) nextErrors.companyReceiptAge = age.error;
      if (birthYear !== null && service.ok && age.ok) {
        const month = parseMonth(draft.birthMonth, "生月");
        const conflict = serviceConflictsWithReceipt(
          service.value,
          receiptYearFromAge(birthYear, age.value),
          { year: birthYear, month: month.ok ? month.value : 1 },
        );
        if (conflict) nextErrors.companyReceiptAge = conflict;
      }
    }
    if (step === "dc") {
      const income = parseIncomeYen(draft.dcIncomeYen);
      const service = parseServiceYears(draft.dcServiceYears, "拠出年数");
      const age = parseReceiptAge(draft.dcReceiptAge, birthYear);
      if (!income.ok) nextErrors.dcIncomeYen = income.error;
      if (!service.ok) nextErrors.dcServiceYears = service.error;
      if (!age.ok) nextErrors.dcReceiptAge = age.error;
      if (birthYear !== null && service.ok && age.ok) {
        const month = parseMonth(draft.birthMonth, "生月");
        const conflict = serviceConflictsWithReceipt(
          service.value,
          receiptYearFromAge(birthYear, age.value),
          { year: birthYear, month: month.ok ? month.value : 1 },
        );
        if (conflict) nextErrors.dcReceiptAge = conflict;
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    const next = nextHearingStep(step, draft.hasDc);
    if (next === "done") {
      const parsed = parsedAnswers();
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      onComplete(inputFromAnswers(parsed.value, initial));
      return;
    }
    setStep(next);
  }

  function goBack() {
    const prev = prevHearingStep(step, draft.hasDc);
    if (prev) setStep(prev);
  }

  return (
    <Paper
      className="panel panel--raised hearing"
      p={{ base: "md", sm: "lg" }}
      component="section"
      id="main"
    >
      <div
        className="hearing-progress"
        role="progressbar"
        aria-label="質問の進み"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
      >
        <span style={{ transform: `scaleX(${(index + 1) / steps.length})` }} />
      </div>
      <Stack gap="lg" mt="md">
        <div>
          <Text size="sm" c="dimmed">
            質問 {index + 1} / {steps.length}
          </Text>
          <Title order={2} mt={6} fz={{ base: 22, sm: 26 }} lh={1.35} className="hearing-title">
            {copy.title}
          </Title>
          <Text size="sm" mt="xs" c="dimmed" lh={1.6}>
            {copy.lede}
          </Text>
        </div>

        {step === "birth" ? (
          <Group grow preventGrowOverflow={false} wrap="wrap">
            <DualIntField
              label="生年"
              min={FIELD_RANGES.birthYear.min}
              max={FIELD_RANGES.birthYear.max}
              optionSuffix="年"
              value={draft.birthYear}
              error={errors.birthYear}
              onChange={(birthYear) => patch("birthYear", birthYear)}
            />
            <DualIntField
              label="生月"
              min={FIELD_RANGES.month.min}
              max={FIELD_RANGES.month.max}
              optionSuffix="月"
              value={draft.birthMonth}
              error={errors.birthMonth}
              onChange={(birthMonth) => patch("birthMonth", birthMonth)}
            />
          </Group>
        ) : null}

        {step === "company" ? (
          <Stack gap="sm">
            <IntInput
              label="見込み受取額（円）"
              thousandSeparator=","
              min={0}
              value={draft.companyIncomeYen === "" ? "" : toInt(draft.companyIncomeYen)}
              error={errors.companyIncomeYen}
              onEmpty={() => patch("companyIncomeYen", "")}
              onValue={(companyIncomeYen) => patch("companyIncomeYen", String(companyIncomeYen))}
            />
            <DualIntField
              label="勤続年数"
              min={FIELD_RANGES.serviceYears.min}
              max={FIELD_RANGES.serviceYears.max}
              optionSuffix="年"
              value={draft.companyServiceYears}
              error={errors.companyServiceYears}
              onChange={(companyServiceYears) => patch("companyServiceYears", companyServiceYears)}
            />
            <ReceiptAgeField
              value={draft.companyReceiptAge}
              birthYear={birthYear}
              error={errors.companyReceiptAge}
              onChange={(companyReceiptAge) => patch("companyReceiptAge", companyReceiptAge)}
            />
          </Stack>
        ) : null}

        {step === "hasDc" ? (
          <div className="choice-row" role="group" aria-label="iDeCo か企業型 DC の一時金">
            <Choice selected={draft.hasDc} onClick={() => patch("hasDc", true)}>
              ある
            </Choice>
            <Choice selected={!draft.hasDc} onClick={() => patch("hasDc", false)}>
              ない
            </Choice>
          </div>
        ) : null}

        {step === "dc" ? (
          <Stack gap="sm">
            <IntInput
              label="見込み受取額（円）"
              thousandSeparator=","
              min={0}
              value={draft.dcIncomeYen === "" ? "" : toInt(draft.dcIncomeYen)}
              error={errors.dcIncomeYen}
              onEmpty={() => patch("dcIncomeYen", "")}
              onValue={(dcIncomeYen) => patch("dcIncomeYen", String(dcIncomeYen))}
            />
            <DualIntField
              label="拠出年数"
              min={FIELD_RANGES.serviceYears.min}
              max={FIELD_RANGES.serviceYears.max}
              optionSuffix="年"
              value={draft.dcServiceYears}
              error={errors.dcServiceYears}
              onChange={(dcServiceYears) => patch("dcServiceYears", dcServiceYears)}
            />
            <ReceiptAgeField
              value={draft.dcReceiptAge}
              birthYear={birthYear}
              error={errors.dcReceiptAge}
              onChange={(dcReceiptAge) => patch("dcReceiptAge", dcReceiptAge)}
            />
          </Stack>
        ) : null}

        {step === "hasExtra" ? (
          <div className="choice-row" role="group" aria-label="ほかの退職手当">
            <Choice selected={draft.hasExtra} onClick={() => patch("hasExtra", true)}>
              ある
            </Choice>
            <Choice selected={!draft.hasExtra} onClick={() => patch("hasExtra", false)}>
              ない
            </Choice>
          </div>
        ) : null}

        {step === "goal" ? (
          <div className="choice-row" role="group" aria-label="見たい比較">
            <Choice selected={draft.goal === "simultaneous"} onClick={() => patch("goal", "simultaneous")}>
              同時受取
            </Choice>
            <Choice selected={draft.goal === "sequence"} onClick={() => patch("goal", "sequence")}>
              先後の比較
            </Choice>
          </div>
        ) : null}

        <Group className="hit-lg" grow preventGrowOverflow={false} wrap="wrap">
          <Button type="button" variant="default" onClick={goBack} disabled={!prevHearingStep(step, draft.hasDc)}>
            戻る
          </Button>
          <Button type="button" onClick={goNext}>
            {isLast ? "結果を見る" : "次へ"}
          </Button>
        </Group>
        <button type="button" className="text-link" onClick={onSkip}>
          入力欄から始める
        </button>
      </Stack>
    </Paper>
  );
}

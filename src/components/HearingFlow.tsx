"use client";

import { useMemo, useState } from "react";
import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { totalMonths, type SimulationInput } from "@/engine";
import { IntInput } from "./IntInput";
import { IntPickerField } from "./IntPickerField";
import { ReceiptAgeField } from "./ReceiptAgeField";
import { FIELD_RANGES } from "@/lib/field-ranges";
import { toInt } from "@/lib/ui-numbers";
import {
  parseBirthYear,
  parseReceiptAge,
  parseServiceYears,
  receiptYearFromAge,
} from "@/lib/field-validation";
import {
  answersFromInput,
  detailedServiceYears,
  hearingGoalChange,
  hearingStepErrorKeys,
  hearingStepForErrors,
  inputFromAnswers,
  keepsDetailedIntervals,
  nextHearingStep,
  parseDraft,
  prevHearingStep,
  visibleHearingSteps,
  type HearingDraft,
  type HearingStepId,
} from "@/lib/hearing";

const STEP_COPY: Record<HearingStepId, { title: string; lede: string }> = {
  birth: {
    title: "生年月を選んでください",
    lede: "受取年は、その年齢の誕生日を迎える暦年です。iDeCo の 60歳も同じです。",
  },
  company: {
    title: "会社の退職金について教えてください",
    lede: "見込み受取額を入れ、勤続年数と受取年齢を選んでください。受取年は生年月から出します。",
  },
  hasDc: {
    title: "iDeCo か企業型 DC の一時金はありますか",
    lede: "あると、受け取る順で税額が変わります。",
  },
  dc: {
    title: "iDeCo か企業型 DC の一時金について教えてください",
    lede: "見込み受取額を入れ、拠出年数と受取年齢を選んでください。拠出年数は勤続年数として扱います。受取年は生年月から出します。",
  },
  hasExtra: {
    title: "ほかに退職手当はありますか",
    lede: "ある場合は、次の入力画面で額と受取年を直せます。",
  },
  goal: {
    title: "受け取る順の比較を見ますか",
    lede: "会社の退職金1本と DC の一時金1本のときだけ、順を変えた比較が出ます。",
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
  const [draft, setDraft] = useState<HearingDraft>({
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
  const [companyAgeBeforeShared, setCompanyAgeBeforeShared] = useState<string | null>(null);
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

  const prevCompany = initial.benefits.find((benefit) => benefit.kind === "company");
  const prevDc = initial.benefits.find((benefit) => benefit.kind === "dc");
  const dcServiceParsed = parseServiceYears(draft.dcServiceYears, "拠出年数");
  const dcServiceYears = dcServiceParsed.ok ? dcServiceParsed.value : 10;
  const dcMembershipMonths =
    keepsDetailedIntervals(prevDc, dcServiceYears) && prevDc?.intervals
      ? totalMonths(prevDc.intervals)
      : undefined;
  const sharedAge = parseReceiptAge(draft.dcReceiptAge, birthYear, {
    kind: "dc",
    serviceYears: dcServiceYears,
    membershipMonths: dcMembershipMonths,
  });
  const sharedYear =
    birthYear !== null && sharedAge.ok ? receiptYearFromAge(birthYear, sharedAge.value) : null;

  function validateCurrentStep(): boolean {
    const parsed = parseDraft(draft, initial.benefits);
    if (parsed.ok) {
      setErrors({});
      return true;
    }
    const allowed = new Set(hearingStepErrorKeys(step, draft));
    const visible: Record<string, string> = {};
    for (const [key, message] of Object.entries(parsed.errors)) {
      if (allowed.has(key)) visible[key] = message;
    }
    setErrors(visible);
    return Object.keys(visible).length === 0;
  }

  function goNext() {
    const next = nextHearingStep(step, draft.hasDc);
    if (next === "done") {
      const parsed = parseDraft(draft, initial.benefits);
      if (!parsed.ok) {
        setErrors(parsed.errors);
        setStep(hearingStepForErrors(draft, parsed.errors));
        return;
      }
      onComplete(inputFromAnswers(parsed.value, initial));
      return;
    }
    if (!validateCurrentStep()) return;
    setStep(next);
  }

  function chooseGoal(goal: HearingDraft["goal"]) {
    const next = hearingGoalChange(draft, goal, companyAgeBeforeShared);
    setDraft(next.draft);
    setCompanyAgeBeforeShared(next.companyAgeBeforeShared);
    setErrors((prev) => {
      if (!prev.companyReceiptAge && !prev.dcReceiptAge) return prev;
      const cleared = { ...prev };
      delete cleared.companyReceiptAge;
      delete cleared.dcReceiptAge;
      return cleared;
    });
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
            <IntPickerField
              label="生年"
              min={FIELD_RANGES.birthYear.min}
              max={FIELD_RANGES.birthYear.max}
              optionSuffix="年"
              value={draft.birthYear}
              error={errors.birthYear}
              pickerCenter={new Date().getFullYear()}
              onChange={(birthYear) => patch("birthYear", birthYear)}
            />
            <IntPickerField
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
            <IntPickerField
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
              kind="company"
              error={errors.companyReceiptAge}
              onChange={(companyReceiptAge) => patch("companyReceiptAge", companyReceiptAge)}
            />
            {detailedServiceYears(prevCompany) !== null ? (
              <Text size="sm" c="var(--ink-muted)">
                {keepsDetailedIntervals(prevCompany, Number(draft.companyServiceYears))
                  ? "年月で入れた区間は残します。"
                  : "年数を変えると、年月で入れた区間はやめて、この年数で計算します。"}
              </Text>
            ) : null}
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
            <IntPickerField
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
              kind="dc"
              serviceYears={dcServiceYears}
              membershipMonths={dcMembershipMonths}
              error={errors.dcReceiptAge}
              onChange={(dcReceiptAge) => patch("dcReceiptAge", dcReceiptAge)}
            />
            {detailedServiceYears(prevDc) !== null ? (
              <Text size="sm" c="var(--ink-muted)">
                {keepsDetailedIntervals(prevDc, Number(draft.dcServiceYears))
                  ? "年月で入れた区間は残します。"
                  : "年数を変えると、年月で入れた区間はやめて、この年数で計算します。"}
              </Text>
            ) : null}
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
          <Stack gap="sm">
            <div className="choice-row" role="group" aria-label="見たい比較">
              <Choice selected={draft.goal === "simultaneous"} onClick={() => chooseGoal("simultaneous")}>
                同時受取
              </Choice>
              <Choice selected={draft.goal === "sequence"} onClick={() => chooseGoal("sequence")}>
                先後の比較
              </Choice>
            </div>
            {draft.goal === "simultaneous" && draft.hasDc ? (
              <Stack gap="xs">
                <Text size="sm" c="var(--ink-muted)" lh={1.6}>
                  ここで選んだ1つの年齢を、会社と DC の両方の受取年齢にします。
                </Text>
                <ReceiptAgeField
                  label="両方の受取年齢"
                  value={draft.dcReceiptAge}
                  birthYear={birthYear}
                  kind="dc"
                  serviceYears={dcServiceYears}
                  membershipMonths={dcMembershipMonths}
                  error={errors.dcReceiptAge ?? errors.companyReceiptAge}
                  onChange={(age) => {
                    setDraft((prev) => ({
                      ...prev,
                      dcReceiptAge: age,
                      companyReceiptAge: age,
                    }));
                    setErrors((prev) => {
                      if (!prev.dcReceiptAge && !prev.companyReceiptAge) return prev;
                      const next = { ...prev };
                      delete next.dcReceiptAge;
                      delete next.companyReceiptAge;
                      return next;
                    });
                  }}
                />
                {sharedAge.ok && sharedYear !== null ? (
                  <Text size="sm" lh={1.6}>
                    会社も DC も、{sharedAge.value}歳（{sharedYear}年）で受け取ります。
                  </Text>
                ) : null}
              </Stack>
            ) : null}
            {draft.goal === "sequence" && draft.hasDc ? (
              <Text size="sm" c="var(--ink-muted)">
                会社は{draft.companyReceiptAge || "—"}歳、DC は{draft.dcReceiptAge || "—"}歳のまま比べます。DC の年齢は変えません。
              </Text>
            ) : null}
          </Stack>
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
          自分で入力する
        </button>
      </Stack>
    </Paper>
  );
}

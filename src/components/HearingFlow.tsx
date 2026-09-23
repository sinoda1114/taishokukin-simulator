"use client";

import { useMemo, useState } from "react";
import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { SimulationInput } from "@/engine";
import { IntInput } from "./IntInput";
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
    lede: "iDeCo の受取できる暦年を出すのに使います。",
  },
  company: {
    title: "会社の退職金は、いくらで、何年勤めて、何年に受けますか",
    lede: "見込みの額と、勤続年数、受取年です。",
  },
  hasDc: {
    title: "iDeCo か企業型 DC の一時金はありますか",
    lede: "あると、受取の順で税が変わります。",
  },
  dc: {
    title: "その額、拠出年数、受取年は",
    lede: "拠出年数が勤続年数になります。",
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

export function HearingFlow({
  initial,
  onSkip,
  onComplete,
}: {
  initial: SimulationInput;
  onSkip: () => void;
  onComplete: (input: SimulationInput) => void;
}) {
  const [answers, setAnswers] = useState<HearingAnswers>(() => answersFromInput(initial));
  const [step, setStep] = useState<HearingStepId>("birth");
  const steps = useMemo(() => visibleHearingSteps(answers.hasDc), [answers.hasDc]);
  const index = Math.max(0, steps.indexOf(step));
  const copy = STEP_COPY[step];
  const isLast = nextHearingStep(step, answers.hasDc) === "done";

  function goNext() {
    const next = nextHearingStep(step, answers.hasDc);
    if (next === "done") {
      onComplete(inputFromAnswers(answers, initial));
      return;
    }
    setStep(next);
  }

  function goBack() {
    const prev = prevHearingStep(step, answers.hasDc);
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
            <IntInput
              label="生年"
              min={1900}
              max={2200}
              value={answers.birthYear}
              emptyValue={answers.birthYear}
              onValue={(birthYear) => setAnswers((prev) => ({ ...prev, birthYear }))}
            />
            <IntInput
              label="生月"
              min={1}
              max={12}
              value={answers.birthMonth}
              emptyValue={answers.birthMonth}
              onValue={(birthMonth) => setAnswers((prev) => ({ ...prev, birthMonth }))}
            />
          </Group>
        ) : null}

        {step === "company" ? (
          <Stack gap="sm">
            <IntInput
              label="見込み受取額（円）"
              thousandSeparator=","
              min={0}
              value={answers.companyIncomeYen}
              onValue={(companyIncomeYen) => setAnswers((prev) => ({ ...prev, companyIncomeYen }))}
            />
            <Group grow preventGrowOverflow={false} wrap="wrap">
              <IntInput
                label="勤続年数"
                min={1}
                max={80}
                value={answers.companyServiceYears}
                onValue={(companyServiceYears) =>
                  setAnswers((prev) => ({ ...prev, companyServiceYears: Math.max(1, companyServiceYears) }))
                }
              />
              <IntInput
                label="受取年"
                min={1980}
                max={2200}
                value={answers.companyReceiptYear}
                onValue={(companyReceiptYear) =>
                  setAnswers((prev) => ({ ...prev, companyReceiptYear }))
                }
              />
            </Group>
          </Stack>
        ) : null}

        {step === "hasDc" ? (
          <div className="choice-row" role="group" aria-label="iDeCo か企業型 DC の一時金">
            <Choice
              selected={answers.hasDc}
              onClick={() => setAnswers((prev) => ({ ...prev, hasDc: true }))}
            >
              ある
            </Choice>
            <Choice
              selected={!answers.hasDc}
              onClick={() => setAnswers((prev) => ({ ...prev, hasDc: false }))}
            >
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
              value={answers.dcIncomeYen}
              onValue={(dcIncomeYen) => setAnswers((prev) => ({ ...prev, dcIncomeYen }))}
            />
            <Group grow preventGrowOverflow={false} wrap="wrap">
              <IntInput
                label="拠出年数"
                min={1}
                max={80}
                value={answers.dcServiceYears}
                onValue={(dcServiceYears) =>
                  setAnswers((prev) => ({ ...prev, dcServiceYears: Math.max(1, dcServiceYears) }))
                }
              />
              <IntInput
                label="受取年"
                min={1980}
                max={2200}
                value={answers.dcReceiptYear}
                onValue={(dcReceiptYear) => setAnswers((prev) => ({ ...prev, dcReceiptYear }))}
              />
            </Group>
          </Stack>
        ) : null}

        {step === "hasExtra" ? (
          <div className="choice-row" role="group" aria-label="ほかの退職手当">
            <Choice
              selected={answers.hasExtra}
              onClick={() => setAnswers((prev) => ({ ...prev, hasExtra: true }))}
            >
              ある
            </Choice>
            <Choice
              selected={!answers.hasExtra}
              onClick={() => setAnswers((prev) => ({ ...prev, hasExtra: false }))}
            >
              ない
            </Choice>
          </div>
        ) : null}

        {step === "goal" ? (
          <div className="choice-row" role="group" aria-label="見たい比較">
            <Choice
              selected={answers.goal === "simultaneous"}
              onClick={() => setAnswers((prev) => ({ ...prev, goal: "simultaneous" }))}
            >
              同時受取
            </Choice>
            <Choice
              selected={answers.goal === "sequence"}
              onClick={() => setAnswers((prev) => ({ ...prev, goal: "sequence" }))}
            >
              先後の比較
            </Choice>
          </div>
        ) : null}

        <Group className="hit-lg" grow preventGrowOverflow={false} wrap="wrap">
          <Button type="button" variant="default" onClick={goBack} disabled={!prevHearingStep(step, answers.hasDc)}>
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

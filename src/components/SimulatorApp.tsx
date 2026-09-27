"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  CopyButton,
  Grid,
  Box,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  ageInCalendarYear,
  buildThreePatterns,
  searchReceiptYears,
  simulate,
  yearOfAge,
  type BenefitInput,
  type SimulationInput,
} from "@/engine";
import { isRuleMode, RULE_MODE_LABELS, parseSimulationInput } from "@/lib/parse-input";
import { defaultInput } from "@/lib/default-input";
import { FIELD_RANGES } from "@/lib/field-ranges";
import { parseBirthYear, parseMonth } from "@/lib/field-validation";
import { buildConsultSummary } from "@/lib/consult-summary";
import { HearingFlow } from "./HearingFlow";
import { BenefitEditor } from "./BenefitEditor";
import { IntPickerField } from "./IntPickerField";
import { ResultPanel } from "./ResultPanel";
import { ConsultChat } from "./ConsultChat";

const uid = () => Math.random().toString(36).slice(2, 9);

const RULE_OPTIONS = Object.entries(RULE_MODE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function absoluteShareUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window === "undefined") return url;
  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
}

type Props = {
  initialInput?: SimulationInput;
  shareToken?: string;
};

export function SimulatorApp({ initialInput, shareToken }: Props) {
  const [input, setInput] = useState<SimulationInput>(initialInput ?? defaultInput);
  const [phase, setPhase] = useState<"hearing" | "results">(
    initialInput || shareToken ? "results" : "hearing",
  );
  const [saveUrl, setSaveUrl] = useState(shareToken ? `/s/${shareToken}` : "");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [birthYearRaw, setBirthYearRaw] = useState(String(input.birthYearMonth?.year ?? ""));
  const [birthMonthRaw, setBirthMonthRaw] = useState(String(input.birthYearMonth?.month ?? ""));
  const [benefitOk, setBenefitOk] = useState<Record<string, boolean>>({});
  const [consultOpen, setConsultOpen] = useState(false);

  const birthYearParsed = parseBirthYear(birthYearRaw);
  const birthMonthParsed = parseMonth(birthMonthRaw, "生月");
  const birthValid = birthYearParsed.ok && birthMonthParsed.ok;
  const benefitsValid = input.benefits.every((benefit) => benefitOk[benefit.id] !== false);

  const computed = useMemo(() => {
    if (!birthValid || !benefitsValid) {
      return {
        result: null,
        preAmendment: null,
        postAmendment: null,
        patterns: null,
        search: null,
        error: "",
      };
    }
    try {
      const parsed = parseSimulationInput(input);
      return {
        result: simulate(parsed),
        preAmendment: simulate({ ...parsed, ruleMode: "pre_2026" }),
        postAmendment: simulate({ ...parsed, ruleMode: "post_2026" }),
        patterns: buildThreePatterns(parsed),
        search: parsed.benefits.some((b) => b.optimizeReceiptYear)
          ? searchReceiptYears(parsed)
          : null,
        error: "",
      };
    } catch {
      return {
        result: null,
        preAmendment: null,
        postAmendment: null,
        patterns: null,
        search: null,
        error: "入力が不正です。年数・金額を確認してください。",
      };
    }
  }, [benefitsValid, birthValid, input]);

  const consultSummary = useMemo(
    () =>
      buildConsultSummary({
        phase,
        birthYear: input.birthYearMonth?.year ?? null,
        birthMonth: input.birthYearMonth?.month ?? null,
        ruleMode: input.ruleMode,
        benefits: input.benefits,
        result: computed.result,
        preAmendment: computed.preAmendment,
        postAmendment: computed.postAmendment,
        patterns: computed.patterns,
        search: computed.search,
      }),
    [computed, input, phase],
  );

  function commitBirth(yearRaw: string, monthRaw: string) {
    const year = parseBirthYear(yearRaw);
    const month = parseMonth(monthRaw, "生月");
    if (!year.ok || !month.ok) return;
    const nextBirth = { year: year.value, month: month.value };
    setInput((prev) => {
      const previousBirth = prev.birthYearMonth;
      return {
        ...prev,
        birthYearMonth: nextBirth,
        benefits: previousBirth
          ? prev.benefits.map((benefit) => ({
              ...benefit,
              receiptYear: yearOfAge(nextBirth, ageInCalendarYear(previousBirth, benefit.receiptYear)),
            }))
          : prev.benefits,
      };
    });
  }

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
    <>
      {phase === "hearing" ? (
        <HearingFlow
          initial={input}
          onSkip={() => setPhase("results")}
          onComplete={(next) => {
            setInput(next);
            setBirthYearRaw(String(next.birthYearMonth?.year ?? ""));
            setBirthMonthRaw(String(next.birthYearMonth?.month ?? ""));
            setPhase("results");
          }}
        />
      ) : (
    <Grid id="main" gutter={{ base: "lg", md: "xl" }} component="main" align="start">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Paper className="panel panel--flat" p={{ base: "md", sm: "lg" }} component="section" aria-labelledby="input-heading">
          <Stack gap="md">
            <Anchor href="#results" className="jump-results" size="sm">
              結果を見る
            </Anchor>
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <Title order={2} id="input-heading">
                入力
              </Title>
              <button type="button" className="text-link" onClick={() => setPhase("hearing")}>
                質問に戻る
              </button>
            </Group>
            <Group grow preventGrowOverflow={false} wrap="wrap">
              <IntPickerField
                label="生年"
                min={FIELD_RANGES.birthYear.min}
                max={FIELD_RANGES.birthYear.max}
                optionSuffix="年"
                value={birthYearRaw}
                error={birthYearParsed.ok ? undefined : birthYearParsed.error}
                pickerCenter={new Date().getFullYear()}
                onChange={(raw) => {
                  setBirthYearRaw(raw);
                  commitBirth(raw, birthMonthRaw);
                }}
              />
              <IntPickerField
                label="生月"
                min={FIELD_RANGES.month.min}
                max={FIELD_RANGES.month.max}
                optionSuffix="月"
                value={birthMonthRaw}
                error={birthMonthParsed.ok ? undefined : birthMonthParsed.error}
                onChange={(raw) => {
                  setBirthMonthRaw(raw);
                  commitBirth(birthYearRaw, raw);
                }}
              />
            </Group>
            <Text size="sm" c="dimmed">
              受取年齢を選ぶと、受取年はその年齢の誕生日を迎える暦年になります。
            </Text>
            <Select
              label="適用ルール"
              data={RULE_OPTIONS}
              value={input.ruleMode}
              allowDeselect={false}
              onChange={(value) => {
                if (value && isRuleMode(value)) setInput((prev) => ({ ...prev, ruleMode: value }));
              }}
            />
            <Text size="sm" c="dimmed">
              簡易の勤続年数は、受取年の12月から遡った期間です。探索と3行比較では受取年だけを動かします。
            </Text>
            {input.benefits.map((benefit, index) => (
              <BenefitEditor
                key={benefit.id}
                index={index}
                benefit={benefit}
                birth={input.birthYearMonth}
                onChange={(patch) => updateBenefit(benefit.id, patch)}
                onRemove={() => removeBenefit(benefit.id)}
                onValidityChange={(ok) =>
                  setBenefitOk((prev) => (prev[benefit.id] === ok ? prev : { ...prev, [benefit.id]: ok }))
                }
                canRemove={input.benefits.length > 1}
                canOptimize={Boolean(input.birthYearMonth) && benefit.kind === "dc"}
              />
            ))}
            <Group className="hit-lg" grow preventGrowOverflow={false} wrap="wrap">
              <Button
                type="button"
                variant="default"
                onClick={addBenefit}
                disabled={input.benefits.length >= 6}
              >
                手当を追加する（最大6件）
              </Button>
              <Button type="button" onClick={onSave} loading={saving} disabled={!birthValid || !benefitsValid}>
                共有 URL を作る
              </Button>
            </Group>
            {saveError ? (
              <Alert className="notice notice--error" color="red">
                {saveError}
              </Alert>
            ) : null}
            {saveUrl ? (
              <Box className="share notice" role="status" aria-live="polite">
                共有 URL:{" "}
                <Anchor href={saveUrl} underline="always">
                  {saveUrl}
                </Anchor>
                <CopyButton value={absoluteShareUrl(saveUrl)}>
                  {({ copied, copy }) => (
                    <Button size="compact-sm" variant="default" mt="xs" onClick={copy}>
                      {copied ? "コピーした" : "コピー"}
                    </Button>
                  )}
                </CopyButton>
              </Box>
            ) : null}
            {computed.error ? (
              <Alert className="notice notice--error" color="red">
                {computed.error}
              </Alert>
            ) : null}
          </Stack>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Paper
          className="panel panel--raised"
          p={{ base: "md", sm: "lg" }}
          id="results"
          component="section"
          tabIndex={-1}
          aria-labelledby="results-heading"
        >
          {computed.result && computed.preAmendment && computed.postAmendment ? (
            <ResultPanel
              result={computed.result}
              patterns={computed.patterns}
              search={computed.search}
              benefits={input.benefits}
              birth={input.birthYearMonth}
              ruleMode={input.ruleMode}
              preAmendment={computed.preAmendment}
              postAmendment={computed.postAmendment}
              onConsult={() => setConsultOpen(true)}
            />
          ) : (
            <Text c="dimmed">入力を直すと、ここに税額が出ます。</Text>
          )}
        </Paper>
      </Grid.Col>
    </Grid>
      )}
      <ConsultChat
        open={consultOpen}
        summary={consultSummary}
        onOpen={() => setConsultOpen(true)}
        onClose={() => setConsultOpen(false)}
      />
      <div className="consult-fab-space" aria-hidden="true" />
    </>
  );
}

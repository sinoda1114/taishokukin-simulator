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
  buildThreePatterns,
  searchReceiptYears,
  simulate,
  type BenefitInput,
  type SimulationInput,
} from "@/engine";
import { isRuleMode, RULE_MODE_LABELS, parseSimulationInput } from "@/lib/parse-input";
import { BenefitEditor } from "./BenefitEditor";
import { IntInput } from "./IntInput";
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
  const [saveUrl, setSaveUrl] = useState(shareToken ? `/s/${shareToken}` : "");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const computed = useMemo(() => {
    try {
      const parsed = parseSimulationInput(input);
      return {
        result: simulate(parsed),
        patterns: buildThreePatterns(parsed),
        search: parsed.benefits.some((b) => b.optimizeReceiptYear)
          ? searchReceiptYears(parsed)
          : null,
        error: "",
      };
    } catch {
      return {
        result: null,
        patterns: null,
        search: null,
        error: "入力が不正です。年数・金額を確認してください。",
      };
    }
  }, [input]);

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
    <Grid id="main" gutter={{ base: "lg", md: "xl" }} component="main" align="start">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Paper className="panel panel--flat" p={{ base: "md", sm: "lg" }} component="section" aria-labelledby="input-heading">
          <Stack gap="md">
            <Anchor href="#results" className="jump-results" size="sm">
              結果を見る
            </Anchor>
            <Title order={2} id="input-heading">
              入力
            </Title>
            <Group grow preventGrowOverflow={false} wrap="wrap">
              <IntInput
                label="生年"
                min={1900}
                max={2200}
                value={input.birthYearMonth?.year ?? ""}
                emptyValue={input.birthYearMonth?.year ?? 1965}
                onValue={(year) =>
                  setInput((prev) => ({
                    ...prev,
                    birthYearMonth: {
                      year,
                      month: prev.birthYearMonth?.month ?? 1,
                    },
                  }))
                }
              />
              <IntInput
                label="生月"
                min={1}
                max={12}
                value={input.birthYearMonth?.month ?? ""}
                emptyValue={input.birthYearMonth?.month ?? 1}
                onValue={(month) =>
                  setInput((prev) => ({
                    ...prev,
                    birthYearMonth: {
                      year: prev.birthYearMonth?.year ?? 1965,
                      month,
                    },
                  }))
                }
              />
            </Group>
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
              簡易の勤続は、受取年の12月から年数を遡った期間です。探索と3行比較は受取年だけを動かします。
            </Text>
            {input.benefits.map((benefit, index) => (
              <BenefitEditor
                key={benefit.id}
                index={index}
                benefit={benefit}
                onChange={(patch) => updateBenefit(benefit.id, patch)}
                onRemove={() => removeBenefit(benefit.id)}
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
                手当を追加（最大6）
              </Button>
              <Button type="button" onClick={onSave} loading={saving}>
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
          {computed.result ? (
            <ResultPanel
              result={computed.result}
              patterns={computed.patterns}
              search={computed.search}
              benefits={input.benefits}
            />
          ) : (
            <Text c="dimmed">入力を直すと、ここに税額が出ます。</Text>
          )}
        </Paper>
      </Grid.Col>
    </Grid>
  );
}

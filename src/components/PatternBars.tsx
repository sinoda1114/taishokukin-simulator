"use client";

import { Text } from "@mantine/core";

export function PatternBars({
  rows,
}: {
  rows: Array<{
    key: string;
    label: string;
    years: string;
    tax: number | null;
    taxText: string;
    isBest: boolean;
    omittedLine?: string | null;
  }>;
}) {
  const max = Math.max(...rows.map((row) => row.tax ?? 0), 1);
  return (
    <div className="bar-chart" role="img" aria-label="3パターンの税額比較">
      {rows.map((row) => {
        const width = row.tax === null ? 0 : Math.max(8, (row.tax / max) * 100);
        return (
          <div key={row.key} className={row.isBest ? "bar-row is-best" : "bar-row"}>
            <div className="bar-meta">
              <Text fw={600} size="sm" style={{ wordBreak: "keep-all" }}>
                {row.isBest ? <span className="bar-mark" aria-hidden /> : null}
                {row.label}
                {row.isBest ? " · 3案の中で最小" : ""}
              </Text>
              <Text className="yen" size="sm" fw={600}>
                {row.taxText}
              </Text>
            </div>
            <Text size="sm" c="var(--ink-muted)">
              {row.years}
            </Text>
            {row.omittedLine ? (
              <Text size="sm" c="var(--ink-muted)">
                {row.omittedLine}
              </Text>
            ) : null}
            <div className="bar-track">
              <div
                className={row.isBest ? "bar-fill is-best" : "bar-fill"}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { Text } from "@mantine/core";
import { formatYen } from "@/lib/parse-input";

export function PatternBars({
  rows,
}: {
  rows: Array<{
    key: string;
    label: string;
    tax: number | null;
    isBest: boolean;
    omitted?: string;
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
                {row.isBest ? " · 税額最小" : ""}
              </Text>
              <Text className="yen" size="sm" fw={600}>
                {row.omitted ? "—" : formatYen(row.tax)}
              </Text>
            </div>
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

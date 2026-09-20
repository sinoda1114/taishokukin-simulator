import type { PatternComparison, SearchResult, SimulationResult } from "@/engine";
import { formatYen } from "@/lib/parse-input";

export function ResultPanel({
  result,
  patterns,
  search,
}: {
  result: SimulationResult;
  patterns: PatternComparison[] | null;
  search: SearchResult | null;
}) {
  const baseline = patterns?.find((p) => p.kind === "simultaneous" && !p.omittedReason);

  return (
    <section className="card stack">
      <h2>結果</h2>
      {result.totalTaxYen === null ? (
        <p className="warn">勤続5年以下の手当があるため、税額は出していません。</p>
      ) : (
        <p>
          合計税額 <strong>{formatYen(result.totalTaxYen)}</strong> ／ 手取り{" "}
          <strong>{formatYen(result.totalNetYen)}</strong>
          <span className="muted">（税率テーブル {result.rulesetVersion}）</span>
        </p>
      )}
      {result.warnings.map((w) => (
        <p key={w.code} className="muted">
          {w.message}
        </p>
      ))}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>受取年</th>
              <th>収入</th>
              <th>勤続</th>
              <th>控除（調整後）</th>
              <th>課税所得</th>
              <th>所得税</th>
              <th>復興税</th>
              <th>住民税</th>
              <th>税額</th>
              <th>手取り</th>
            </tr>
          </thead>
          <tbody>
            {result.years.map((year) => (
              <tr key={year.year}>
                <td>{year.year}</td>
                <td>{formatYen(year.incomeYen)}</td>
                <td>{year.serviceYears}年</td>
                <td>{formatYen(year.deductionAfterAdjustmentYen)}</td>
                <td>{formatYen(year.taxableYen)}</td>
                <td>{formatYen(year.incomeTaxYen)}</td>
                <td>{formatYen(year.reconstructionTaxYen)}</td>
                <td>{formatYen(year.residentTaxYen)}</td>
                <td>{formatYen(year.totalTaxYen)}</td>
                <td>{formatYen(year.netYen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.years.map((year) => (
        <details key={`steps-${year.year}`}>
          <summary>
            {year.year}年の計算過程（控除 {formatYen(year.statutoryDeductionYen)} → 調整後{" "}
            {formatYen(year.deductionAfterAdjustmentYen)}）
          </summary>
          <ul>
            {year.steps.map((step) => (
              <li key={step.code}>
                <strong>{step.label}</strong>: {step.formula}
                <br />
                {step.substituted}
                {step.resultYen !== undefined ? ` = ${formatYen(step.resultYen)}` : ""}
                {step.resultYears !== undefined ? ` / ${step.resultYears}年` : ""}
              </li>
            ))}
          </ul>
          {year.notes.map((note) => (
            <p key={note} className="muted">
              {note}
            </p>
          ))}
        </details>
      ))}

      {patterns ? (
        <>
          <h2>同時 / 退職金先 / iDeCo先</h2>
          <p className="muted">
            会社退職金1本と DC1本のときだけ、この3行を出します。同時との差額は会社の受取年での同時受取が基準です。
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>パターン</th>
                  <th>税額</th>
                  <th>同時との差</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((pattern) => {
                  const tax = pattern.result?.totalTaxYen;
                  const delta =
                    baseline && tax !== null && tax !== undefined && baseline.result?.totalTaxYen !== null && baseline.result?.totalTaxYen !== undefined
                      ? tax - baseline.result.totalTaxYen
                      : null;
                  return (
                    <tr key={pattern.kind}>
                      <td>{pattern.label}</td>
                      <td>{pattern.omittedReason ? "—" : formatYen(tax ?? null)}</td>
                      <td>
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${formatYen(delta)}`}
                      </td>
                      <td>{pattern.omittedReason ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {search ? (
        <>
          <h2>受取年の探索</h2>
          {search.truncated ? (
            <p className="warn">
              組合せが {search.combinationCount} あり、{search.hits.length} 件で打ち切りました。
            </p>
          ) : (
            <p className="muted">
              探索 {search.combinationCount} 通り。税額最小を先に、同じ税額なら受取が早い順です。
            </p>
          )}
          {search.best ? (
            <p className="ok">
              税額最小の試算:{" "}
              {Object.entries(search.best.receiptYears)
                .map(([id, year]) => `${id}=${year}年`)
                .join("、")}{" "}
              ／ {formatYen(search.best.result.totalTaxYen)}
            </p>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>受取年</th>
                  <th>税額</th>
                </tr>
              </thead>
              <tbody>
                {search.hits.slice(0, 8).map((hit, index) => (
                  <tr key={JSON.stringify(hit.receiptYears)} className={index === 0 ? "best" : undefined}>
                    <td>
                      {Object.entries(hit.receiptYears)
                        .map(([id, year]) => `${id} ${year}`)
                        .join(" / ")}
                    </td>
                    <td>{formatYen(hit.result.totalTaxYen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

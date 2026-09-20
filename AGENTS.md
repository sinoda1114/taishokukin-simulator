# 退職金シミュレーター — プロジェクト指示

GitHub: `sinoda1114/taishokukin-simulator`  
製品要件の正本: [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md)

このリポでは **実装のやり方** を次で固定する。製品の計算仕様は REQUIREMENTS 側。混ぜない。

## 実装のやり方（HOW）

- **pstack**（`/poteto-mode`）: エージェントの役割分担とモデル割当。割当は `.cursor/rules/pstack-models.mdc`。コスト上限は `.cursor/rules/pstack-cost.mdc`（既定の天井は `high`。`fast` / `xhigh` / `max` は利用者がその会話で指示したときだけ）。
- **サーモス**: ソースを足したら、完了・PR 準備の前に必須。`.cursor/rules/thermos-gate.mdc` と `.cursor/skills/thermos-gate/`。`/ai-review` は使わない。
- **PR 会話ゲート**: マージ前に未解決レビュー会話ゼロ。`.cursor/rules/pr-conversation-gate.mdc`。
- テスト規律: `notes/testing-discipline.md`
- pstack の説明: `notes/pstack.md`
- 開発フロー（worktree / PR / サーモス）: `notes/dev-workflow-multiagent.md`（看板固有の値は無視し、このリポの表を正とする）

## このリポ固有の値

| 項目 | 値 |
|---|---|
| GitHub | `sinoda1114/taishokukin-simulator` |
| パッケージ | 未定（実装時に決める。看板の pnpm 前提をそのまま持ち込まない） |
| 認証 | MVP はオフ（REQUIREMENTS F12）。後付け Clerk |
| 計算 | エンジンは純関数。ブラウザでもサーバーでも同じ |

## やらないこと

- `gmail-kanban` へのコミット・PR
- 看板の Clerk / Turso / Mantine / Vercel 設定をこのリポにコピーすること
- 要件にない機能の先取り

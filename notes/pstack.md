# pstack（このプロジェクト）

Gmail Kanban の実装作業は Cursor の pstack プラグインを入口にする。`/poteto-mode` が既定。git / PR / デプロイの運用は `notes/dev-workflow-multiagent.md` が正本のまま。pstack の Shipping プレイブックはマージしない。自分の PR は必須 CI が全部成功したら squash マージしてよい（詳細は同ファイル §6）。

## モデル割当

pstack のスキルは `~/.cursor/rules/pstack-models.mdc` を読む。リポの既定は `.cursor/rules/pstack-models.mdc`。新しい環境では次のどちらかを実行する。

```bash
./scripts/sync-pstack-models.sh
```

```text
/setup-pstack
```

役割を変えるときは `/setup-pstack` を再実行し、リポ側の `.cursor/rules/pstack-models.mdc` も同じ内容に揃える。コスト上限は `.cursor/rules/pstack-cost.mdc`。

## コスト上限

既定では `fast` / `xhigh` / `max` を含むスラッグを使わない。天井は `high`（例: `cursor-grok-4.6-high`, `claude-fable-5-1-thinking-high`）。

利用者がこの会話でそのティアを明示したときだけ使う。そのタスクが終わったら high 既定に戻す。設定ファイルを hot 側へ書き換えない（利用者が既定の変更を頼んだときだけ）。

プラグイン既定の `grok-4.6-fast-xhigh` はこの環境の Task スラッグに無い。コスト上限とも衝突するので `cursor-grok-4.6-high` を使う。

## 検証

ユーザー操作の証明は `.cursor/skills/verify-gmail-kanban/`。Vitest / Playwright のコマンドと Done 条件は `notes/testing-discipline.md` が正本。マップがアプリからずれたら `/maintain-verification-skill`。

## 運用との境界

| 層 | 正本 |
|---|---|
| 実装の進め方（playbook / 原則 / モデル） | pstack（`/poteto-mode`） |
| モデルのコスト上限 | `.cursor/rules/pstack-cost.mdc` |
| worktree / サーモス・ゲート / CI 緑で squash マージ / git 駆動デプロイ | `notes/dev-workflow-multiagent.md` |
| Issue / Project | `notes/task-management-issue-workflow.md` |
| テストコマンドと回帰対象 | `notes/testing-discipline.md` |

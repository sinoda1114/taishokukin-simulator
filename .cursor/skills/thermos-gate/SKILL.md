---
name: thermos-gate
description: >-
  退職金シミュレーターの実装後必須ゲート。クラウド／ローカル問わず、コード変更を「完了」にする前に
  Thermos（thermo-nuclear-review + thermo-nuclear-code-quality-review）を並列実行する。
  Use when finishing a feature, before declaring PR ready, after substantive code edits,
  or when the user mentions サーモス / thermos gate / 実装後レビュー.
---

# サーモス・ゲート（実装後フック）

`/ai-review` は使わない。代わりにこのスキルがレビューゲートになる。

## いつ走らせるか

- ソース変更をコミット／プッシュ／「完了」する前（必須）
- docs / rules のみなら省略可

## 手順

1. ベースを決める（通常 `origin/main`）。`git fetch origin main` してから:
   - `git diff --stat origin/main...HEAD`
   - `git diff origin/main...HEAD`
   - 変更ファイルの必要箇所を読む
2. **同じメッセージで** 次を並列起動（`run_in_background: true` 可）:
   - Task `subagent_type: "thermo-nuclear-review-subagent"`
   - Task `subagent_type: "thermo-nuclear-code-quality-review-subagent"`
3. 各 Task に渡すプロンプトに必ず含める:
   - `### Git / diff output`（stat + 本編 diff。大きすぎるときはファイル単位に分割し、全変更をカバー）
   - `### Changed file contents`（レビューに必要な全文／該当箇所）
   - ブランチ名と PR 番号（あれば）
4. 親が統合: 重複除去、重なりを重く見る、High から列挙
5. High（と必要な Medium）を修正 → 検証コマンド → 再サーモス（差分が残る場合）
6. PR 本文または最終返答に「サーモス実施・主な指摘と対応」を短く残す
7. レビュー会話を Resolve し、`pnpm pr:conversations` が通ることを確認（未解決のまま「マージ可」にしない）

## モデル

`.cursor/rules/pstack-models.mdc` のコスト上限に従う（利用者指示なしで `fast` / `xhigh` / `max` を付けない）。省略時は親モデル（`inherit`）。

## 関連

- 常時適用フック: `.cursor/rules/thermos-gate.mdc`
- 運用正本: `notes/dev-workflow-multiagent.md`
- プラグイン: Thermos の `thermos` / `thermo-nuclear-review` / `thermo-nuclear-code-quality-review`

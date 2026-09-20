---
name: pr-conversation-gate
description: >-
  Ensure GitHub PR review conversations are resolved so branch protection
  ("All comments must be resolved") does not block merge. Use before declaring
  a PR merge-ready, after addressing review feedback, or when merge is blocked
  by unresolved conversations.
---

# PR 会話ゲート

ブランチ保護の **All comments must be resolved** でマージが止まるのを防ぐ。

## いつ

- レビュー指摘を直した直後
- 「マージ可」「PR 準備完了」と言う直前
- UI に `Merging is blocked` / `All comments must be resolved` が出たとき

## 手順

1. 指摘をコードで直す（必要ならコミット／プッシュ）
2. **スレッドを Resolve**する。返信だけで終わらせない
3. 検査:

```bash
pnpm pr:conversations
# または PR 番号指定
./scripts/pr-conversation-gate.sh --pr <N>
```

4. 残りがあるとき:

```bash
pnpm pr:conversations:resolve       # outdated + 対応済み「返信あり」
pnpm pr:conversations:resolve-all   # 対応後のマージ直前に全部
```

`resolve-all` は未対応指摘を黙って閉じる用途ではない。

## ルール要点

- 「対応済み」返信後は同じスレッドを Resolve
- outdated スレッドも放置しない
- サーモス／CI 緑でも会話未解決なら完了扱いにしない

## 関連

- 常時適用: `.cursor/rules/pr-conversation-gate.mdc`
- 運用: `notes/dev-workflow-multiagent.md` §6.1

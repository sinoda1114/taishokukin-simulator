# テスト規律（Vitest / 選択的 TDD / Playwright E2E）

> 正本。エージェント・人間ともここに従う。  
> 目的: 看板のコア（ステータス・AI JSON・ユーザー分離・主要画面）を壊さないこと。  
> 全面 TDD は求めない。効くところにテストを先置きする。

## 1. レイヤとやり方

| レイヤ | ツール | 規律 |
|---|---|---|
| 純ロジック（`src/lib/*`、Zod スキーマ、ステータス判定、fingerprint 等） | Vitest | **テスト先行（選択的 TDD）**。実装前か同時に failing/passing テストを書く |
| Server Action / UI の薄い配線 | Vitest（切り出せるなら） | ロジックを `lib` に寄せてからテスト。コンポーネント全部の RTL は必須にしない |
| ユーザーが踏む主要経路 | Playwright | **E2E スモーク＋クリティカルパス**。機能追加で経路が変わるなら更新 |

## 2. 選択的 TDD（いつ先にテストを書くか）

**必ずテストを先（または実装と同コミットで必ず）書くもの**

- ステータス遷移・ボール判定・経過日数
- リマインド fingerprint / 再掲ルール
- AI 出力の Zod スキーマ（不正 JSON を落とす）
- Gmail URL パース、課金上限判定など境界ロジック

**テスト後追いでよいもの**

- 見た目・レイアウトだけの変更
- 一度きりのコピー調整
- 外部 API の薄いラッパ（モックコストが高い場合は E2E か手動 Preview で補う）

流れ（純ロジック）:

1. 振る舞いをテストで書く（Red）
2. 最小実装（Green）
3. 整理（Refactor）。テストは緑のまま

## 3. E2E（Playwright）

- コマンド: `pnpm test:e2e`（内部で `build` → Playwright。標準 CI も同じスクリプト）
- 置き場: `e2e/**/*.spec.ts`
- `@clerk/testing` + Testing Token を使う（development instance の `dev-browser-missing` 回避）
- ホストは **`localhost`**（`127.0.0.1` だと Clerk rewrite が 500 になりやすい）
- 最初の必須スモーク: 未ログインで `/sign-in` に到達／保護ルートが sign-in へ誘導（`e2e/smoke.spec.ts`）
- 認証後スモーク: `clerk.signIn`（ticket）→ `/dashboard` でカンバンシェル表示（`e2e/auth-smoke.spec.ts`）
- 認証 E2E 用テストユーザー: 環境変数 `E2E_CLERK_USER_EMAIL`、または `E2E_USER_JSON_PATH`（未指定時は `~/.config/gmail-kanban-secrets/e2e-user.json` の `email`）。未設定なら当該スペックは `test.skip`
- 認証後の詳細フロー（カンバン DnD・案件作成など）は別スペックで追加する

### CI での扱い

- 標準 CI（`ci-standard`）: `playwright.config.*` があれば `ci / e2e` が走る。e2e 前に `package.json` の `db:migrate` があれば実行する
- このリポは SQL migration journal が無いので `db:migrate` は `drizzle-kit push`（file DB の CI / ローカルと同じ）
- Clerk Testing Token 用のキーは呼び出し側 `ci.yml` の `secrets:` 明示マップ（`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`）。`pk_test_` / `sk_test_` のみ許可。未設定・`pk_live_` / `sk_live_` は unsigned スモークも含め `ci / e2e` 全体が失敗する
- `ci-standard` の `workflow_call` が Clerk secrets を宣言するまで（PR #6）、呼び出しは当該コミット SHA に固定する。`@main` へ未宣言 secrets を渡すと失敗する
- Clerk Development キーの正本は Clerk CLI。登録・更新は **`scripts/sync-clerk-dev-secrets.sh`**（GitHub Actions / `.env.clerk` / `.env.local` へ冪等上書き）。詳細は `notes/clerk-dev-secrets.md`
- キーをローテしたら必ず同期スクリプトを再実行する。古い `.env` をコピーして Actions に載せない
- ローカル / Cursor Cloud では secrets を読んで `pnpm test:e2e` を回す（エージェント検証に含める）

## 4. エージェントの検証ゲート（更新）

機能 PR を出す前に、変更に応じて次を通す:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`（Vitest。新規純ロジックにはテスト追加が原則）
4. `pnpm test:e2e`（E2E 対象を触った、またはスモークが壊れる可能性があるとき。Cloud/ローカルで実行）
5. 必要なら `pnpm build`（dev サーバ非起動時）

ユーザーに手動回帰を丸投げしない。Preview URL 確認は番人・人間の最終確認用。

## 5. Issue / Done 条件

タスク Issue の Done に次を含める（テンプレ準拠）:

- [ ] 純ロジックを触った場合: Vitest を追加または更新した
- [ ] 主要 UI 経路を触った場合: 関連 E2E を追加または更新した（未整備なら理由を PR に書く）
- [ ] `tsc` / `lint` / `test`（＋該当時 `test:e2e`）が通る

## 6. 優先して守る回帰対象（この PJ）

docs の初期方針どおり、特に次を落とさない:

- AI 出力 JSON（Zod）
- ステータス変更・履歴
- ユーザーごとのデータ分離
- 要対応／リマインド再掲
- 認証ゲート（未ログイン → sign-in）

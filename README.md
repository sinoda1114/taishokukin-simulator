# 退職金シミュレーター

正本は [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)（v0.6）。
実装のやり方は [`AGENTS.md`](AGENTS.md)。

計算エンジンは `src/engine` の純関数です。ブラウザでもサーバーでも同じ結果になります。

## 動かし方

```bash
npm install
npm test
npm run dev
```

検証:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

ローカルの保存先は `data/local.db`（libSQL）。本番（Vercel）は `TURSO_DATABASE_URL` が必須です。認証は `AUTH_PROVIDER=none` のままです。

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "退職金シミュレーター",
  description:
    "会社退職金と iDeCo/企業型DC 一時金の受取年・順序による退職所得の税額を試算します。税務助言ではありません。",
  robots: { index: true, follow: true },
  openGraph: {
    title: "退職金シミュレーター",
    description: "退職手当等の受取タイミングによる税額の試算。金額はOGPに出しません。",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="wrap">
          <header className="site">
            <h1>退職金シミュレーター</h1>
            <p className="lede">
              会社退職金と iDeCo / 企業型DC の一時金を、いつ・どの順で受けると税がどう変わるかを試算します。
            </p>
            <p className="disclaimer">
              これは試算であり、税務助言ではありません。申告の要否や個別事情は税理士・税務署に確認してください。
              計算は「退職所得の受給に関する申告書」提出済みの源泉徴収を前提にしています。
            </p>
          </header>
          {children}
          <footer className="site">
            <p>
              公開情報に基づく概算です。特定役員・短期退職手当等、年金受取、社会保険料は未対応です。
            </p>
            <p>
              <a href="/privacy">プライバシー</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

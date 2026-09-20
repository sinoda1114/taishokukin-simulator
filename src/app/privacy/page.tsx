export const metadata = {
  title: "プライバシー | 退職金シミュレーター",
};

export default function PrivacyPage() {
  return (
    <main className="stack">
      <h2>プライバシー</h2>
      <p>
        保存するのは試算の入力（金額・年月・種類）と計算結果、共有用のランダムな token だけです。氏名・住所・口座は集めません。
      </p>
      <p>
        利用ログは手当の本数と種類など匿名化した項目だけを保存します。IP アドレスや端末情報は保存しません。
      </p>
      <p>共有 URL を知っている人は、その試算を閲覧できます。第三者の履歴への取り込みは行いません。</p>
    </main>
  );
}

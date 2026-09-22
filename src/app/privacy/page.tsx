import { Anchor, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

export const metadata = {
  title: "プライバシー | 退職金シミュレーター",
};

export default function PrivacyPage() {
  return (
    <Stack gap="md" component="main" id="main" maw={720}>
      <Title order={2}>プライバシー</Title>
      <Text>
        保存するのは試算の入力（金額・年月・種類）と計算結果、共有用のランダムな token だけです。氏名・住所・口座は集めません。
      </Text>
      <Text>
        利用ログは手当の本数と種類など匿名化した項目だけを保存します。IP アドレスや端末情報は保存しません。
      </Text>
      <Text>共有 URL を知っている人は、その試算を閲覧できます。第三者の履歴への取り込みは行いません。</Text>
      <Anchor component={Link} href="/">
        シミュレーターへ戻る
      </Anchor>
    </Stack>
  );
}

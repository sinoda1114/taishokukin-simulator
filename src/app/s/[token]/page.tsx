import type { Metadata } from "next";
import { Anchor, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { SimulatorApp } from "@/components/SimulatorApp";
import { loadSimulation } from "@/lib/simulations";

export const metadata: Metadata = {
  title: "共有された試算 | 退職金シミュレーター",
  robots: { index: false, follow: false },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loaded = await loadSimulation(token);
  if (!loaded) {
    return (
      <Stack component="main" gap="sm">
        <Text>この共有 URL の試算は見つかりませんでした。</Text>
        <Anchor component={Link} href="/">
          トップへ戻る
        </Anchor>
      </Stack>
    );
  }
  return <SimulatorApp initialInput={loaded.input} shareToken={token} />;
}

"use client";

import { Alert, Anchor, Box, Container, Text, Title } from "@mantine/core";
import Link from "next/link";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box mih="100vh">
      <Container size={1120} px={{ base: 12, sm: 20 }} py={{ base: 16, sm: 28 }} pb={56}>
        <Box component="header" mb={{ base: "md", sm: "lg" }}>
          <Box
            w={6}
            h={{ base: 28, sm: 34 }}
            bg="navy.8"
            mb="sm"
            style={{ borderRadius: 2 }}
            aria-hidden
          />
          <Title
            order={1}
            fz={{ base: 22, sm: 28 }}
            lh={1.3}
            style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}
          >
            退職金シミュレーター
          </Title>
          <Text c="dimmed" mt="xs" fz={{ base: "sm", sm: "md" }} lh={1.6}>
            会社退職金と iDeCo / 企業型DC の一時金を、いつ・どの順で受けると税がどう変わるかを試算します。
          </Text>
          <Alert color="yellow" mt="md" title="税務助言ではありません">
            申告の要否や個別事情は税理士・税務署に確認してください。計算は「退職所得の受給に関する申告書」提出済みの源泉徴収を前提にしています。
          </Alert>
        </Box>
        {children}
        <Box component="footer" mt="xl" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
          <Text size="sm" c="dimmed">
            公開情報に基づく概算です。特定役員・短期退職手当等、年金受取、社会保険料は未対応です。
          </Text>
          <Anchor component={Link} href="/privacy" size="sm" mt="xs" display="inline-block">
            プライバシー
          </Anchor>
        </Box>
      </Container>
    </Box>
  );
}

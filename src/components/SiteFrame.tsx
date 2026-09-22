"use client";

import { Anchor, Box, Container, Text, Title } from "@mantine/core";
import Link from "next/link";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box mih="100vh" bg="var(--paper)">
      <a className="skip-link" href="#main">
        本文へ
      </a>
      <Container size={1120} px={{ base: 16, sm: 24 }} py={{ base: 20, sm: 32 }} pb={56}>
        <Box component="header" className="site-header">
          <Title
            order={1}
            fz={{ base: 24, sm: 32 }}
            lh={1.3}
            c="var(--ink)"
            style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}
          >
            退職金シミュレーター
          </Title>
          <Anchor href="#results" hiddenFrom="md" size="sm" mt="sm" display="inline-block">
            結果を見る
          </Anchor>
          <Text className="lede" mt="sm" fz={{ base: "sm", sm: "md" }} lh={1.7} c="var(--ink-muted)">
            退職金と iDeCo 一時金を、どの順で受けると税がいくらになるかを試算します。
          </Text>
          <Box className="disclaimer" role="note">
            <Text fw={600} c="var(--ink)">
              税務助言ではありません
            </Text>
            <Text size="sm" mt={4} lh={1.6} c="var(--ink-muted)">
              申告の要否は税理士か税務署に確認してください。計算は退職所得の受給に関する申告書を出した前提です。
            </Text>
          </Box>
        </Box>
        {children}
        <Box component="footer" className="site-footer">
          <Text size="sm" lh={1.6} c="var(--ink-muted)">
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

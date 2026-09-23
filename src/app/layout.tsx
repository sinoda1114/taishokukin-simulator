import type { Metadata, Viewport } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import { Providers } from "@/components/Providers";
import { SiteFrame } from "@/components/SiteFrame";
import "@mantine/core/styles.css";
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

export const viewport: Viewport = {
  themeColor: "#ebe7e0",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" forceColorScheme="light" />
      </head>
      <body>
        <Providers>
          <SiteFrame>{children}</SiteFrame>
        </Providers>
      </body>
    </html>
  );
}

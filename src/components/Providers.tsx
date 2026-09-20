"use client";

import { MantineProvider } from "@mantine/core";
import { theme } from "@/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="light"
      forceColorScheme="light"
      cssVariablesResolver={() => ({
        variables: {},
        light: { "--mantine-color-body": "#f3f0ea" },
        dark: { "--mantine-color-body": "#f3f0ea" },
      })}
    >
      {children}
    </MantineProvider>
  );
}

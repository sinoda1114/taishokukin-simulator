import { createTheme, type MantineColorsTuple } from "@mantine/core";

const navy: MantineColorsTuple = [
  "#eef3f8",
  "#d5e0ec",
  "#a9c0d6",
  "#7a9ebe",
  "#5682ab",
  "#3f6f9c",
  "#345f87",
  "#2b4e70",
  "#23405c",
  "#1a2f45",
];

export const theme = createTheme({
  primaryColor: "navy",
  primaryShade: 7,
  colors: { navy },
  fontFamily:
    '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif',
  headings: {
    fontFamily:
      '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif',
    fontWeight: "700",
  },
  defaultRadius: "md",
  cursorType: "pointer",
  components: {
    Button: {
      defaultProps: { fw: 600 },
    },
    Paper: {
      defaultProps: {
        withBorder: true,
        shadow: "xs",
        radius: "md",
      },
    },
  },
});

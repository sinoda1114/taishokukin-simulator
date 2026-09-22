import { createTheme, type MantineColorsTuple } from "@mantine/core";

const ink: MantineColorsTuple = [
  "#eef1f4",
  "#d5dbe3",
  "#b3bcc9",
  "#8d9aab",
  "#6b7a8e",
  "#546274",
  "#3e4b5c",
  "#2a3444",
  "#1a2330",
  "#161c28",
];

const DISPLAY =
  '"Yu Mincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HGS明朝E", "MS PMincho", serif';
const UI =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';

export const theme = createTheme({
  primaryColor: "ink",
  primaryShade: 9,
  colors: { ink },
  black: "#161c28",
  white: "#f6f4ef",
  fontFamily: UI,
  headings: {
    fontFamily: DISPLAY,
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.3", fontWeight: "600" },
      h2: { fontSize: "1.375rem", lineHeight: "1.35", fontWeight: "600" },
      h3: { fontSize: "1rem", lineHeight: "1.4", fontWeight: "600" },
    },
  },
  defaultRadius: "xs",
  radius: {
    xs: "2px",
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "10px",
  },
  spacing: {
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  cursorType: "pointer",
  focusRing: "auto",
  fontSizes: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "18px",
    xl: "20px",
  },
  components: {
    Button: {
      defaultProps: { fw: 600, radius: "sm" },
    },
    NumberInput: {
      defaultProps: { size: "md" },
    },
    Select: {
      defaultProps: { size: "md" },
    },
    TextInput: {
      defaultProps: { size: "md" },
    },
    Accordion: {
      defaultProps: { radius: "xs" },
    },
    Alert: {
      defaultProps: { radius: "xs" },
    },
  },
});

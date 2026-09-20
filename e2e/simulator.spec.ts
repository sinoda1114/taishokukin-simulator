import { expect, test } from "@playwright/test";

test("disclaimer, default calc, three patterns, and share URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "退職金シミュレーター" })).toBeVisible();
  await expect(page.getByText("税務助言ではありません")).toBeVisible();
  await expect(page.getByText("合計税額")).toBeVisible();
  await expect(page.getByText("1,861,869円").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "同時 / 退職金先 / iDeCo先" })).toBeVisible();
  await page.getByRole("button", { name: "共有 URL を作る" }).click();
  await expect(page.getByText("共有 URL:")).toBeVisible();
  const href = await page.locator(".share a").getAttribute("href");
  expect(href).toMatch(/\/s\//);
  await page.goto(href!);
  await expect(page.getByText("1,861,869円").first()).toBeVisible();
});

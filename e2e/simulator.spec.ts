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

test("375px heading and share button stay on screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "退職金シミュレーター" });
  await expect(heading).toBeVisible();
  const headingBox = await heading.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(headingBox!.x).toBeGreaterThanOrEqual(0);
  expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(376);
  const share = page.getByRole("button", { name: "共有 URL を作る" });
  await share.scrollIntoViewIfNeeded();
  await expect(share).toBeVisible();
  const shareBox = await share.boundingBox();
  expect(shareBox).not.toBeNull();
  expect(shareBox!.width).toBeGreaterThan(80);
  expect(shareBox!.x + shareBox!.width).toBeLessThanOrEqual(376);
});

test("375px visible text is at least 11px and skip link reaches results", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const skip = page.getByRole("link", { name: "結果を見る" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(page.locator("#results")).toBeInViewport();

  const tooSmall = await page.evaluate(() => {
    const bad: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const el = node as HTMLElement;
      const style = getComputedStyle(el);
      node = walker.nextNode();
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      const hasOwnText = [...el.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      if (!hasOwnText) continue;
      const size = parseFloat(style.fontSize);
      if (Number.isFinite(size) && size < 11) {
        bad.push(`${el.tagName.toLowerCase()}:${size}px:${el.textContent?.trim().slice(0, 24)}`);
      }
    }
    return bad;
  });
  expect(tooSmall).toEqual([]);
});

test("privacy and missing share have no results jump", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: "結果を見る" })).toHaveCount(0);
  await page.goto("/s/does-not-exist");
  await expect(page.getByRole("link", { name: "結果を見る" })).toHaveCount(0);
});

test("375px DC benefit header stays in the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const kind = page.getByRole("textbox", { name: "手当 2" });
  await kind.scrollIntoViewIfNeeded();
  const kindBox = await kind.boundingBox();
  expect(kindBox).not.toBeNull();
  expect(kindBox!.x).toBeGreaterThanOrEqual(0);
  expect(kindBox!.x + kindBox!.width).toBeLessThanOrEqual(376);
  const remove = page.getByRole("button", { name: "手当 2 を削除" });
  await expect(remove).toBeVisible();
  const removeBox = await remove.boundingBox();
  expect(removeBox).not.toBeNull();
  expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(376);
});

test("primary controls keep a visible focus ring", async ({ page }) => {
  await page.goto("/");
  const share = page.getByRole("button", { name: "共有 URL を作る" });
  await share.focus();
  const ring = await share.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  const hasOutline = ring.outlineStyle !== "none" && ring.outlineWidth !== "0px";
  const hasShadow = ring.boxShadow !== "none";
  expect(hasOutline || hasShadow).toBeTruthy();
});

import { expect, test, type Page } from "@playwright/test";

async function startFromInputs(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "入力欄から始める" }).click();
  await expect(page.getByRole("heading", { name: "入力" })).toBeVisible();
}

async function completeSampleHearing(page: Page) {
  await expect(page.getByRole("heading", { name: "生年と生月はいつですか" })).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(
    page.getByRole("heading", { name: "会社の退職金は、いくらで、何年勤めて、何歳で受けますか" }),
  ).toBeVisible();
  await expect(page.getByText("受取年は 2030年です")).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "iDeCo か企業型 DC の一時金はありますか" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ある", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "その額、拠出年数、受取年齢は" })).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "ほかに退職手当はありますか" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ない", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(
    page.getByRole("heading", { name: "同時に受け取る場合と、順を変える場合、どちらを見ますか" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "先後の比較", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "結果を見る" }).click();
}

test("disclaimer, default calc, three patterns, and share URL", async ({ page }) => {
  await startFromInputs(page);
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
  await expect(page.getByRole("heading", { name: "入力" })).toBeVisible();
  await expect(page.getByRole("button", { name: "入力欄から始める" })).toHaveCount(0);
});

test("hearing is first and skip keeps the open-moment tax", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "生年と生月はいつですか" })).toBeVisible();
  await expect(page.getByText("合計税額")).toHaveCount(0);
  await page.getByRole("button", { name: "入力欄から始める" }).click();
  await expect(page.getByText("1,861,869円").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "ヒアリングに戻る" })).toBeVisible();
});

test("hearing answers land on the current results screen", async ({ page }) => {
  await page.goto("/");
  await completeSampleHearing(page);
  await expect(page.getByText("合計税額")).toBeVisible();
  await expect(page.getByText("1,861,869円").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "同時 / 退職金先 / iDeCo先" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "生年", exact: true })).toHaveValue("1965");
  await expect(page.getByLabel("見込み受取額（円）").first()).toHaveValue("20,000,000");
  await expect(page.getByRole("button", { name: "共有 URL を作る" })).toBeVisible();
  await page.getByRole("button", { name: "ヒアリングに戻る" }).click();
  await expect(page.getByRole("heading", { name: "生年と生月はいつですか" })).toBeVisible();
});

test("375px heading and share button stay on screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startFromInputs(page);
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
  await startFromInputs(page);
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

test("375px hearing question stays in the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "生年と生月はいつですか" });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(376);
  const skip = page.getByRole("button", { name: "入力欄から始める" });
  await skip.scrollIntoViewIfNeeded();
  const skipBox = await skip.boundingBox();
  expect(skipBox).not.toBeNull();
  expect(skipBox!.x + skipBox!.width).toBeLessThanOrEqual(376);
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
  await startFromInputs(page);
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
  await startFromInputs(page);
  const share = page.getByRole("button", { name: "共有 URL を作る" });
  await share.evaluate((el) => {
    (el as HTMLElement).focus({ focusVisible: true } as FocusOptions);
  });
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

test("hearing keeps text and picker, and blocks empty age", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("textbox", { name: "勤続年数", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "勤続年数の選択" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "受取年齢", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "受取年齢の選択" })).toBeVisible();
  await page.getByRole("textbox", { name: "受取年齢", exact: true }).fill("");
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByText("受取年齢を入れてください")).toBeVisible();
  await expect(page.getByRole("heading", { name: "iDeCo か企業型 DC の一時金はありますか" })).toHaveCount(0);
});

test("skip shows pattern bars and a search line", async ({ page }) => {
  await startFromInputs(page);
  await expect(page.getByRole("img", { name: "3パターンの税額比較" })).toBeVisible();
  await expect(page.locator(".bar-fill.is-best")).toHaveCount(1);
  await expect(page.getByRole("img", { name: /税額の折れ線/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "探索の表" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "受取年" })).toHaveCount(0);
});

test("375px bars and search line stay on screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startFromInputs(page);
  const bars = page.getByRole("img", { name: "3パターンの税額比較" });
  await bars.scrollIntoViewIfNeeded();
  const barBox = await bars.boundingBox();
  expect(barBox).not.toBeNull();
  expect(barBox!.x).toBeGreaterThanOrEqual(0);
  expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(376);
  const fillBox = await page.locator(".bar-fill.is-best").boundingBox();
  expect(fillBox).not.toBeNull();
  expect(fillBox!.width).toBeGreaterThan(24);
  expect(fillBox!.height).toBeGreaterThanOrEqual(12);
  const line = page.getByRole("img", { name: /税額の折れ線/ });
  await line.scrollIntoViewIfNeeded();
  const lineBox = await line.boundingBox();
  expect(lineBox).not.toBeNull();
  expect(lineBox!.x).toBeGreaterThanOrEqual(0);
  expect(lineBox!.x + lineBox!.width).toBeLessThanOrEqual(376);
  expect(lineBox!.height).toBeGreaterThan(80);
});

test("375px year picker stays in the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const picker = page.getByRole("textbox", { name: "生年の選択" });
  await picker.click();
  await picker.fill("1965");
  const option = page.getByRole("option", { name: "1965年" });
  await expect(option).toBeVisible();
  const box = await option.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(376);
});


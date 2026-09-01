import { expect, test } from "@playwright/test";

async function openLobby(page) {
  await page.goto("/?lang=ko&dev=0");
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible({ timeout: 7_000 });
}

for (const side of ["red", "blue"]) {
  test(`PvE ${side} side starts with the selected fortress at the bottom`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openLobby(page);
    await page.locator('[data-start-mode="pve"]').click();
    await expect(page.locator("#pveSideModal")).toBeVisible();
    await expect(page.locator("#pveRankList button")).toHaveText([
      "삼류 고수",
      "이류 고수",
      "일류 고수",
      "절정 고수",
      "초절정 고수",
    ]);
    await page.locator(`[data-pve-side="${side}"]`).click();

    await expect(page.locator("#pveSideModal")).toBeHidden();
    await expect(page.locator("#modeModal")).toBeHidden();
    if (side === "red") {
      await expect(page.locator(".fortress-frame")).toHaveClass(/view-red/);
    } else {
      await expect(page.locator(".fortress-frame")).not.toHaveClass(/view-red/);
    }

    const wallTops = await page.evaluate(() => ({
      red: document.querySelector(".red-wall").getBoundingClientRect().top,
      blue: document.querySelector(".blue-wall").getBoundingClientRect().top,
    }));
    expect(wallTops[side]).toBeGreaterThan(wallTops[side === "red" ? "blue" : "red"]);
    expect(pageErrors).toEqual([]);
  });
}

test("PvE result can start another match", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?lang=ko&dev=0&demo=match-result");
  await expect(page.locator("#resultModal")).toBeHidden();
  await expect(page.locator("#tutorialPanel")).toBeVisible();
  await expect(page.locator("#matchResultOutcome")).toHaveText("흑 승리");
  await expect(page.locator("#matchResultScore")).toHaveText("대국 종료: 흑 2 - 백 1");
  await expect(page.locator("#matchResultSummary")).toBeVisible();
  await expect(page.locator("#matchResultActions")).toBeVisible();
  const capturedKingCell = page.locator('.cell[data-row="5"][data-col="4"]');
  await expect(capturedKingCell.locator(".piece.blue.king")).toBeVisible();
  await expect(capturedKingCell.locator('.piece[title*="왕"]')).toBeVisible();
  const announcementBox = await page.locator("#tutorialPanel").boundingBox();
  const summaryBox = await page.locator("#matchResultSummary").boundingBox();
  const scoreBox = await page.locator("#matchResultScore").boundingBox();
  const stoneBox = await page.locator(".match-result-stone").boundingBox();
  const actionsBox = await page.locator("#matchResultActions").boundingBox();
  expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(announcementBox.y + announcementBox.height);
  expect(Math.abs((scoreBox.x + scoreBox.width / 2) - (stoneBox.x + stoneBox.width / 2))).toBeLessThanOrEqual(1);
  expect(stoneBox.width).toBeGreaterThanOrEqual(40);
  expect(actionsBox.x).toBeGreaterThan(summaryBox.x + summaryBox.width);
  expect(actionsBox.y).toBeGreaterThanOrEqual(announcementBox.y);
  expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(announcementBox.y + announcementBox.height);
  await expect(page.locator("#matchDetailsBtn")).toBeVisible();
  await expect(page.locator("#playAgainBtn")).toBeVisible();
  const actionBoxes = await Promise.all([
    page.locator("#matchDetailsBtn").boundingBox(),
    page.locator("#playAgainBtn").boundingBox(),
  ]);
  expect(actionBoxes[0].y).toBeLessThan(actionBoxes[1].y);
  expect(actionBoxes[0].height).toBeGreaterThanOrEqual(32);
  expect(actionBoxes[1].height).toBeGreaterThanOrEqual(32);

  await page.locator("#matchDetailsBtn").click();
  await expect(page.locator("#resultModal")).toBeVisible();
  await expect(page.locator("#resultHeading")).toHaveText("경기 결과");
  await expect(page.locator("#matchResultMeta")).toHaveText("AI 대전 · 삼류 고수 · 백");
  await expect(page.locator("#resultRedUnits")).toHaveText("2");
  await expect(page.locator("#resultBlueUnits")).toHaveText("1");
  await expect(page.locator("#resultFinishMethod")).toHaveText("백 왕이 포획되었습니다.");
  await expect(page.locator("#resultTotalDeployments")).toHaveText("38수");
  await expect(page.locator("#resultRedCaptures")).toHaveText("7");
  await expect(page.locator("#resultBlueCaptures")).toHaveText("4");
  await expect(page.locator("#resultRedSpecials")).toHaveText("2");
  await expect(page.locator("#resultBlueSpecials")).toHaveText("1");
  await expect(page.locator(".captures-score-note")).toHaveText("포획 수는 대국 기록이며 승패 점수에 포함되지 않습니다.");
  const detailCardBox = await page.locator(".match-result-card").boundingBox();
  const viewport = page.viewportSize();
  expect(detailCardBox.y).toBeGreaterThanOrEqual(0);
  expect(detailCardBox.y + detailCardBox.height).toBeLessThanOrEqual(viewport.height);

  await page.locator("#closeMatchDetailsBtn").click();
  await expect(page.locator("#resultModal")).toBeHidden();
  await expect(page.locator("#tutorialPanel")).toBeVisible();
  await page.locator("#playAgainBtn").click();

  await expect(page.locator("#resultModal")).toBeHidden();
  await expect(page.locator("#modeModal")).toBeHidden();
  await expect(page.locator("#board [role='gridcell']")).toHaveCount(81);
  expect(pageErrors).toEqual([]);
});

test("PvE result can return to the lobby", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?lang=ko&dev=0&demo=match-result");
  await expect(page.locator("#matchResultScore")).toHaveText("대국 종료: 흑 2 - 백 1");
  await expect(page.locator("#resultModal")).toBeHidden();
  await page.locator("#newGameBtn").click();

  await expect(page.locator("#resultModal")).toBeHidden();
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

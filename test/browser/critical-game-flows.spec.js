import { expect, test } from "@playwright/test";

async function openLobby(page) {
  await page.goto("/?lang=ko&dev=0");
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible({ timeout: 7_000 });
}

test("PvE setup persists timer and audio choices through the real controls", async ({ page }) => {
  await openLobby(page);
  await page.locator('[data-start-mode="pve"]').click();

  const ranks = page.locator("#pveRankList");
  const timer = page.locator(".pve-timer-actions");
  const sides = page.locator("#pveRpsPicker");
  const [rankBox, timerBox, sideBox] = await Promise.all([
    ranks.boundingBox(),
    timer.boundingBox(),
    sides.boundingBox(),
  ]);
  expect(rankBox.y + rankBox.height).toBeLessThanOrEqual(timerBox.y);
  expect(timerBox.y + timerBox.height).toBeLessThanOrEqual(sideBox.y);
  const fullyVisibleRanks = await ranks.locator("button").evaluateAll((buttons) => {
    const viewport = buttons[0].parentElement.getBoundingClientRect();
    return buttons.filter((button) => {
      const box = button.getBoundingClientRect();
      return box.top >= viewport.top && box.bottom <= viewport.bottom + 0.5;
    }).length;
  });
  expect(fullyVisibleRanks).toBe(3);
  const rankFrame = page.locator(".ai-rank-frame");
  await expect(rankFrame).toHaveClass(/can-scroll-down/);
  await expect(rankFrame).not.toHaveClass(/can-scroll-up/);
  await ranks.locator("button").last().click();
  await expect(rankFrame).toHaveClass(/can-scroll-up/);
  await expect(rankFrame).not.toHaveClass(/can-scroll-down/);

  await page.locator('[data-pve-timer="off"]').click();
  await expect(page.locator('[data-pve-timer="off"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("daeguk-pve-timer"))).toBe("disabled");

  await page.locator("#cancelPveSideBtn").click();
  await page.locator("#lobbySettingsBtn").click();
  await page.locator("#musicToggle").uncheck();
  await page.locator("#sfxToggle").uncheck();
  expect(await page.evaluate(() => ({
    music: localStorage.getItem("unknown-kingdom-music"),
    sfx: localStorage.getItem("unknown-kingdom-sfx"),
  }))).toEqual({ music: "disabled", sfx: "disabled" });
});

test("FX preview is available only in developer mode", async ({ page }) => {
  await page.goto("/?lang=ko&dev=0");
  await expect(page.locator("#fxPreviewBar")).toBeHidden();
  await page.goto("/?lang=ko&dev=1");
  await expect(page.locator("#fxPreviewBar")).toBeVisible();
});

test("Online lobby shows connection status without an unrelated challenge rank", async ({ page }) => {
  await openLobby(page);
  await page.locator('[data-start-mode="pvp"]').click();

  await expect(page.locator("#networkModal")).toBeVisible();
  await expect(page.locator("#connectionInfo")).toBeVisible();
  await expect(page.locator("#rankInfo")).toBeHidden();
  await expect(page.locator("#networkStatus")).toContainText(/서버|대국판|연결/);
});

for (const side of ["black", "white"]) {
  test(`PvE ${side} side starts with the selected fortress at the bottom`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const rps = side === "black"
      ? { random: 0, choice: "rock", result: "가위바위보 승리" }
      : { random: 0.4, choice: "scissors", result: "가위바위보 패배" };
    await page.addInitScript((random) => {
      Math.random = () => random;
    }, rps.random);
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
    await page.locator(`[data-pve-rps="${rps.choice}"]`).click();
    await expect(page.locator("#pveRpsStatus")).toContainText(rps.result);

    await expect(page.locator("#pveSideModal")).toBeHidden();
    await expect(page.locator("#modeModal")).toBeHidden();
    if (side === "black") {
      await expect(page.locator(".fortress-frame")).toHaveClass(/view-black/);
    } else {
      await expect(page.locator(".fortress-frame")).not.toHaveClass(/view-black/);
    }

    const wallTops = await page.evaluate(() => ({
      black: document.querySelector(".black-wall").getBoundingClientRect().top,
      white: document.querySelector(".white-wall").getBoundingClientRect().top,
    }));
    expect(wallTops[side]).toBeGreaterThan(wallTops[side === "black" ? "white" : "black"]);
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
  await expect(page.locator("#matchResultHeadline")).toHaveText("대국 종료");
  await expect(page.locator("#matchResultReason")).toHaveText("백 왕이 포획되었습니다.");
  await expect(page.locator("#matchResultSummary")).toBeVisible();
  await expect(page.locator("#matchResultActions")).toBeVisible();
  const capturedKingCell = page.locator('.cell[data-row="5"][data-col="4"]');
  await expect(capturedKingCell.locator(".piece.white.king")).toBeVisible();
  await expect(capturedKingCell.locator('.piece[title*="왕"]')).toBeVisible();
  const announcementBox = await page.locator("#tutorialPanel").boundingBox();
  const summaryBox = await page.locator("#matchResultSummary").boundingBox();
  const verdictBox = await page.locator(".match-result-verdict").boundingBox();
  const headlineBox = await page.locator("#matchResultHeadline").boundingBox();
  const reasonBox = await page.locator("#matchResultReason").boundingBox();
  const stoneBox = await page.locator(".match-result-stone").boundingBox();
  const identityBox = await page.locator(".match-result-identity").boundingBox();
  const actionsBox = await page.locator("#matchResultActions").boundingBox();
  expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(announcementBox.y + announcementBox.height);
  expect(Math.abs((stoneBox.x + stoneBox.width / 2) - (identityBox.x + identityBox.width / 2))).toBeLessThanOrEqual(1);
  expect(identityBox.x + identityBox.width).toBeLessThanOrEqual(verdictBox.x);
  expect(verdictBox.x + verdictBox.width).toBeLessThanOrEqual(summaryBox.x + summaryBox.width + 1);
  expect(stoneBox.width).toBeGreaterThanOrEqual(40);
  expect(headlineBox.y + headlineBox.height).toBeLessThanOrEqual(reasonBox.y);
  const [outcomeFontSize, headlineFontSize, reasonFontSize] = await page.evaluate(() => [
    parseFloat(getComputedStyle(document.querySelector("#matchResultOutcome")).fontSize),
    parseFloat(getComputedStyle(document.querySelector("#matchResultHeadline")).fontSize),
    parseFloat(getComputedStyle(document.querySelector("#matchResultReason")).fontSize),
  ]);
  expect(headlineFontSize).toBeGreaterThan(outcomeFontSize);
  expect(reasonFontSize).toBeLessThan(headlineFontSize);
  expect(identityBox.width).toBeCloseTo(actionsBox.width, 0);
  expect(identityBox.height).toBeCloseTo(actionsBox.height, 0);
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
  await expect(page.locator("#resultTotalDeployments")).toHaveText("38수");
  await expect(page.locator("#resultFinishMethod")).toHaveText("백 왕이 포획되었습니다.");
  await expect(page.locator("#resultBlackUnits")).toHaveText("2");
  await expect(page.locator("#resultWhiteUnits")).toHaveText("1");
  await expect(page.locator("#resultBlackCaptures")).toHaveText("7");
  await expect(page.locator("#resultWhiteCaptures")).toHaveText("4");
  const factRows = await page.locator(".match-result-facts dt").allTextContents();
  expect(factRows).toEqual(["총 배치 수", "종료 방식"]);
  const deploymentsBox = await page.locator("#resultTotalDeployments").boundingBox();
  const unitsBox = await page.locator(".result-units-grid").boundingBox();
  const capturesBox = await page.locator(".result-record-grid").boundingBox();
  expect(deploymentsBox.y).toBeLessThan(unitsBox.y);
  expect(unitsBox.y + unitsBox.height).toBeLessThanOrEqual(capturesBox.y);
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
  await expect(page.locator("#matchResultHeadline")).toHaveText("대국 종료");
  await expect(page.locator("#matchResultReason")).toHaveText("백 왕이 포획되었습니다.");
  await expect(page.locator("#resultModal")).toBeHidden();
  await page.locator("#newGameBtn").click();

  await expect(page.locator("#resultModal")).toBeHidden();
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("a surrounded special activates on its own with no confirmation card", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?lang=ko&dev=0&demo=special-pending");
  await expect(page.locator(".result-modal:visible")).toHaveCount(0);
  await expect(page.locator('.cell[data-row="4"][data-col="4"] .piece')).toBeVisible();
  await expect(page.locator('.cell[data-row="3"][data-col="4"] .piece')).toBeVisible();

  // No card to press: the cut-in is the announcement and the ability resolves.
  await expect(page.locator(".taunt-overlay.cutscene-general")).toBeVisible();
  await expect(page.locator(".result-modal:visible")).toHaveCount(0);
  await expect(page.locator('.cell[data-row="3"][data-col="4"] .piece')).toHaveCount(0);
  await expect(page.locator('.cell[data-row="5"][data-col="4"] .piece')).toHaveCount(0);
  await expect(page.locator('.cell[data-row="4"][data-col="3"] .piece')).toHaveCount(0);
  await expect(page.locator('.cell[data-row="4"][data-col="5"] .piece')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("the AI's surrounded special activates on the same timer", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?lang=ko&dev=0&demo=special-pending&owner=ai");
  await expect(page.locator(".result-modal:visible")).toHaveCount(0);
  await expect(page.locator(".taunt-overlay.cutscene-general")).toBeVisible();
  await expect(page.locator('.cell[data-row="3"][data-col="4"] .piece')).toHaveCount(0);
  await expect(page.locator('.cell[data-row="4"][data-col="3"] .piece')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

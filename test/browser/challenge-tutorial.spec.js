import { expect, test } from "@playwright/test";

async function startTutorial(page) {
  await page.goto("/?lang=ko&preview=iphone&dev=1");
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible({ timeout: 7_000 });
  await page.getByRole("button", { name: "튜토리얼", exact: true }).click();

  await expect(page.locator("#challengeModal")).toBeHidden();
  await expect(page.locator("#modeInfo")).toHaveText("튜토리얼");
  await expect(page.locator("#rankInfo")).toHaveText("튜토리얼");
  await expect(page.locator("#tutorialPanel")).toBeVisible();

  const nextDialogueBtn = page.locator(".dialogue-arrow-btn.down");
  while (await nextDialogueBtn.isVisible()) {
    await nextDialogueBtn.click();
    await page.waitForTimeout(100);
  }
  const startBtn = page.locator("#startTutorialBtn");
  await expect(startBtn).toBeVisible({ timeout: 5_000 });
  await startBtn.click();
}

async function placeAndContinue(page, coordinate) {
  await page.getByRole("gridcell", { name: coordinate, exact: true }).click();
  const next = page.getByRole("button", { name: "다음", exact: true });
  await expect(next).toBeVisible();
  await next.click();
}

async function completeSpecialLesson(page, unitName) {
  await expect(page.getByRole("radio", { name: new RegExp(`^${unitName}`) })).toBeChecked();
  await page.getByRole("gridcell", { name: "E5", exact: true }).click();
  const next = page.getByRole("button", { name: "다음", exact: true });
  await expect(next).toBeVisible({ timeout: 5_000 });
  await next.click();
}

test("Lobby tutorial opens directly and completes all browser-owned steps", async ({ page }) => {
  await startTutorial(page);

  await placeAndContinue(page, "E8");
  await placeAndContinue(page, "F5");
  await placeAndContinue(page, "D9");
  await placeAndContinue(page, "H9");
  await completeSpecialLesson(page, "장군");
  await completeSpecialLesson(page, "외교관");

  await expect(page.getByRole("radio", { name: /^마법사/ })).toBeChecked();
  await page.getByRole("gridcell", { name: "E5", exact: true }).click();
  await expect(page.getByText(/마법사.*이동|이동할 빈칸/)).toBeVisible({ timeout: 5_000 });
  await page.getByRole("gridcell", { name: "A1", exact: true }).click();
  const next = page.getByRole("button", { name: "다음", exact: true });
  await expect(next).toBeVisible();
  await next.click();

  await expect(page.locator("#tutorialPanel")).not.toHaveClass(/challenge-result/);
  await expect(page.locator("#tutorialMessage")).toContainText("튜토리얼 완료");
});

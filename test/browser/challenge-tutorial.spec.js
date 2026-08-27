import { expect, test } from "@playwright/test";

const PROGRESS_KEY = "daeguk-challenge-progress-v1";

async function startTutorial(page) {
  await page.goto("/?lang=ko&preview=iphone&dev=1");
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible({ timeout: 7_000 });
  await page.getByRole("button", { name: "챌린지", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "챌린지" })).toBeVisible();

  const tutorialRank = page.locator(".challenge-rank-button").filter({ hasText: "튜토리얼" });
  await expect(tutorialRank).toBeEnabled();
  await tutorialRank.click();

  await expect(page.locator("#modeInfo")).toHaveText("챌린지");
  await expect(page.locator("#rankInfo")).toHaveText("튜토리얼");
  await expect(page.locator("#tutorialPanel")).toBeVisible();
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

test("Challenge tutorial completes all browser-owned steps and persists progression", async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem("daeguk-e2e-progress-reset")) return;
    localStorage.removeItem(key);
    sessionStorage.setItem("daeguk-e2e-progress-reset", "true");
  }, PROGRESS_KEY);
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

  await expect(page.locator("#tutorialPanel")).toHaveClass(/challenge-result/);
  await expect(page.locator("#tutorialPanel")).toHaveClass(/complete/);
  await expect(page.locator("#tutorialMessage")).toHaveText("챌린지 완료");
  await expect.poll(async () => page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    return saved.completedPuzzleIds || [];
  }, PROGRESS_KEY)).toContain("basic-tutorial-01");

  await page.reload();
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible({ timeout: 7_000 });
  await page.getByRole("button", { name: "챌린지", exact: true }).click();
  const completedTutorial = page.getByRole("button", { name: "튜토리얼 완료", exact: true });
  await expect(completedTutorial).toBeVisible();
  await expect(completedTutorial).toHaveClass(/complete/);
});

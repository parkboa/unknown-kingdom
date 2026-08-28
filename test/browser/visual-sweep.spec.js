import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PROGRESS_KEY = "daeguk-challenge-progress-v1";
const OUTPUT_DIR = path.resolve("test-results/visual-sweep");
const LANGUAGES = ["ko", "en"];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

async function waitForLobby(page) {
  await expect(page.locator("#modeModal")).toBeVisible({ timeout: 7_000 });
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
}

async function assertLocalizedLockLabel(page, language) {
  const expected = language === "ko" ? "잠김" : "Locked";
  await expect(page.locator(".unit-picker .lock-icon").first()).toHaveAttribute("aria-label", expected);
}

async function openChallenge(page) {
  await page.locator('[data-start-mode="puzzle"]').click();
  await expect(page.locator("#challengeModal")).toBeVisible();
}

async function startTutorial(page) {
  await openChallenge(page);
  const tutorialRank = page.locator(".challenge-rank-button").first();
  await expect(tutorialRank).toBeEnabled();
  await tutorialRank.click();
  await expect(page.locator("#tutorialPanel")).toBeVisible();
}

async function assertNoHorizontalOverflow(page, scene) {
  const failures = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const rootOverflow = document.documentElement.scrollWidth - viewportWidth;
    const selectors = [
      ".result-card",
      ".game-area",
      ".game-status-bar",
      "#tutorialPanel",
      ".fortress-frame",
      ".deploy-dock",
      ".game-action-bar",
    ];
    const elementFailures = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return `${selector} (${Math.round(rect.left)}..${Math.round(rect.right)} / ${viewportWidth})`;
      }));
    return [
      ...(rootOverflow > 1 ? [`document (+${rootOverflow}px)`] : []),
      ...elementFailures,
    ];
  });
  expect(failures, `${scene} has horizontal overflow`).toEqual([]);
}

async function assertVisibleCopyFits(page, scene) {
  const failures = await page.evaluate(() => {
    const selectors = [
      "#tutorialMessage",
      ".lobby-mode-actions strong",
      ".challenge-rank-button strong",
      ".difficulty-choice-actions button",
      ".settings-row > span",
      ".settings-toggle > span",
    ];
    return selectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .filter((element) => element.scrollWidth > element.clientWidth + 1
        || element.scrollHeight > element.clientHeight + 1)
      .map((element) => `${selector}: ${element.textContent.trim()}`));
  });
  expect(failures, `${scene} has clipped visible copy`).toEqual([]);
}

async function capture(page, testInfo, language, viewport, scene) {
  await assertNoHorizontalOverflow(page, scene);
  await assertVisibleCopyFits(page, scene);
  const fileName = `${viewport.name}-${language}-${scene}.png`;
  const screenshotPath = path.join(OUTPUT_DIR, fileName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(fileName, { path: screenshotPath, contentType: "image/png" });
}

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

for (const viewport of VIEWPORTS) {
  for (const language of LANGUAGES) {
    test(`${viewport.name} ${language} UI sweep`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript((key) => localStorage.removeItem(key), PROGRESS_KEY);
      await page.goto(`/?lang=${language}&dev=1`);
      await waitForLobby(page);
      await assertLocalizedLockLabel(page, language);
      await capture(page, testInfo, language, viewport, "lobby");

      await page.locator('[data-start-mode="pve"]').click();
      await expect(page.locator("#pveSideModal")).toBeVisible();
      await capture(page, testInfo, language, viewport, "ai-setup");
      await page.locator("#cancelPveSideBtn").click();

      await page.locator("#lobbySettingsBtn").click();
      await expect(page.locator("#settingsModal")).toBeVisible();
      await capture(page, testInfo, language, viewport, "settings");
      await page.locator("#closeSettingsBtn").click();

      await openChallenge(page);
      await capture(page, testInfo, language, viewport, "challenge");

      await page.locator("#closeChallengeBtn").click();
      await startTutorial(page);
      await capture(page, testInfo, language, viewport, "tutorial-start");

      await page.getByRole("gridcell", { name: "E8", exact: true }).click();
      await expect(page.locator("#nextTutorialBtn")).toBeVisible();
      await capture(page, testInfo, language, viewport, "tutorial-sanctuary");
    });
  }
}

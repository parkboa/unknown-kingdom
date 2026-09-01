import { expect, test } from "@playwright/test";

async function startTutorial(page) {
  await page.goto("/?lang=ko&preview=iphone&dev=0");
  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible({ timeout: 7_000 });
  await page.getByRole("button", { name: "튜토리얼", exact: true }).click();

  await expect(page.locator("#challengeModal")).toBeHidden();
  await expect(page.locator("#modeInfo")).toHaveText("튜토리얼");
  await expect(page.locator("#rankInfo")).toHaveText("튜토리얼");
  await expect(page.locator("#tutorialPanel")).toBeVisible();
  await expect(page.locator("#tutorialMessage")).toBeEmpty();
  await expect(page.locator("#startTutorialBtn")).toBeHidden();

  const nextDialogueBtn = page.locator(".dialogue-arrow-btn.down");
  const multiLineDialogueTop = (await page.locator(".taunt-dialogue-text").boundingBox())?.y;
  await expect(page.locator(".taunt-overlay.persistent-dialogue")).toHaveCSS("animation-name", "none");
  expect(await page.locator(".taunt-dialogue-box").evaluate((element) => getComputedStyle(element, "::before").display)).toBe("none");
  await expect(nextDialogueBtn.locator("svg")).toHaveCSS("animation-name", "dialogue-arrow-bounce-down");
  while (await nextDialogueBtn.isVisible()) {
    await nextDialogueBtn.click();
    await page.waitForTimeout(100);
  }
  const singleLineDialogueTop = (await page.locator(".taunt-dialogue-text").boundingBox())?.y;
  expect(singleLineDialogueTop).toBe(multiLineDialogueTop);
  const startBtn = page.locator("#startTutorialBtn");
  await expect(startBtn).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".tutorial-actions")).toHaveCSS("justify-content", "flex-end");
  await startBtn.click();
  await expect(page.locator(".taunt-overlay")).toHaveCount(0);
  await expect(page.locator("#tutorialMessage")).toHaveText("먼저 왕을 배치하세요.");
}

async function placeAndContinue(page, coordinate) {
  const cell = page.getByRole("gridcell", { name: coordinate, exact: true });
  await expect(cell).toHaveClass(/valid/);
  await cell.click();
  const next = page.getByRole("button", { name: "다음", exact: true });
  await expect(next).toBeVisible();
  await next.click();
}

async function expectPiece(page, coordinate, owner) {
  await expect(
    page.getByRole("gridcell", { name: coordinate, exact: true }).locator(`.piece.${owner}`),
  ).toHaveCount(1);
}

test("Lobby tutorial opens directly and completes all browser-owned steps", async ({ page }) => {
  await startTutorial(page);

  const singleLineMessageTop = (await page.locator("#tutorialMessage").boundingBox())?.y;
  const kingCell = page.getByRole("gridcell", { name: "E8", exact: true });
  await expect(kingCell).toHaveClass(/valid/);
  await kingCell.click();
  const sanctuaryNext = page.getByRole("button", { name: "다음", exact: true });
  await expect(sanctuaryNext).toBeVisible();
  await expect(page.locator("#tutorialMessage")).toHaveText("왕이 배치되면 왕을 둘러싼 성역이 나타납니다. 왕과 주변 8칸이 성역입니다.");
  const multiLineMessageTop = (await page.locator("#tutorialMessage").boundingBox())?.y;
  expect(multiLineMessageTop).toBe(singleLineMessageTop);
  await expect(page.locator(".piece.black")).toHaveCount(1);
  await expect(page.locator(".piece.white")).toHaveCount(1);
  await expect(page.locator(".black-king-zone-cell")).toHaveCount(9);
  await expect(page.locator(".white-king-zone-cell")).toHaveCount(9);
  await sanctuaryNext.click();

  await expect(page.locator("#tutorialMessage")).toHaveText("자신이 돌을 네 개 더 놓을 때까지 상대는 성역 안에 배치할 수 없습니다.");
  await expect(page.locator(".tutorial-actions")).toHaveCSS("height", "32px");
  await expect(page.locator(".tutorial-actions")).toHaveCSS("min-height", "32px");
  await expect(sanctuaryNext).toBeVisible();
  await expect(page.locator(".piece.black")).toHaveCount(5);
  await expect(page.locator(".piece.white")).toHaveCount(5);
  await expect(page.locator(".cell.last-move")).toHaveCount(0);
  await expect(page.locator(".king-zone-cell")).toHaveCount(0);
  for (const coordinate of ["E1", "D2", "F2", "E3"]) await expectPiece(page, coordinate, "black");
  for (const coordinate of ["E7", "D8", "F8", "E9"]) await expectPiece(page, coordinate, "white");
  await sanctuaryNext.click();

  const captureCell = page.getByRole("gridcell", { name: "E5", exact: true });
  await expect(captureCell).toHaveClass(/valid/);
  await expectPiece(page, "B1", "black");
  await expectPiece(page, "B9", "black");
  await expectPiece(page, "E6", "black");
  await expectPiece(page, "D6", "white");
  await expectPiece(page, "F6", "white");
  await captureCell.click();
  await expect(sanctuaryNext).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "E6", exact: true }).locator(".piece.black")).toHaveCount(0);
  await expectPiece(page, "E6", "white");
  await sanctuaryNext.click();

  const ownWallCell = page.getByRole("gridcell", { name: "C1", exact: true });
  await expect(ownWallCell).toHaveClass(/valid/);
  await expect(page.locator("#tutorialMessage")).toHaveText("자기 성벽에 닿은 돌은 성벽쪽에 활로 하나를 얻습니다. 표시된 칸에 병사를 놓아보세요.");
  await expectPiece(page, "A1", "white");
  await expectPiece(page, "B1", "black");
  await expectPiece(page, "B2", "white");
  await expectPiece(page, "F5", "black");
  await expectPiece(page, "G6", "black");
  await expectPiece(page, "F7", "black");
  await ownWallCell.click();
  await expect(page.locator("#tutorialMessage")).toHaveText("흑 병사는 흑 성벽에서 활로를 얻어 포획되지 않았습니다.");
  await expectPiece(page, "B1", "black");
  await sanctuaryNext.click();

  const enemyWallCell = page.getByRole("gridcell", { name: "C9", exact: true });
  await expect(enemyWallCell).toHaveClass(/valid/);
  await expect(page.locator("#tutorialMessage")).toHaveText("상대 성벽에 닿은 돌은 어떻게 될까요? 표시된 칸에 병사를 놓아보세요.");
  await expectPiece(page, "A9", "white");
  await expectPiece(page, "B9", "black");
  await expectPiece(page, "B8", "white");
  await expectPiece(page, "D7", "black");
  await expectPiece(page, "F9", "black");
  await expectPiece(page, "G8", "black");
  await enemyWallCell.click();
  await expect(page.locator("#tutorialMessage")).toHaveText("흑 병사는 백의 성벽에 막혀 포획되었습니다.");
  await expect(page.getByRole("gridcell", { name: "B9", exact: true }).locator(".piece.black")).toHaveCount(0);
  await expectPiece(page, "B9", "white");
  await sanctuaryNext.click();

  await expect(page.locator("#tutorialMessage")).toHaveText("특수 유닛을 배워 봅시다. 대국 시작 후 자신의 돌을 다섯 번 놓으면 특수 유닛을 사용할 수 있습니다.");
  await expect(sanctuaryNext).toBeVisible();
  await sanctuaryNext.click();

  await expectPiece(page, "E3", "black");
  await expectPiece(page, "F2", "black");
  await expectPiece(page, "G3", "black");
  await expect(page.getByRole("gridcell", { name: "G3", exact: true })).not.toHaveClass(/latest-move/);
  await expect(page.getByRole("gridcell", { name: "F4", exact: true }).locator(".piece")).toHaveCount(0);
  await expect(page.locator("#tutorialMessage")).toHaveText("특수 유닛은 완전히 포위될 때 능력을 발동합니다. 장군 돌을 선택하고 표시된 칸에 장군을 놓아보세요.");
  const generalOption = page.locator('.unit-picker label[data-unit="general"]');
  const generalCell = page.getByRole("gridcell", { name: "F3", exact: true });
  await expect(generalOption).toHaveClass(/tutorial-target/);
  await expect(generalCell).not.toHaveClass(/valid/);
  await generalOption.click();
  await expect(page.getByRole("radio", { name: /^장군/ })).toBeChecked();
  await expect(page.getByRole("gridcell", { name: "G3", exact: true })).not.toHaveClass(/latest-move/);
  await expect(generalOption).not.toHaveClass(/tutorial-target/);
  await expect(generalCell).toHaveClass(/valid/);
  await generalCell.click();
  await expect(generalCell).toHaveClass(/latest-move/);

  await expectPiece(page, "F4", "black");
  await expect(page.locator(".taunt-overlay.cutscene-general")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".general-slash-emitter")).toBeVisible({ timeout: 5_000 });
  const retiredGeneral = generalCell.locator(".piece.retired-special");
  await expect(retiredGeneral).toHaveCount(1);
  await expect(retiredGeneral.locator(".piece-icon")).toHaveCSS("--piece-icon-image", 'url("./assets/units/general.svg")');
  await expect(page.locator("#tutorialMessage")).toHaveText("장군이 인접한 적을 모두 제거하였습니다.");
  await expect(sanctuaryNext).toBeVisible({ timeout: 5_000 });
  await sanctuaryNext.click();

  await expectPiece(page, "D3", "white");
  await expectPiece(page, "E3", "black");
  await expect(page.locator("#tutorialMessage")).toHaveText("외교관 돌을 선택하고 표시된 칸에 외교관을 놓아보세요.");
  const diplomatOption = page.locator('.unit-picker label[data-unit="diplomat"]');
  const diplomatCell = page.getByRole("gridcell", { name: "D1", exact: true });
  await expect(diplomatOption).toHaveClass(/tutorial-target/);
  await expect(diplomatCell).not.toHaveClass(/valid/);
  await diplomatOption.click();
  await expect(page.getByRole("radio", { name: /^외교관/ })).toBeChecked();
  await expect(diplomatOption).not.toHaveClass(/tutorial-target/);
  await expect(diplomatCell).toHaveClass(/valid/);
  await diplomatCell.click();

  await expectPiece(page, "C2", "black");
  await expect(page.locator(".taunt-overlay.cutscene-diplomat")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".diplomat-gold-coin").first()).toBeVisible({ timeout: 5_000 });
  const retiredDiplomat = diplomatCell.locator(".piece.retired-special");
  await expect(retiredDiplomat).toHaveCount(1);
  await expect(retiredDiplomat.locator(".piece-icon")).toHaveCSS("--piece-icon-image", 'url("./assets/units/diplomat.svg")');
  await expectPiece(page, "E1", "white");
  await expectPiece(page, "D2", "white");
  await expect(page.locator("#tutorialMessage")).toHaveText("외교관이 인접한 적을 모두 아군으로 바꾸었습니다.");
  await expect(sanctuaryNext).toBeVisible({ timeout: 5_000 });
  await sanctuaryNext.click();

  await expectPiece(page, "E4", "white");
  await expectPiece(page, "G4", "black");
  await expect(page.locator("#tutorialMessage")).toHaveText("마법사 돌을 선택하고 표시된 칸에 마법사를 놓아보세요.");
  const wizardOption = page.locator('.unit-picker label[data-unit="wizard"]');
  const wizardCell = page.getByRole("gridcell", { name: "G5", exact: true });
  await expectPiece(page, "F5", "black");
  await expectPiece(page, "G4", "black");
  await expectPiece(page, "G6", "black");
  await expect(page.getByRole("gridcell", { name: "H5", exact: true }).locator(".piece")).toHaveCount(0);
  await expect(wizardOption).toHaveClass(/tutorial-target/);
  await expect(wizardCell).not.toHaveClass(/valid/);
  await wizardOption.click();
  await expect(page.getByRole("radio", { name: /^마법사/ })).toBeChecked();
  await expect(wizardOption).not.toHaveClass(/tutorial-target/);
  await expect(wizardCell).toHaveClass(/valid/);
  const wizardEffectSeen = Promise.all([
    page.locator(".taunt-overlay.cutscene-wizard").waitFor({ state: "attached", timeout: 7_000 }),
    page.locator(".wizard-magic-rune").first().waitFor({ state: "attached", timeout: 8_000 }),
  ]);
  await wizardCell.click();
  await expect(wizardCell.locator(".piece.white.special")).toHaveCount(1);

  await expectPiece(page, "H5", "black");
  await expect(page.locator("#tutorialMessage")).toHaveText("특수 유닛이 완전히 포위되었습니다. 능력을 발동합니다…", { timeout: 3_000 });
  await wizardEffectSeen;
  const retiredWizard = wizardCell.locator(".piece.retired-special");
  await expect(retiredWizard).toHaveCount(1);
  await expect(retiredWizard.locator(".piece-icon")).toHaveCSS("--piece-icon-image", 'url("./assets/units/wizard.svg")');
  await expect(page.locator("#tutorialMessage")).toHaveText("마법사가 인접한 적을 모두 제거하였습니다. 마법사는 능력이 발동한 후, 즉시 1회 순간이동할 수 있습니다. 표시된 빈칸으로 이동하세요.");
  await expect(page.getByRole("gridcell", { name: "H5", exact: true }).locator(".piece.black")).toHaveCount(0);
  const wizardDestination = page.getByRole("gridcell", { name: "F2", exact: true });
  await expect(page.locator(".cell.teleport")).toHaveCount(1);
  await expect(wizardDestination).toHaveClass(/teleport/);
  await expect(wizardDestination).toHaveClass(/valid/);
  await expect(page.locator("#confirmTeleportBtn")).toBeHidden();
  await expect(page.locator("#cancelTeleportBtn")).toBeHidden();
  await wizardDestination.click();
  await expectPiece(page, "F2", "white");
  await expect(page.getByRole("gridcell", { name: "G5", exact: true }).locator(".piece")).toHaveCount(0);
  await expect(page.getByRole("gridcell", { name: "E2", exact: true }).locator(".piece.black.king")).toHaveCount(1);
  await expectPiece(page, "E3", "white");
  await expect(page.locator("#tutorialMessage")).toHaveText("튜토리얼 완료! 흑 왕을 포획하여 승리했습니다. 왕 배치, 포획, 성벽과 세 특수 유닛의 능력을 익혔습니다. 이제 AI 대전에서 삼류 고수에 도전해 보세요.");
  const next = page.getByRole("button", { name: "다음", exact: true });
  const tutorialLobbyBtn = page.getByRole("button", { name: "나가기", exact: true });
  await expect(next).toBeHidden();
  await expect(tutorialLobbyBtn).toBeVisible();
  await expect(tutorialLobbyBtn).toHaveClass(/tutorial-start-button/);
  await expect(tutorialLobbyBtn).toHaveCSS("height", "28px");
  await expect(page.locator(".tutorial-actions")).toHaveCSS("justify-content", "flex-end");
  await tutorialLobbyBtn.click();

  await expect(page.getByRole("dialog", { name: "대국 선택" })).toBeVisible();
  await expect(page.locator("#tutorialPanel")).toBeHidden();
});

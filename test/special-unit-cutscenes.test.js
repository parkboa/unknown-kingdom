import assert from "node:assert/strict";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { CUTSCENE_IMAGES } from "../js/render.js";
import { TEXT } from "../js/config.js";

test("all cutscene image assets exist on disk", () => {
  const units = ["king", "general", "diplomat", "wizard"];
  const sides = ["red", "blue"];

  for (const unit of units) {
    for (const side of sides) {
      const relPath = CUTSCENE_IMAGES[unit]?.[side];
      assert.ok(relPath, `Missing asset mapping for ${unit} (${side})`);
      const absolutePath = path.resolve(relPath.replace(/^\.\//, ""));
      assert.ok(fs.existsSync(absolutePath), `Asset file not found at ${absolutePath}`);
      const stat = fs.statSync(absolutePath);
      assert.ok(stat.size > 0, `Asset file is empty: ${absolutePath}`);
    }
  }
});

test("special character dialogues are configured in en and ko", () => {
  assert.equal(TEXT.ko.generalTauntBubble, "감히 나를 막아");
  assert.equal(TEXT.ko.diplomatTauntBubble, "얼마면 돼");
  assert.equal(TEXT.ko.wizardTauntBubble, "아브라카다브라");
  assert.equal(TEXT.ko.tauntBubble, "쫄");

  assert.equal(TEXT.en.generalTauntBubble, "Out of my way");
  assert.equal(TEXT.en.diplomatTauntBubble, "Name your price");
  assert.equal(TEXT.en.wizardTauntBubble, "Abracadabra");
  assert.equal(TEXT.en.tauntBubble, "Coward");
});

test("app.js handles special_activated event with non-blocking cutscene presentation", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

  // Verify general special_activated invokes triggerGeneralSkillSequence
  assert.match(
    appSource,
    /triggerGeneralSkillSequence\(generalActivation,\s*removedEvents\);/,
    "general special activation must invoke triggerGeneralSkillSequence",
  );

  // Verify showSpecialCutscene function is defined
  assert.match(
    appSource,
    /function showSpecialCutscene\(event\)/,
    "showSpecialCutscene function must be defined",
  );

  // Verify visibleTaunt (blocking) vs visibleCutscene (non-blocking)
  assert.match(
    appSource,
    /if \(state\.winner \|\| visibleTaunt\) return;/,
    "selectCell should block on visibleTaunt (king lock) but not on visibleCutscene",
  );

  // Verify renderContext receives visibleCutscene and activeSkillEffect
  assert.match(
    appSource,
    /visibleCutscene,/,
    "renderContext must receive visibleCutscene",
  );
  assert.match(
    appSource,
    /activeSkillEffect,/,
    "renderContext must receive activeSkillEffect",
  );
});

import assert from "node:assert/strict";
import fs from "node:fs";
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

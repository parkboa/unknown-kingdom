import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseGameJournalJsonl } from "../packages/game-engine/src/index.js";

const sourceDirectoryValue = process.argv[2] || "experiments/is-mcts-loss-replays";
const sourceDirectory = resolve(sourceDirectoryValue);
const outputPath = resolve(process.argv[3] || "experiments/hidden-special-prior.json");
const files = readdirSync(sourceDirectory).filter((filename) => filename.endsWith(".jsonl")).sort();
const specialTypes = ["general", "wizard", "diplomat"];
const counts = Object.fromEntries(specialTypes.map((type) => [type, 0]));
let eligibleDeployments = 0;
let specialDeployments = 0;

for (const filename of files) {
  const { journal } = parseGameJournalJsonl(readFileSync(resolve(sourceDirectory, filename), "utf8"));
  const deployments = { red: 0, blue: 0 };
  for (const entry of journal.actions) {
    if (entry.action.type !== "deploy") continue;
    if (deployments[entry.player] >= 5) {
      eligibleDeployments += 1;
      if (specialTypes.includes(entry.action.unitType)) {
        specialDeployments += 1;
        counts[entry.action.unitType] += 1;
      }
    }
    deployments[entry.player] += 1;
  }
}

// Beta(1,1) and one-count categorical smoothing keep unseen outcomes possible.
const deploymentProbability = (specialDeployments + 1) / (eligibleDeployments + 2);
const typeDenominator = specialDeployments + specialTypes.length;
const typeWeights = Object.fromEntries(specialTypes.map((type) => [
  type,
  (counts[type] + 1) / typeDenominator,
]));
const report = {
  schemaVersion: 1,
  status: files.length >= 20 ? "calibrated" : "provisional_small_sample",
  sourceDirectory: sourceDirectoryValue,
  sourceGames: files.length,
  eligibleDeployments,
  observedSpecialDeployments: specialDeployments,
  observedTypeCounts: counts,
  smoothing: { deployment: "Beta(1,1)", type: "add-one" },
  prior: { specialDeploymentProbability: deploymentProbability, specialTypeWeights: typeWeights },
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

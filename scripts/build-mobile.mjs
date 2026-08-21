import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist-mobile");

const files = ["index.html", "styles.css", "app.js"];
const directories = ["assets", "js", "packages/game-engine/src"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}

for (const directory of directories) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true,
    filter: (source) => !source.endsWith(".DS_Store"),
  });
}

console.log(`Prepared Capacitor web assets in ${output}`);

/* Writes out/sw.js from scripts/sw.template.js: the list of every file in the static export (paths
 * relative to the base path) plus a content hash, so each deploy that changes anything gets a new cache.
 * Runs after `next build` (see package.json). */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SKIP = new Set(["sw.js", ".DS_Store"]);

/** Every file under `dir`, as sorted forward-slash paths relative to it, minus the worker itself. */
export function precacheFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !SKIP.has(e.name))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join("/"))
    .sort();
}

/** Short hash of the files' paths and contents. */
export function buildVersion(dir: string, files: string[]): string {
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update("\0").update(readFileSync(path.join(dir, f)));
  return hash.digest("hex").slice(0, 12);
}

export function renderServiceWorker(template: string, version: string, files: string[]): string {
  return template.replace('"__VERSION__"', JSON.stringify(version)).replace("__FILES__", JSON.stringify(files));
}

function main() {
  const root = path.join(__dirname, "..");
  const out = path.join(root, "out");
  const files = precacheFiles(out);
  const version = buildVersion(out, files);
  const template = readFileSync(path.join(__dirname, "sw.template.js"), "utf8");
  writeFileSync(path.join(out, "sw.js"), renderServiceWorker(template, version, files));
  console.log(`sw.js: ${files.length} files, version ${version}`);
}

if (require.main === module) main();

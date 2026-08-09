import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_ROOT = path.join(ROOT, "src");
const DOCS_COMMANDS = [
  "agents",
  "build",
  "changelog",
  "data",
  "enrich",
  "forge",
  "init",
  "readme",
  "review",
  "scan",
  "text",
  "translate",
];
const FLAT_DOCS_COMMAND = new RegExp(`\\bsenrail (?:${DOCS_COMMANDS.join("|")})(?=[\\s\x60'\"]|$)`);

function javascriptJsonAndMarkdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...javascriptJsonAndMarkdownFiles(target));
    else if (/\.(?:js|json|md)$/.test(entry.name)) files.push(target);
  }
  return files;
}

describe("CLI command references", () => {
  it("keeps documentation command guidance on the registered docs namespace", () => {
    const invalidReferences = javascriptJsonAndMarkdownFiles(SOURCE_ROOT)
      .filter((file) => FLAT_DOCS_COMMAND.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file).split(path.sep).join("/"));

    assert.deepEqual(invalidReferences, []);
  });
});

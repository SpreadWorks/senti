import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OLD_NAME = "sen" + "ti";
const OLD_TITLE_NAME = `S${OLD_NAME.slice(1)}`;
const OLD_CONSTANT_NAME = OLD_NAME.toUpperCase();
const OLD_PRODUCT_PATTERN = new RegExp(
  `(?<![A-Za-z])(?:${OLD_NAME}|${OLD_TITLE_NAME})(?=$|[^a-z]|[A-Z])|(?<![A-Za-z])${OLD_CONSTANT_NAME}(?=$|[^A-Z])`,
);
const SCANNED_PATHS = [
  "src",
  "tests",
  "docs",
  ".codex",
  ".github",
  "README.md",
  "package.json",
  ".gitignore",
  ".gitattributes",
  ".senrail/templates",
  ".senrail/presets",
  "AGENTS.md",
  "CLAUDE.md",
  "CHANGELOG.md",
];
const ALLOWLIST = new Map([
  ["CHANGELOG.md", "historical release record"],
  ["docs/change_log.md", "historical generated change log"],
  ["src/lib/upgrade-migration.js", "explicit one-way legacy migration input"],
  ["src/lib/gitignore.js", "migration-only managed root metadata lines"],
  ["src/lib/gitattributes.js", "migration-only managed root metadata lines"],
  ["src/lib/agent-config-files.js", "normal upgrade replaces legacy managed instruction blocks"],
  ["src/lib/skills.js", "normal upgrade removes retired product skill namespaces"],
  ["src/locale/en/ui.json", "explicit migration CLI input help"],
  ["src/locale/ja/ui.json", "explicit migration CLI input help"],
  ["tests/e2e/upgrade-agent-files.test.js", "legacy managed instruction-block fixture"],
  ["tests/e2e/upgrade-migration.test.js", "legacy migration input fixtures"],
  ["tests/unit/lib/cleanup-obsolete-skills.test.js", "retired product skill cleanup fixture"],
]);
function filesUnder(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  if (fs.statSync(absolutePath).isFile()) return [absolutePath];
  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    files.push(...filesUnder(path.join(relativePath, entry.name)));
  }
  return files;
}

function isTextSource(file) {
  return /\.(?:js|json|md|ya?ml)$/.test(file) || ["README.md", "package.json", ".gitignore", ".gitattributes", "AGENTS.md", "CLAUDE.md"].includes(path.basename(file));
}

function findOldProductHits() {
  const hits = [];
  for (const scanPath of SCANNED_PATHS) {
    for (const file of filesUnder(scanPath)) {
      const relativePath = path.relative(ROOT, file).split(path.sep).join("/");
      if (ALLOWLIST.has(relativePath)) continue;
      if (OLD_PRODUCT_PATTERN.test(relativePath)) hits.push(`${relativePath} (path)`);
      if (!isTextSource(file)) continue;
      const content = fs.readFileSync(file, "utf8");
      if (OLD_PRODUCT_PATTERN.test(content)) hits.push(`${relativePath} (content)`);
    }
  }
  return hits;
}

function containsOldProductName(value) {
  return OLD_PRODUCT_PATTERN.test(value);
}

describe("rename scan", () => {
  it("detects standalone, path, constant, camelCase, and PascalCase legacy identities without word fragments", () => {
    for (const value of [
      OLD_NAME,
      OLD_TITLE_NAME,
      `${OLD_CONSTANT_NAME}_WORK_ROOT`,
      `.${OLD_NAME}/config.json`,
      `${OLD_NAME}Phase`,
      `${OLD_TITLE_NAME}MigrationEvidence`,
    ]) {
      assert.equal(containsOldProductName(value), true, value);
    }
    for (const value of [`${OLD_NAME}nel`, `${OLD_CONSTANT_NAME}NEL`, `es${OLD_NAME}al`]) {
      assert.equal(containsOldProductName(value), false, value);
    }
  });

  it("covers source, generated docs, metadata, and file paths with a precise legacy allowlist", () => {
    assert.deepEqual(findOldProductHits(), []);
  });
});

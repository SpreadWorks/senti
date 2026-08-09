import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OLD_NAME = "sen" + "ti";
const OLD_PRODUCT_PATTERN = new RegExp(`(?<![A-Za-z])${OLD_NAME}(?=\\b|[._/-])`, "i");
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
  "AGENTS.md",
  "CLAUDE.md",
  "CHANGELOG.md",
];
const ALLOWLIST = new Map([
  ["CHANGELOG.md", "historical release record"],
  ["docs/change_log.md", "historical generated change log"],
]);
const MANAGED_FLOW_BLOCK_OPEN = `<!-- {{data("agents.${OLD_NAME}")}} -->`;
const MANAGED_FLOW_BLOCK_CLOSE = "<!-- {{/data}} -->";

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

function removeManagedFlowBlock(relativePath, content) {
  if (relativePath !== "AGENTS.md" && relativePath !== "CLAUDE.md") return content;
  const start = content.indexOf(MANAGED_FLOW_BLOCK_OPEN);
  if (start === -1) return content;
  const end = content.indexOf(MANAGED_FLOW_BLOCK_CLOSE, start);
  if (end === -1) throw new Error(`${relativePath} has an unterminated managed Flow block`);
  return `${content.slice(0, start)}${content.slice(end + MANAGED_FLOW_BLOCK_CLOSE.length)}`;
}

function findOldProductHits() {
  const hits = [];
  for (const scanPath of SCANNED_PATHS) {
    for (const file of filesUnder(scanPath)) {
      const relativePath = path.relative(ROOT, file).split(path.sep).join("/");
      if (ALLOWLIST.has(relativePath)) continue;
      if (OLD_PRODUCT_PATTERN.test(relativePath)) hits.push(`${relativePath} (path)`);
      if (!isTextSource(file)) continue;
      const content = removeManagedFlowBlock(relativePath, fs.readFileSync(file, "utf8"));
      if (OLD_PRODUCT_PATTERN.test(content)) hits.push(`${relativePath} (content)`);
    }
  }
  return hits;
}

describe("rename scan", () => {
  it("covers source, generated docs, metadata, and file paths with a precise legacy allowlist", () => {
    assert.deepEqual(findOldProductHits(), []);
  });
});

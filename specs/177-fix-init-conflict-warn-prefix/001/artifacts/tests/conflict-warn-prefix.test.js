import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const localeFiles = [
  { lang: "ja", path: path.join(repoRoot, "src/locale/ja/messages.json") },
  { lang: "en", path: path.join(repoRoot, "src/locale/en/messages.json") },
];

function loadConflictsExist(localePath) {
  const json = JSON.parse(fs.readFileSync(localePath, "utf8"));
  return json.init.conflictsExist;
}

for (const { lang, path: localePath } of localeFiles) {
  test(`[${lang}] init.conflictsExist does not start with ERROR:`, () => {
    const msg = loadConflictsExist(localePath);
    assert.ok(!msg.startsWith("ERROR:"), `expected no ERROR: prefix, got: ${msg}`);
  });

  test(`[${lang}] init.conflictsExist starts with WARN:`, () => {
    const msg = loadConflictsExist(localePath);
    assert.ok(msg.startsWith("WARN:"), `expected WARN: prefix, got: ${msg}`);
  });
}

test("ja and en conflictsExist share the same prefix token", () => {
  const jaMsg = loadConflictsExist(localeFiles[0].path);
  const enMsg = loadConflictsExist(localeFiles[1].path);
  const prefixOf = (s) => s.split(/\s/, 1)[0];
  assert.equal(prefixOf(jaMsg), prefixOf(enMsg));
});

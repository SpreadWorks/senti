// spec: R3 R35
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

async function makeSource() {
  const { initContainer, container } = await import(path.join(repoRoot, "src/lib/container.js"));
  initContainer();
  const factoryPath = path.join(repoRoot, "src/docs/data/skills.js");
  const factoryMod = await import(factoryPath);
  const Cls = factoryMod.default(container);
  return new Cls();
}

test("R3: SkillsSource.rule returns a Renderable for a known id", async () => {
  const src = await makeSource();
  const result = src.rule({}, [], { id: "no-premature-conclusion" });
  assert.ok(result, "rule() must return a Renderable, got null");
  assert.equal(typeof result.toMarkdown, "function");
  const md = result.toMarkdown();
  assert.ok(md && md.length > 0);
});

test("R3: SkillsSource.rule throws when id is unknown", async () => {
  const src = await makeSource();
  assert.throws(() => src.rule({}, [], { id: "nonexistent-rule-id" }), (err) => {
    assert.match(err.message, /unknown skill rule id/);
    assert.match(err.message, /nonexistent-rule-id/);
    return true;
  });
});

test("R3: SkillsSource.rule throws when id is missing", async () => {
  const src = await makeSource();
  assert.throws(() => src.rule({}, [], {}), (err) => {
    assert.match(err.message, /missing skill rule id/);
    return true;
  });
  assert.throws(() => src.rule({}, [], { id: 123 }), /missing skill rule id/);
});

test("R35: AGENTS.sdd.md does not contain skill-rule directives", () => {
  const targets = [
    path.join(repoRoot, "src/presets/base/templates/ja/AGENTS.sdd.md"),
    path.join(repoRoot, "src/presets/base/templates/en/AGENTS.sdd.md"),
  ];
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    const content = fs.readFileSync(target, "utf8");
    assert.ok(
      !/\{\{data\("base\.skills\.rule"/.test(content),
      `${target} must not contain a base.skills.rule directive`,
    );
  }
});

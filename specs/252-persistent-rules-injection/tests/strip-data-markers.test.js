// spec: R5
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

async function load() {
  return import(path.join(repoRoot, "src/docs/lib/directive-parser.js"));
}

test("R5: stripDataMarkers removes paired markers and preserves the body", async () => {
  const { stripDataMarkers } = await load();
  const input = [
    "preamble",
    '<!-- {{data("base.skills.rule", {id: "x"})}} -->',
    "**MUST: do something**",
    "<!-- {{/data}} -->",
    "epilogue",
  ].join("\n");
  const out = stripDataMarkers(input);
  assert.equal(out, ["preamble", "**MUST: do something**", "epilogue"].join("\n"));
});

test("R5: stripDataMarkers is idempotent", async () => {
  const { stripDataMarkers } = await load();
  const input = "preamble\n**MUST: x**\nepilogue";
  assert.equal(stripDataMarkers(stripDataMarkers(input)), input);
});

test("R5: stripDataMarkers throws when an unexpanded data directive remains", async () => {
  const { stripDataMarkers } = await load();
  const input = [
    "preamble",
    '<!-- {{data("base.skills.rule", {id: "x"})}} -->',
    '<!-- {{data("base.skills.rule", {id: "x"})}} -->',
    "<!-- {{/data}} -->",
    "<!-- {{/data}} -->",
    "epilogue",
  ].join("\n");
  assert.throws(() => stripDataMarkers(input), (err) => {
    assert.match(err.message, /unexpanded data directive/);
    assert.match(err.message, /\d+/);
    return true;
  });
});

test("R5: stripDataMarkers preserves include directives", async () => {
  const { stripDataMarkers } = await load();
  const input = [
    "preamble",
    '<!-- include("@templates/partials/x.md") -->',
    "epilogue",
  ].join("\n");
  assert.equal(stripDataMarkers(input), input);
});

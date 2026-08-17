// spec: R4 R23
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

test("R4: parser exposes params on data directive nodes", async () => {
  const mod = await import(path.join(repoRoot, "src/docs/lib/directive-parser.js"));
  const { parseDirectives } = mod;
  const text =
    '<!-- {{data("base.skills.rule", {id: "my-id"})}} -->\n' +
    "expanded content\n" +
    "<!-- {{/data}} -->\n";
  const dirs = parseDirectives(text);
  assert.equal(dirs.length, 1);
  assert.equal(dirs[0].type, "data");
  assert.equal(dirs[0].preset, "base");
  assert.equal(dirs[0].source, "skills");
  assert.equal(dirs[0].method, "rule");
  assert.equal(dirs[0].params?.id, "my-id");
});

test("R4: resolveDataDirectives forwards params to resolveFn", async () => {
  const mod = await import(path.join(repoRoot, "src/docs/lib/directive-parser.js"));
  const { resolveDataDirectives } = mod;
  const text =
    '<!-- {{data("base.skills.rule", {id: "my-id"})}} -->\n' +
    "old content\n" +
    "<!-- {{/data}} -->\n";
  const calls = [];
  resolveDataDirectives(text, (preset, source, method, labels, params) => {
    calls.push({ preset, source, method, labels, params });
    return null;
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params?.id, "my-id");
});

test("R23: resolveDataDirectives forwards only non-parser-owned keys to resolveFn (userParams)", async () => {
  const mod = await import(path.join(repoRoot, "src/docs/lib/directive-parser.js"));
  const { resolveDataDirectives } = mod;
  const text =
    '<!-- {{data("base.foo.bar", {labels: "A|B", ignoreError: true, header: "h", footer: "f", id: "my-id"})}} -->\n' +
    "<!-- {{/data}} -->\n";
  const calls = [];
  resolveDataDirectives(text, (preset, source, method, labels, params) => {
    calls.push({ preset, source, method, labels, params });
    return null;
  });
  assert.equal(calls.length, 1);
  // userParams must contain id but NOT parser-owned controls.
  assert.deepEqual(calls[0].labels, ["A", "B"]);
  assert.equal(calls[0].params?.id, "my-id");
  for (const k of ["labels", "header", "footer", "ignoreError"]) {
    assert.ok(!Object.hasOwn(calls[0].params ?? {}, k), `${k} must NOT be forwarded as user params`);
  }
});

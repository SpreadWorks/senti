/**
 * Spec 188: static source-level checks that verify the migration outcomes
 * required by AC1/AC2/AC3. These tests scan src/ after migration and should
 * report zero offenders once unification is complete.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..", "..", "src");

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith(".js")) yield full;
  }
}

// Files allowed to resolve the shared context directly (CLI entry points).
const ALLOWED_BARE_ROOT = new Set([
  path.join(SRC, "sdd-forge.js"),
  path.join(SRC, "lib", "container.js"),
  path.join(SRC, "lib", "cli.js"),
  path.join(SRC, "lib", "config.js"),
]);

describe("Spec 188: AC1 — no stale bare-pattern re-resolution", () => {
  it("no command implementation under commands/ re-resolves repoRoot() or loadConfig()", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      if (ALLOWED_BARE_ROOT.has(file)) continue;
      if (!file.includes(path.sep + "commands" + path.sep)) continue;
      const src = fs.readFileSync(file, "utf8");
      if (/\brepoRoot\s*\(/.test(src)) offenders.push(`${file}: repoRoot()`);
      if (/\bloadConfig\s*\(/.test(src)) offenders.push(`${file}: loadConfig()`);
    }
    assert.deepEqual(offenders, [], `bare-pattern re-resolution found:\n${offenders.join("\n")}`);
  });

  it("no command file exports a bare main() function", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      if (!file.includes(path.sep + "commands" + path.sep)) continue;
      const src = fs.readFileSync(file, "utf8");
      if (/export\s+async\s+function\s+main\b/.test(src)) offenders.push(file);
      else if (/export\s*\{\s*main\s*\}/.test(src)) offenders.push(file);
    }
    assert.deepEqual(offenders, [], `legacy main() export found:\n${offenders.join("\n")}`);
  });
});

describe("Spec 188: AC2 — dispatchers do not rewrite process.argv", () => {
  it("dispatcher files pass parsed input without mutating process.argv", () => {
    const dispatchers = ["flow.js", "docs.js", "check.js", "metrics.js"]
      .map((f) => path.join(SRC, f));
    const offenders = [];
    for (const file of dispatchers) {
      const src = fs.readFileSync(file, "utf8");
      if (/process\.argv\s*=/.test(src)) offenders.push(file);
    }
    assert.deepEqual(offenders, [], `process.argv rewrite in dispatchers:\n${offenders.join("\n")}`);
  });
});

describe("Spec 188: AC3 — single registry, subtree-level import", () => {
  it("src/lib/command-registry.js exists and exports subtrees", async () => {
    const registryPath = path.join(SRC, "lib", "command-registry.js");
    assert.ok(fs.existsSync(registryPath), "src/lib/command-registry.js must exist after migration");
    const mod = await import(registryPath);
    assert.ok(mod.flowCommands);
    assert.ok(mod.docsCommands);
    assert.ok(mod.checkCommands);
    assert.ok(mod.metricsCommands);
  });
});

/**
 * Spec 189: static checks verifying that the transitional bridging code
 * from spec 188 (legacyMainToCommand adapter + runModuleMain runner) has
 * been fully removed from the source tree.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..", "..", "src");

// Bounded src walk: depth <= MAX_DEPTH, entries <= MAX_ENTRIES. src/ is
// small enough that these bounds are comfortably above real usage; they
// exist to satisfy the repo's Bounded Resource Usage guardrail.
const MAX_DEPTH = 20;
const MAX_ENTRIES = 5000;

async function walkAsync(dir, depth = 0, counter = { n: 0 }, out = []) {
  if (depth > MAX_DEPTH) throw new Error(`walk: depth exceeded ${MAX_DEPTH} at ${dir}`);
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (++counter.n > MAX_ENTRIES) throw new Error(`walk: entry count exceeded ${MAX_ENTRIES}`);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkAsync(full, depth + 1, counter, out);
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

describe("Spec 189: AC2 — transitional bridging code is removed", () => {
  it("src/lib/command-adapter.js does not exist", () => {
    const adapter = path.join(SRC, "lib", "command-adapter.js");
    assert.equal(
      fs.existsSync(adapter),
      false,
      `transitional adapter still present: ${adapter}`,
    );
  });

  it("no file imports or references legacyMainToCommand", async () => {
    const offenders = [];
    const files = await walkAsync(SRC);
    const sources = await Promise.all(files.map((f) => readFile(f, "utf8")));
    for (let i = 0; i < files.length; i++) {
      if (/\blegacyMainToCommand\b/.test(sources[i])) offenders.push(files[i]);
    }
    assert.deepEqual(
      offenders,
      [],
      `legacyMainToCommand reference found:\n${offenders.join("\n")}`,
    );
  });

  it("no file imports or references runModuleMain", async () => {
    const offenders = [];
    const files = await walkAsync(SRC);
    const sources = await Promise.all(files.map((f) => readFile(f, "utf8")));
    for (let i = 0; i < files.length; i++) {
      if (/\brunModuleMain\b/.test(sources[i])) offenders.push(files[i]);
    }
    assert.deepEqual(
      offenders,
      [],
      `runModuleMain reference found:\n${offenders.join("\n")}`,
    );
  });
});

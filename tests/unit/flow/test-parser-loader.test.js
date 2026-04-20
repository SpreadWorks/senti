/**
 * tests/unit/flow/test-parser-loader.test.js
 *
 * Spec 200 — preset test-log parser resolution (REQ-5, REQ-6).
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { loadTestParser } from "../../../src/flow/lib/test-parser-loader.js";

function writePresetParser(root, presetKey, body) {
  const dir = path.join(root, "src", "presets", presetKey);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "preset.json"),
    JSON.stringify({ parent: null, label: presetKey }),
  );
  fs.writeFileSync(path.join(dir, "test-parser.js"), body);
}

describe("loadTestParser (preset resolution)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns builtin default when preset provides no parser", async () => {
    tmp = createTmpDir();
    const parser = await loadTestParser({ root: tmp, presetKey: null });
    assert.equal(typeof parser.parseCountsFromLog, "function");
    const out = parser.parseCountsFromLog("unit: 1\n");
    assert.deepEqual(out, { unit: 1 });
  });

  it("uses preset parser when it exists", async () => {
    tmp = createTmpDir();
    writePresetParser(
      tmp,
      "fake",
      `export function parseCountsFromLog(text) {
         return { unit: 42, integration: 7, acceptance: 1 };
       }`,
    );
    const parser = await loadTestParser({ root: tmp, presetKey: "fake" });
    assert.deepEqual(parser.parseCountsFromLog("anything"), {
      unit: 42,
      integration: 7,
      acceptance: 1,
    });
  });

  it("honours parser that returns only subset of keys (omits the rest)", async () => {
    tmp = createTmpDir();
    writePresetParser(
      tmp,
      "partial",
      `export function parseCountsFromLog(text) {
         return { unit: 3, integration: 5 };
       }`,
    );
    const parser = await loadTestParser({ root: tmp, presetKey: "partial" });
    const out = parser.parseCountsFromLog("x");
    assert.deepEqual(out, { unit: 3, integration: 5 });
    assert.ok(!("acceptance" in out));
  });

  it("honours parser that returns empty object (no counts recorded)", async () => {
    tmp = createTmpDir();
    writePresetParser(
      tmp,
      "empty",
      `export function parseCountsFromLog(text) { return {}; }`,
    );
    const parser = await loadTestParser({ root: tmp, presetKey: "empty" });
    assert.deepEqual(parser.parseCountsFromLog("x"), {});
  });
});

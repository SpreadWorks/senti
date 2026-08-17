import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { loadActiveFlows } from "../../../src/lib/flow-state.js";

describe("loadActiveFlows corrupted JSON detection", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array for corrupted JSON without crashing", () => {
    tmp = createTmpDir();
    const sddDir = path.join(tmp, ".sdd-forge");
    fs.mkdirSync(sddDir, { recursive: true });
    fs.writeFileSync(path.join(sddDir, ".active-flow"), "{ corrupted json !!!", "utf8");

    const result = loadActiveFlows(tmp);
    assert.deepEqual(result, []);
  });

  it("returns empty array for empty file", () => {
    tmp = createTmpDir();
    const sddDir = path.join(tmp, ".sdd-forge");
    fs.mkdirSync(sddDir, { recursive: true });
    fs.writeFileSync(path.join(sddDir, ".active-flow"), "", "utf8");

    const result = loadActiveFlows(tmp);
    assert.deepEqual(result, []);
  });

  it("returns valid data for correct JSON", () => {
    tmp = createTmpDir();
    const sddDir = path.join(tmp, ".sdd-forge");
    fs.mkdirSync(sddDir, { recursive: true });
    fs.writeFileSync(
      path.join(sddDir, ".active-flow"),
      JSON.stringify([{ spec: "001-test", mode: "local" }]),
      "utf8",
    );

    const result = loadActiveFlows(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].spec, "001-test");
  });

  it("returns empty array when file does not exist", () => {
    tmp = createTmpDir();
    const result = loadActiveFlows(tmp);
    assert.deepEqual(result, []);
  });
});

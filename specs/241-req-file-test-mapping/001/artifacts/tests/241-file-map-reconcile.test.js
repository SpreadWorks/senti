import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("R5: file-map reconciliation with git diff", () => {
  it("should detect files in diff but not in file-map", async () => {
    const { reconcileFileMap } = await import("../../../src/flow/lib/req-map.js");

    const fileMap = { R1: ["src/a.js"] };
    const diffFiles = ["src/a.js", "src/b.js", "src/c.js"];

    const unrecorded = reconcileFileMap(fileMap, diffFiles);
    assert.deepStrictEqual(unrecorded, ["src/b.js", "src/c.js"]);
  });

  it("should return empty array when all diff files are recorded", async () => {
    const { reconcileFileMap } = await import("../../../src/flow/lib/req-map.js");

    const fileMap = { R1: ["src/a.js"], R2: ["src/b.js"] };
    const diffFiles = ["src/a.js", "src/b.js"];

    const unrecorded = reconcileFileMap(fileMap, diffFiles);
    assert.deepStrictEqual(unrecorded, []);
  });

  it("should return all diff files when file-map is empty", async () => {
    const { reconcileFileMap } = await import("../../../src/flow/lib/req-map.js");

    const fileMap = {};
    const diffFiles = ["src/a.js", "src/b.js"];

    const unrecorded = reconcileFileMap(fileMap, diffFiles);
    assert.deepStrictEqual(unrecorded, ["src/a.js", "src/b.js"]);
  });
});

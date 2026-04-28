import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sdd-241-review-"));
}

describe("R7: file-map context enrichment for review", () => {
  it("should load file-map.json and produce mapping lines", async () => {
    const { loadFileMap } = await import("../../../src/flow/lib/req-map.js");
    const tmpDir = createTmpDir();
    try {
      const mapPath = path.join(tmpDir, "file-map.json");
      fs.writeFileSync(mapPath, JSON.stringify({ R1: ["src/a.js"], R2: ["src/b.js", "src/c.js"] }));
      const map = loadFileMap(tmpDir);
      const lines = Object.entries(map).map(([reqId, files]) => `- ${reqId}: ${files.join(", ")}`);
      assert.strictEqual(lines.length, 2);
      assert.ok(lines[0].includes("R1"));
      assert.ok(lines[1].includes("src/b.js"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should return empty object when file-map.json does not exist (fallback)", async () => {
    const { loadFileMap } = await import("../../../src/flow/lib/req-map.js");
    const tmpDir = createTmpDir();
    try {
      const map = loadFileMap(tmpDir);
      assert.deepStrictEqual(map, {});
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("R8: test-map.json untested requirement detection", () => {
  it("should identify requirements with empty test arrays", async () => {
    const { loadTestMap } = await import("../../../src/flow/lib/req-map.js");
    const tmpDir = createTmpDir();
    try {
      const testsDir = path.join(tmpDir, "tests");
      fs.mkdirSync(testsDir, { recursive: true });
      fs.writeFileSync(
        path.join(testsDir, "test-map.json"),
        JSON.stringify({ R1: ["test1"], R2: [], R3: ["test2"], R4: [] }),
      );
      const testMap = loadTestMap(tmpDir);
      const requirements = [
        { id: "R1", desc: "req 1" },
        { id: "R2", desc: "req 2" },
        { id: "R3", desc: "req 3" },
        { id: "R4", desc: "req 4" },
      ];
      const untested = requirements.filter((r) => (testMap[r.id] || []).length === 0);
      assert.strictEqual(untested.length, 2);
      assert.strictEqual(untested[0].id, "R2");
      assert.strictEqual(untested[1].id, "R4");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should return empty object when test-map.json does not exist (skip)", async () => {
    const { loadTestMap } = await import("../../../src/flow/lib/req-map.js");
    const tmpDir = createTmpDir();
    try {
      const testMap = loadTestMap(tmpDir);
      assert.deepStrictEqual(testMap, {});
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

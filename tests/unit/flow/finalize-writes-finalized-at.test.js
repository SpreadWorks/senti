import { describe, it, afterEach } from "node:test";
import { makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
describe("flow finalize — state.finalizedAt write (R1)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: saveFinalizedAt writes state.finalizedAt in ISO 8601 UTC", () => {
    tmp = createTmpDir("senrail-finalize-write-");
    writeJson(tmp, ".senrail/config.json", {
      lang: "ja",
      type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeJson(tmp, "specs/001-alpha/flow.json", makeFlowState({
      specId: "001-alpha",
      runId: "test-run",
      metrics: [],
      tasks: [],
      currentTaskId: null,
    }));

    const iso = "2026-04-17T10:30:00.000Z";
    makeFlowManager(tmp).saveFinalizedAt("001-alpha", iso);

    const saved = JSON.parse(
      readFileSync(join(tmp, "specs/001-alpha/flow.json"), "utf8"),
    );
    assert.ok(saved.state, "state object should be created");
    assert.equal(saved.state.finalizedAt, iso);
  });

  it("R1: ISO 8601 UTC format is enforced (Z suffix)", () => {
    tmp = createTmpDir("senrail-finalize-format-");
    writeJson(tmp, ".senrail/config.json", {
      lang: "ja",
      type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeJson(tmp, "specs/001-alpha/flow.json", makeFlowState({
      specId: "001-alpha",
      runId: "test-run",
      tasks: [],
      currentTaskId: null,
    }));

    assert.throws(
      () => makeFlowManager(tmp).saveFinalizedAt("001-alpha", "2026-04-17 10:30:00"),
      /ISO 8601|UTC/i,
      "non-ISO 8601 format should be rejected",
    );
  });
});

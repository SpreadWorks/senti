import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import {
  readTokenCache,
  runTokenJson,
  writeBaseConfig,
  writeTokenCache,
} from "../../helpers/metrics-token.js";

const FINALIZED_AT = "2025-06-15T12:00:00.000Z";

function flowWithInput(tokenInput) {
  return {
    state: { finalizedAt: FINALIZED_AT },
    metrics: {
      draft: {
        tokens: { input: tokenInput, output: 1, cacheRead: 0, cacheCreation: 0 },
        callCount: 1,
        cost: 0.01,
      },
    },
  };
}

function draftInput(output) {
  return JSON.parse(output).rows.find((row) => row.phase === "draft")?.tokenInput;
}

describe("metrics token content-addressed cache", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("rebuilds when flow content changes but finalizedAt stays the same", () => {
    tmp = createTmpDir("senti-metrics-cache-fingerprint-");
    writeBaseConfig(tmp);
    const flowPath = "specs/001-alpha/flow.json";
    writeJson(tmp, flowPath, flowWithInput(100));
    assert.equal(draftInput(runTokenJson(tmp)), 100);

    writeJson(tmp, flowPath, flowWithInput(101));

    assert.equal(draftInput(runTokenJson(tmp)), 101);
  });

  it("rebuilds when a same-finalizedAt flow is added", () => {
    tmp = createTmpDir("senti-metrics-cache-add-");
    writeBaseConfig(tmp);
    writeJson(tmp, "specs/001-alpha/flow.json", flowWithInput(100));
    assert.equal(draftInput(runTokenJson(tmp)), 100);

    writeJson(tmp, "specs/002-beta/flow.json", flowWithInput(200));

    assert.equal(draftInput(runTokenJson(tmp)), 300);
  });

  it("rebuilds when a same-finalizedAt flow is deleted", () => {
    tmp = createTmpDir("senti-metrics-cache-delete-");
    writeBaseConfig(tmp);
    writeJson(tmp, "specs/001-alpha/flow.json", flowWithInput(100));
    writeJson(tmp, "specs/002-beta/flow.json", flowWithInput(200));
    assert.equal(draftInput(runTokenJson(tmp)), 300);

    rmSync(join(tmp, "specs/002-beta/flow.json"));

    assert.equal(draftInput(runTokenJson(tmp)), 100);
  });

  it("reuses the cache when the input set and contents are unchanged", () => {
    tmp = createTmpDir("senti-metrics-cache-hit-");
    writeBaseConfig(tmp);
    writeJson(tmp, "specs/001-alpha/flow.json", flowWithInput(100));
    runTokenJson(tmp);
    const cache = readTokenCache(tmp);
    assert.match(cache.inputFingerprint, /^[a-f0-9]{64}$/);
    cache.rows[0].tokenInput = 42;
    writeTokenCache(tmp, cache);

    assert.equal(draftInput(runTokenJson(tmp)), 42);
  });
});

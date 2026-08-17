// spec: R10
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CACHE_VERSION } from "../../../src/metrics/commands/token.js";

let tmpRoot = null;

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
});

function setupRoot() {
  tmpRoot = mkdtempSync(join(tmpdir(), "sdd-cache-version-"));
  mkdirSync(join(tmpRoot, ".sdd-forge", "output"), { recursive: true });
  mkdirSync(join(tmpRoot, "specs", "001-cache"), { recursive: true });
  return tmpRoot;
}

function writeStaleCache(root, version) {
  const cachePath = join(root, ".sdd-forge", "output", "metrics.json");
  // Pre-bump cache shape: rows have flat token columns and no providers map.
  writeFileSync(
    cachePath,
    JSON.stringify(
      {
        version,
        generatedAt: "2025-01-01T00:00:00Z",
        maxFinalizedAt: "2025-01-01T00:00:00Z",
        rows: [
          {
            date: "2025-01-01",
            phase: "review-spec",
            specCount: 1,
            difficulty: null,
            tokenInput: 100,
            tokenOutput: 50,
            cacheRead: 0,
            cacheCreate: 0,
            cacheHitRate: null,
            callCount: 1,
            cost: 0.01,
            costIncomplete: false,
            durationMs: 100,
            // Note: NO `providers` field — legacy shape.
          },
        ],
      },
      null,
      2,
    ) + "\n",
  );
  return cachePath;
}

function writeFlow(root) {
  // Minimal flow.json with a finalizedAt + provider-tagged metric so a
  // rebuild produces the new shape with providers buckets.
  writeFileSync(
    join(root, "specs", "001-cache", "flow.json"),
    JSON.stringify(
      {
        spec: "specs/001-cache/spec.json",
        tasks: [],
        currentTaskId: null,
        state: { finalizedAt: "2026-05-10T00:00:00.000Z" },
        metrics: [
          {
            phase: "review-spec",
            kind: "agent",
            provider: "claude",
            profileKey: "claude/sonnet",
            callCount: 1,
            responseChars: 50,
            durationMs: 200,
            tokens: { input: 11, output: 22, cacheRead: 33, cacheCreation: 44 },
            cost: 0.05,
          },
        ],
      },
      null,
      2,
    ) + "\n",
  );
}

describe("metrics token cache invalidation by version (R10)", () => {
  it("R10: CACHE_VERSION is greater than the previous schema version", () => {
    assert.ok(CACHE_VERSION > 2, `expected CACHE_VERSION > 2 for the new providers schema, got ${CACHE_VERSION}`);
  });

  it("R10: stale cache (version=2) with legacy row shape is invalidated and rebuilt with providers buckets", async () => {
    const root = setupRoot();
    const cachePath = writeStaleCache(root, 2);
    writeFlow(root);

    // Drive the command via direct import so we don't need a CLI process.
    const { default: TokenCommand } = await import(
      "../../../src/metrics/commands/token.js"
    );
    const cmd = new TokenCommand();
    const container = { get: (key) => (key === "root" ? root : null) };

    // The CLI prints to stdout; suppress for the test.
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try {
      await cmd.execute({ _rawArgs: ["--format", "json"], container });
    } finally {
      process.stdout.write = origWrite;
    }

    const after = JSON.parse(readFileSync(cachePath, "utf8"));
    assert.equal(after.version, CACHE_VERSION, "cache must be rewritten with the new version");
    assert.ok(Array.isArray(after.rows) && after.rows.length > 0, "rebuilt cache must contain rows");
    const row = after.rows.find((r) => r.phase === "review-spec");
    assert.ok(row, "expected a review-spec row in rebuilt cache");
    assert.ok(row.providers && typeof row.providers === "object", "rebuilt row must carry providers buckets");
    assert.ok(
      row.providers.claude && row.providers.claude["claude/sonnet"],
      "providers.claude['claude/sonnet'] bucket must exist post-rebuild",
    );
    const bucket = row.providers.claude["claude/sonnet"];
    assert.equal(bucket.tokenInput, 11);
    assert.equal(bucket.cacheCreate, 44);
  });
});

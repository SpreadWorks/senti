// spec: R8
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "../../../src/lib/agent.js";
import { FlowStore } from "../../../src/lib/flow-store.js";
import { buildMetricsSummary } from "../../../src/flow/lib/get-status.js";

let tmpRoot = null;

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
});

function makeStore() {
  tmpRoot = mkdtempSync(join(tmpdir(), "sdd-review-cache-"));
  const store = new FlowStore({
    root: tmpRoot,
    mainRoot: tmpRoot,
    inWorktree: false,
    activeFlowsProvider: () => ({ load: () => [{ spec: "001-review-cache", mode: "local" }] }),
  });
  store.save({
    spec: "specs/001-review-cache/spec.json",
    tasks: [],
    currentTaskId: null,
    metrics: [],
  });
  return store;
}

function readMetrics() {
  const flow = JSON.parse(
    readFileSync(join(tmpRoot, "specs/001-review-cache/flow.json"), "utf8"),
  );
  return flow.metrics;
}

function makeLogger() {
  return { agent: async () => {} };
}

function makeAgentBackedByStore(store, phase, usage) {
  const agent = new Agent({
    config: {
      agent: {
        default: "claude/sonnet",
        retryCount: 0,
      },
    },
    paths: {
      root: tmpRoot,
      agentWorkDir: join(tmpRoot, ".tmp"),
    },
    logger: makeLogger(),
    flowManager: {
      resolveCurrentContext: () => ({ sddPhase: phase }),
      accumulateAgentMetrics: (...args) => store.accumulateAgentMetrics(...args),
    },
  });
  agent._callOnceWithRetry = async () => ({
    text: "review ok",
    usage,
  });
  return agent;
}

/**
 * Simulate the agent → flow.json plumbing for a review-spec / review-draft
 * call. The Agent layer is supposed to:
 *   - parse `usage.cache_creation_tokens` from the provider envelope, and
 *   - forward provider/profileKey to accumulateAgentMetrics.
 */
function simulateAgentCall(store, phase, { cacheCreation }) {
  store.accumulateAgentMetrics(phase, {
    provider: "claude",
    profileKey: "claude/sonnet",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 0,
      cache_creation_tokens: cacheCreation,
      cost_usd: 0.01,
    },
    responseChars: 200,
    durationMs: 800,
    model: "sonnet",
    taskId: null,
  });
}

describe("review pipeline plumbs cache_creation_tokens end-to-end (R8)", () => {
  it("R8: mocked review-spec agent usage with cache_creation_tokens > 0 is recorded in flow.json and provider buckets", async () => {
    const store = makeStore();
    const agent = makeAgentBackedByStore(store, "review-spec", {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 0,
      cache_creation_tokens: 100,
      cost_usd: 0.01,
    });

    await agent.call("spec prompt", { commandId: "flow.spec.review.propose" });

    const entries = readMetrics();
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.equal(entry.tokens.cacheCreation, 100);

    const summary = buildMetricsSummary(entries);
    const bucket = summary.total["review-spec"].providers.claude["claude/sonnet"];
    assert.ok(bucket, "providers.claude['claude/sonnet'] bucket must exist");
    assert.equal(bucket.tokens.cacheCreation, 100);
  });

  it("R8: mocked review-draft agent usage with cache_creation_tokens > 0 is recorded in flow.json and provider buckets", async () => {
    const store = makeStore();
    const agent = makeAgentBackedByStore(store, "review-draft", {
      input_tokens: 120,
      output_tokens: 40,
      cache_read_tokens: 0,
      cache_creation_tokens: 200,
      cost_usd: 0.02,
    });

    await agent.call("draft prompt", { commandId: "flow.draft.review.propose" });

    const entries = readMetrics();
    const entry = entries[0];
    assert.equal(entry.provider, "claude");
    assert.equal(entry.profileKey, "claude/sonnet");
    assert.equal(entry.tokens.cacheCreation, 200);

    const summary = buildMetricsSummary(entries);
    const bucket = summary.total["review-draft"].providers.claude["claude/sonnet"];
    assert.ok(bucket, "providers.claude['claude/sonnet'] bucket must exist");
    assert.equal(bucket.tokens.cacheCreation, 200);
  });

  it("R8: mocked provider usage with cache_creation_tokens === 0 records 0 and keeps provider/profileKey", () => {
    const store = makeStore();
    simulateAgentCall(store, "review-draft", { cacheCreation: 0 });

    const entries = readMetrics();
    assert.equal(entries[0].provider, "claude");
    assert.equal(entries[0].profileKey, "claude/sonnet");
    assert.equal(entries[0].tokens.cacheCreation, 0);

    const summary = buildMetricsSummary(entries);
    const bucket = summary.total["review-draft"].providers.claude["claude/sonnet"];
    assert.ok(bucket, "providers bucket must exist even when cacheCreation=0");
    assert.equal(bucket.tokens.cacheCreation, 0);
  });
});

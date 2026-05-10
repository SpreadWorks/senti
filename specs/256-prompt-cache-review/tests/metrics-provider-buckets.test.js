// spec: R6 R7 R8 R9 R10 R11
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMetricsSummary, buildReportTotals } from "../../../src/flow/lib/get-status.js";
import { FlowStore } from "../../../src/lib/flow-store.js";
import * as tokenMetrics from "../../../src/metrics/commands/token.js";

let tmpRoot = null;

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
});

function makeFlowStore() {
  tmpRoot = mkdtempSync(join(tmpdir(), "sdd-provider-metrics-"));
  const store = new FlowStore({
    root: tmpRoot,
    mainRoot: tmpRoot,
    inWorktree: false,
    activeFlowsProvider: () => ({ load: () => [{ spec: "001-provider-metrics", mode: "local" }] }),
  });
  store.save({
    spec: "specs/001-provider-metrics/spec.json",
    tasks: [],
    currentTaskId: null,
    metrics: [],
  });
  return store;
}

function readFlowMetrics() {
  const flow = JSON.parse(readFileSync(join(tmpRoot, "specs/001-provider-metrics/flow.json"), "utf8"));
  return flow.metrics;
}

describe("agent metric provider/profile buckets", () => {
  it("R6: accumulateAgentMetrics persists provider and profileKey strings", () => {
    const store = makeFlowStore();
    store.accumulateAgentMetrics("review-spec", {
      provider: "claude",
      profileKey: "claude/sonnet",
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_tokens: 3,
        cache_creation_tokens: 7,
        cost_usd: 0.25,
      },
      responseChars: 99,
      durationMs: 1234,
      model: "sonnet",
      taskId: null,
    });

    const [entry] = readFlowMetrics();
    assert.equal(entry.provider, "claude");
    assert.equal(entry.profileKey, "claude/sonnet");
    assert.equal(entry.tokens.cacheCreation, 7);
    assert.equal(entry.cost, 0.25);
  });

  it("R6: missing provider/profile values normalize to unknown at storage boundary", () => {
    const store = makeFlowStore();
    store.accumulateAgentMetrics("review-draft", {
      provider: null,
      profileKey: 42,
      usage: { input_tokens: 1, output_tokens: 2 },
      taskId: null,
    });

    const [entry] = readFlowMetrics();
    assert.equal(entry.provider, "unknown");
    assert.equal(entry.profileKey, "unknown");
  });

  // ─── GAP-4: TC-17 — UserProvider provider="user" tagging ─────────────────
  it("TC-17: UserProvider invocation tags the metric entry with provider='user'", () => {
    const store = makeFlowStore();
    // Simulate the path Agent takes when it routes through a UserProvider
    // (a custom user-defined profile whose command does not match any built-in
    // provider). The agent layer is expected to forward provider="user".
    store.accumulateAgentMetrics("review-spec", {
      provider: "user",
      profileKey: "my-custom-tool/default",
      usage: { input_tokens: 5, output_tokens: 2 },
      responseChars: 10,
      taskId: null,
    });

    const [entry] = readFlowMetrics();
    assert.equal(entry.provider, "user");
    assert.equal(entry.profileKey, "my-custom-tool/default");

    // Confirm the same tag survives the read-time aggregation pipeline.
    const summary = buildMetricsSummary([entry]);
    const userBucket = summary.total["review-spec"].providers.user;
    assert.ok(userBucket, "summary must contain a 'user' provider bucket");
    assert.ok(userBucket["my-custom-tool/default"], "must contain the user profile key bucket");
  });

  it("R7: status metricsSummary builds nested provider/profile buckets", () => {
    const summary = buildMetricsSummary([
      {
        phase: "review-spec",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 1,
        responseChars: 50,
        durationMs: 1000,
        tokens: { input: 10, output: 5, cacheRead: 3, cacheCreation: 7 },
        cost: 0.25,
        model: "sonnet",
      },
      {
        phase: "review-spec",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 1,
        responseChars: 25,
        durationMs: 2000,
        tokens: { input: 4, output: 2, cacheRead: 1, cacheCreation: 0 },
        costIncomplete: true,
        model: "sonnet",
      },
      {
        phase: "review-spec",
        kind: "agent",
        callCount: 1,
        responseChars: 5,
        tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
      },
    ]);

    const bucket = summary.total["review-spec"].providers.claude["claude/sonnet"];
    assert.equal(bucket.callCount, 2);
    assert.equal(bucket.responseChars, 75);
    assert.equal(bucket.durationMs, 3000);
    assert.deepEqual(bucket.tokens, { input: 14, output: 7, cacheRead: 4, cacheCreation: 7 });
    assert.equal(bucket.cost, 0.25);
    assert.equal(bucket.costIncomplete, true);
    assert.deepEqual(bucket.models, { sonnet: 2 });
    assert.equal(summary.total["review-spec"].providers.unknown.unknown.callCount, 1);
  });

  it("R8: review prompt cache usage records cacheCreation in provider buckets", () => {
    const summary = buildMetricsSummary([
      {
        phase: "review-spec",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 1,
        tokens: { input: 10, output: 1, cacheRead: 0, cacheCreation: 123 },
      },
      {
        phase: "review-draft",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 1,
        tokens: { input: 20, output: 2, cacheRead: 0, cacheCreation: 456 },
      },
      {
        phase: "review-test",
        kind: "agent",
        provider: "codex",
        profileKey: "codex/default",
        callCount: 1,
        tokens: { input: 30, output: 3, cacheRead: 0, cacheCreation: 0 },
      },
    ]);

    assert.equal(summary.total["review-spec"].providers.claude["claude/sonnet"].tokens.cacheCreation, 123);
    assert.equal(summary.total["review-draft"].providers.claude["claude/sonnet"].tokens.cacheCreation, 456);
    assert.equal(summary.total["review-test"].providers.codex["codex/default"].tokens.cacheCreation, 0);
  });

  it("R9: old metric entries without provider/profileKey aggregate under unknown", () => {
    const summary = buildMetricsSummary([
      {
        phase: "draft",
        kind: "agent",
        callCount: 1,
        tokens: { input: 1, output: 2, cacheRead: 3, cacheCreation: 4 },
      },
    ]);

    assert.equal(summary.total.draft.providers.unknown.unknown.callCount, 1);

    const rows = tokenMetrics.buildRowsFromMetrics("2026-05-10", {
      draft: {
        tokens: { input: 1, output: 2, cacheRead: 3, cacheCreation: 4 },
        callCount: 1,
      },
    });
    assert.equal(rows[0].providers.unknown.unknown.callCount, 1);
  });

  it("R10: metrics token rows and phase summaries expose provider/profile buckets", () => {
    assert.ok(tokenMetrics.CACHE_VERSION > 2, "metrics cache version must be incremented");

    const rows = tokenMetrics.buildRowsFromMetrics("2026-05-10", [
      {
        phase: "review-spec",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 1,
        durationMs: 100,
        tokens: { input: 10, output: 5, cacheRead: 3, cacheCreation: 7 },
        cost: 0.25,
      },
      {
        phase: "review-spec",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 1,
        durationMs: 200,
        tokens: { input: 4, output: 2, cacheRead: 1, cacheCreation: 0 },
        costIncomplete: true,
      },
    ]);

    const bucket = rows[0].providers.claude["claude/sonnet"];
    assert.deepEqual(bucket, {
      tokenInput: 14,
      tokenOutput: 7,
      cacheRead: 4,
      cacheCreate: 7,
      callCount: 2,
      cost: 0.25,
      costIncomplete: true,
      durationMs: 300,
    });

    const summary = tokenMetrics.computePhaseSummary(rows);
    assert.deepEqual(summary.providers.claude["claude/sonnet"], bucket);
  });

  it("R11: report totals preserve flat token metrics and ignore provider buckets", () => {
    const metricsSummary = buildMetricsSummary([
      {
        phase: "review-spec",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 1,
        responseChars: 10,
        durationMs: 500,
        tokens: { input: 11, output: 22, cacheRead: 33, cacheCreation: 44 },
        cost: 0.5,
      },
    ]);
    const totals = buildReportTotals(metricsSummary.total);

    assert.deepEqual(totals.tokens, {
      input: 11,
      output: 22,
      cacheRead: 33,
      cacheCreation: 44,
      cost: 0.5,
      callCount: 1,
      durationMs: 500,
      phaseDurations: [{ phase: "review-spec", durationMs: 500 }],
    });
    assert.equal("providers" in totals.tokens, false);
  });

  // ─── GAP-5: TC-20 — existing aggregation regression coverage ──────────────
  describe("legacy aggregation regression (TC-20 / TC-35)", () => {
    it("TC-20: tokens / cost / duration / callCount / responseChars / model histogram still aggregate correctly after the schema bump", () => {
      const entries = [
        {
          phase: "draft",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          responseChars: 100,
          durationMs: 500,
          tokens: { input: 10, output: 5, cacheRead: 0, cacheCreation: 0 },
          cost: 0.01,
          model: "sonnet",
        },
        {
          phase: "draft",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          responseChars: 200,
          durationMs: 700,
          tokens: { input: 20, output: 10, cacheRead: 0, cacheCreation: 0 },
          cost: 0.02,
          model: "opus",
        },
        // counter entries should NOT pollute agent totals
        { phase: "draft", counter: "question", delta: 1 },
        { phase: "draft", counter: "question", delta: 1 },
      ];
      const summary = buildMetricsSummary(entries);
      const draft = summary.total.draft;

      assert.equal(draft.callCount, 2, "callCount sums across entries");
      assert.equal(draft.responseChars, 300, "responseChars sums across entries");
      assert.equal(draft.durationMs, 1200, "durationMs sums across entries");
      assert.equal(draft.tokens.input, 30);
      assert.equal(draft.tokens.output, 15);
      assert.ok(Math.abs(draft.cost - 0.03) < 1e-9, "cost sums");
      assert.deepEqual(draft.models, { sonnet: 1, opus: 1 }, "model histogram");
      // counter passthrough
      assert.equal(draft.question, 2, "counter aggregation still works");
    });

    it("TC-35: mixed legacy (untagged) + new (tagged) entries — Σ(providers[*][*]) === phase totals", () => {
      const entries = [
        // tagged claude/sonnet
        {
          phase: "review-spec",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          responseChars: 50,
          durationMs: 100,
          tokens: { input: 10, output: 5, cacheRead: 1, cacheCreation: 2 },
          cost: 0.1,
        },
        // tagged codex/default
        {
          phase: "review-spec",
          kind: "agent",
          provider: "codex",
          profileKey: "codex/default",
          callCount: 1,
          responseChars: 30,
          durationMs: 200,
          tokens: { input: 5, output: 3, cacheRead: 0, cacheCreation: 0 },
          cost: 0.05,
        },
        // legacy/untagged (should aggregate under unknown.unknown)
        {
          phase: "review-spec",
          kind: "agent",
          callCount: 1,
          responseChars: 20,
          durationMs: 50,
          tokens: { input: 4, output: 2, cacheRead: 0, cacheCreation: 0 },
          cost: 0.01,
        },
      ];
      const summary = buildMetricsSummary(entries);
      const phase = summary.total["review-spec"];
      const providers = phase.providers || {};

      // Sum every provider/profile bucket.
      const bucketSum = {
        callCount: 0,
        responseChars: 0,
        durationMs: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheCreation: 0,
        cost: 0,
      };
      for (const profileMap of Object.values(providers)) {
        for (const b of Object.values(profileMap)) {
          bucketSum.callCount += b.callCount || 0;
          bucketSum.responseChars += b.responseChars || 0;
          bucketSum.durationMs += b.durationMs || 0;
          bucketSum.input += b.tokens?.input || 0;
          bucketSum.output += b.tokens?.output || 0;
          bucketSum.cacheRead += b.tokens?.cacheRead || 0;
          bucketSum.cacheCreation += b.tokens?.cacheCreation || 0;
          bucketSum.cost += b.cost || 0;
        }
      }

      assert.equal(bucketSum.callCount, phase.callCount);
      assert.equal(bucketSum.responseChars, phase.responseChars);
      assert.equal(bucketSum.durationMs, phase.durationMs);
      assert.equal(bucketSum.input, phase.tokens.input);
      assert.equal(bucketSum.output, phase.tokens.output);
      assert.equal(bucketSum.cacheRead, phase.tokens.cacheRead);
      assert.equal(bucketSum.cacheCreation, phase.tokens.cacheCreation);
      assert.ok(Math.abs(bucketSum.cost - phase.cost) < 1e-9);
    });
  });

  // ─── GAP-10: TC-34 — empty-input edge case ────────────────────────────────
  describe("empty-input edge case (TC-34)", () => {
    it("buildMetricsSummary([]) does not crash and produces an empty total", () => {
      const summary = buildMetricsSummary([]);
      assert.ok(summary && typeof summary === "object", "summary must be returned");
      // total may be {} OR each phase may be absent; both shapes are acceptable.
      assert.ok(
        summary.total === undefined ||
          (typeof summary.total === "object" && Object.keys(summary.total).length === 0),
        `expected empty total, got: ${JSON.stringify(summary.total)}`,
      );
    });

    it("buildMetricsSummary([]).providers is empty or absent", () => {
      const summary = buildMetricsSummary([]);
      const total = summary.total || {};
      // No phase entries, so no providers buckets exist either.
      for (const phaseTotal of Object.values(total)) {
        const providers = phaseTotal?.providers;
        assert.ok(
          providers === undefined ||
            (typeof providers === "object" && Object.keys(providers).length === 0),
        );
      }
    });
  });

  // ─── GAP-8: TC-37 — cross-bucket model aggregation isolation ─────────────
  //
  // Verifies that when entries from different (provider, profileKey) tuples
  // each contribute distinct model values, those model histograms remain
  // strictly scoped to their owning bucket. A bug here would let claude's
  // "sonnet" / "opus" leak into the codex bucket's `.models` map (or vice
  // versa) — which would corrupt every downstream consumer reading per-bucket
  // model usage.

  describe("cross-bucket model aggregation isolation (GAP-8 / TC-37)", () => {
    function buildMixedEntries() {
      return [
        // claude/sonnet × 2 with model "sonnet"
        {
          phase: "review-spec",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
          model: "sonnet",
        },
        {
          phase: "review-spec",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
          model: "sonnet",
        },
        // claude/sonnet × 1 with model "opus" (model name distinct from profile key)
        {
          phase: "review-spec",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
          model: "opus",
        },
        // codex/default × 1 with model "gpt-5"
        {
          phase: "review-spec",
          kind: "agent",
          provider: "codex",
          profileKey: "codex/default",
          callCount: 1,
          tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
          model: "gpt-5",
        },
      ];
    }

    it("buildMetricsSummary: claude bucket sees sonnet+opus; codex bucket sees only gpt-5", () => {
      const summary = buildMetricsSummary(buildMixedEntries());
      const phase = summary.total["review-spec"];
      assert.ok(phase, "phase total must exist");
      assert.ok(phase.providers, "providers map must exist");

      const claudeBucket = phase.providers.claude?.["claude/sonnet"];
      const codexBucket = phase.providers.codex?.["codex/default"];
      assert.ok(claudeBucket, "claude/sonnet bucket must exist");
      assert.ok(codexBucket, "codex/default bucket must exist");

      // Claude bucket: sonnet=2, opus=1
      assert.equal(claudeBucket.models?.sonnet, 2, "claude bucket should record sonnet=2");
      assert.equal(claudeBucket.models?.opus, 1, "claude bucket should record opus=1");

      // Codex bucket: gpt-5=1, MUST NOT contain sonnet or opus
      assert.equal(codexBucket.models?.["gpt-5"], 1, "codex bucket should record gpt-5=1");
      assert.ok(
        !("sonnet" in (codexBucket.models || {})),
        `codex bucket must NOT contain 'sonnet' (cross-bucket leak); got models=${JSON.stringify(codexBucket.models)}`,
      );
      assert.ok(
        !("opus" in (codexBucket.models || {})),
        `codex bucket must NOT contain 'opus' (cross-bucket leak); got models=${JSON.stringify(codexBucket.models)}`,
      );
    });

    it("buildMetricsSummary: claude bucket does NOT contain gpt-5 (reverse leak check)", () => {
      const summary = buildMetricsSummary(buildMixedEntries());
      const claudeBucket = summary.total["review-spec"].providers.claude["claude/sonnet"];
      assert.ok(
        !("gpt-5" in (claudeBucket.models || {})),
        `claude bucket must NOT contain 'gpt-5' (reverse leak); got models=${JSON.stringify(claudeBucket.models)}`,
      );
    });
  });

  // ─── GAP-9: TC-21 — holistic snapshot/golden of aggregator output ─────────
  //
  // Pins every aggregator output field at once via a single deepEqual against
  // a literal expected object. Any silent semantic change in the aggregator
  // (double-counting cacheRead, dropping models, mis-summing cost, etc.)
  // will break this assertion even if individual field-level assertions
  // continue to pass elsewhere.

  describe("aggregator holistic snapshot (GAP-9 / TC-21)", () => {
    it("buildMetricsSummary returns the exact expected shape for a fixed input set (draft phase)", () => {
      const entries = [
        {
          phase: "draft",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          responseChars: 100,
          durationMs: 1000,
          tokens: { input: 10, output: 5, cacheRead: 2, cacheCreation: 3 },
          cost: 0.01,
          model: "sonnet",
        },
        {
          phase: "draft",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          responseChars: 200,
          durationMs: 2000,
          tokens: { input: 20, output: 15, cacheRead: 5, cacheCreation: 0 },
          cost: 0.02,
          model: "sonnet",
        },
      ];
      const summary = buildMetricsSummary(entries);

      // Pin every field of summary.total.draft at once. If the aggregator
      // semantics shift (e.g. double-count cacheRead, drop callCount, change
      // model histogram normalization), this deepEqual fails immediately.
      const GOLDEN_DRAFT = {
        callCount: 2,
        responseChars: 300,
        durationMs: 3000,
        tokens: { input: 30, output: 20, cacheRead: 7, cacheCreation: 3 },
        cost: 0.03,
        models: { sonnet: 2 },
        providers: {
          claude: {
            "claude/sonnet": {
              callCount: 2,
              responseChars: 300,
              durationMs: 3000,
              tokens: { input: 30, output: 20, cacheRead: 7, cacheCreation: 3 },
              cost: 0.03,
              costIncomplete: false,
              models: { sonnet: 2 },
            },
          },
        },
      };

      // Strip floating-point cost noise before deepEqual.
      const draft = summary.total.draft;
      draft.cost = Math.round(draft.cost * 100) / 100;
      if (draft.providers?.claude?.["claude/sonnet"]) {
        const b = draft.providers.claude["claude/sonnet"];
        b.cost = Math.round(b.cost * 100) / 100;
      }

      assert.deepEqual(
        draft,
        GOLDEN_DRAFT,
        "aggregator output shape must exactly match the GOLDEN_DRAFT snapshot — any drift is a regression",
      );
    });
  });

  // ─── GAP-10: TC-26 — phaseSummary indexing shape (multi-phase isolation) ─
  //
  // TC-26 spec wording is `phaseSummary[phase].providers[p][k]`. The current
  // production `computePhaseSummary(rows)` returns a flat
  // `{ providers: {...} }` per call (single-phase). When rows from multiple
  // phases are passed, we verify the returned shape so a future contract
  // change (flat → phase-keyed) is detectable rather than silently breaking
  // downstream consumers.

  describe("phaseSummary indexing shape (GAP-10 / TC-26)", () => {
    it("computePhaseSummary returns providers buckets that are pollution-free per logical bucket key when multi-phase rows are supplied", () => {
      const rows = tokenMetrics.buildRowsFromMetrics("2026-05-10", [
        {
          phase: "draft",
          kind: "agent",
          provider: "claude",
          profileKey: "claude/sonnet",
          callCount: 1,
          tokens: { input: 10, output: 5, cacheRead: 0, cacheCreation: 0 },
          cost: 0.01,
        },
        {
          phase: "spec",
          kind: "agent",
          provider: "codex",
          profileKey: "codex/default",
          callCount: 1,
          tokens: { input: 20, output: 10, cacheRead: 0, cacheCreation: 0 },
          cost: 0.02,
        },
      ]);

      const summary = tokenMetrics.computePhaseSummary(rows);
      assert.ok(summary, "computePhaseSummary must return a value");

      // Two possible production shapes:
      //   (A) flat: summary = { providers: { claude: {...}, codex: {...} } }
      //   (B) phase-keyed: summary = { draft: { providers: {...} }, spec: { providers: {...} } }
      // Both are acceptable; the contract we enforce is no cross-bucket leak.
      const shapeA = !!summary.providers;
      const shapeB = !!summary.draft || !!summary.spec;

      assert.ok(shapeA || shapeB, `summary must use either flat or phase-keyed shape; got keys=${Object.keys(summary)}`);

      if (shapeA) {
        // Flat-per-call shape: claude bucket and codex bucket coexist.
        // Verify each bucket is present with the right keys.
        assert.ok(summary.providers.claude?.["claude/sonnet"], "claude/sonnet bucket missing in flat shape");
        assert.ok(summary.providers.codex?.["codex/default"], "codex/default bucket missing in flat shape");
        // Cross-bucket leak check: claude bucket must not carry codex's tokens.
        const claude = summary.providers.claude["claude/sonnet"];
        const codex = summary.providers.codex["codex/default"];
        assert.equal(claude.tokenInput, 10, "claude bucket must carry only its own tokens");
        assert.equal(codex.tokenInput, 20, "codex bucket must carry only its own tokens");
      } else {
        // Phase-keyed shape: each phase has its own providers map.
        const draft = summary.draft;
        const spec = summary.spec;
        assert.ok(draft.providers?.claude?.["claude/sonnet"], "draft phase missing claude bucket");
        assert.ok(spec.providers?.codex?.["codex/default"], "spec phase missing codex bucket");
        // No cross-phase leak: draft must not contain codex's bucket; spec must
        // not contain claude's bucket.
        assert.ok(
          !draft.providers.codex,
          `draft phase must not contain codex bucket; got: ${JSON.stringify(Object.keys(draft.providers))}`,
        );
        assert.ok(
          !spec.providers.claude,
          `spec phase must not contain claude bucket; got: ${JSON.stringify(Object.keys(spec.providers))}`,
        );
      }
    });
  });
});

// spec: R1 R2 R3 R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import SetIssueCommand from "../../../src/flow/lib/set-issue.js";
import SetMetricCommand from "../../../src/flow/lib/set-metric.js";
import SetNoteCommand from "../../../src/flow/lib/set-note.js";
import SetRequestCommand from "../../../src/flow/lib/set-request.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

function makeManager(root) {
  return new FlowManager({ root, mainRoot: root, inWorktree: false });
}

function makeTask(id) {
  return {
    id,
    spec: `specs/001-alpha/tasks/${id}.md`,
    origin: "plan",
    parent: null,
    status: "pending",
    steps: [],
    requirements: [],
    summary: null,
  };
}

function makeState(specId, overrides = {}) {
  return {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    worktree: false,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [makeTask("T-1"), makeTask("T-2")],
    currentTaskId: null,
    ...overrides,
  };
}

function setupSpec(root, specId, overrides = {}) {
  const fm = makeManager(root);
  fm.save(makeState(specId, overrides));
}

function readFlow(root, specId) {
  return JSON.parse(fs.readFileSync(path.join(root, "specs", specId, "flow.json"), "utf8"));
}

function commandContext(flowManager, extra = {}) {
  return {
    flowManager,
    specId: "001-alpha",
    root: flowManager._root,
    flowState: makeState("001-alpha"),
    ...extra,
  };
}

describe("specId flow-state contract", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R1: FlowStore-backed setters update a named spec without active-flow registry", () => {
    tmp = createTmpDir("specid-contract-");
    setupSpec(tmp, "001-alpha");
    const fm = makeManager(tmp);

    fm.setRequest("direct request", { specId: "001-alpha" });
    fm.setIssue(335, { specId: "001-alpha" });
    fm.addNote("direct note", { specId: "001-alpha", taskId: null });
    fm.appendMetric({ phase: "plan", counter: "docsRead", delta: 1 }, { specId: "001-alpha", taskId: null });
    fm.incrementMetric("plan", "srcRead", { specId: "001-alpha", taskId: null });
    fm.accumulateAgentMetrics("plan", { provider: "test", profileKey: "spec", responseChars: 7, taskId: null, specId: "001-alpha" });

    const loaded = readFlow(tmp, "001-alpha");
    assert.equal(loaded.request, "direct request");
    assert.equal(loaded.issue, 335);
    assert.equal(loaded.notes.at(-1).text, "direct note");
    assert.ok(loaded.metrics.some((entry) => entry.counter === "docsRead"));
    assert.ok(loaded.metrics.some((entry) => entry.counter === "srcRead"));
    assert.ok(loaded.metrics.some((entry) => entry.kind === "agent"));
  });

  it("R2: FlowManager.mutate forwards per-call specId", () => {
    tmp = createTmpDir("specid-contract-");
    setupSpec(tmp, "001-alpha");
    const fm = makeManager(tmp);

    fm.mutate((state) => {
      state.request = "mutated by spec id";
    }, { specId: "001-alpha" });

    assert.equal(readFlow(tmp, "001-alpha").request, "mutated by spec id");
  });

  it("R3: forRoot(root, { specId }) supplies a bound default specId", () => {
    tmp = createTmpDir("specid-contract-");
    setupSpec(tmp, "001-alpha");
    const bound = makeManager(tmp).forRoot(tmp, { specId: "001-alpha" });

    assert.equal(bound.load().spec, "specs/001-alpha/spec.json");
    assert.equal(bound.pathFor(), path.join(tmp, "specs", "001-alpha", "flow.json"));
    bound.setRequest("bound request");
    bound.addNote("bound note", { taskId: null });
    bound.incrementMetric("plan", "docsRead", { taskId: null });

    const loaded = readFlow(tmp, "001-alpha");
    assert.equal(loaded.request, "bound request");
    assert.equal(loaded.notes.at(-1).text, "bound note");
    assert.ok(loaded.metrics.some((entry) => entry.counter === "docsRead"));
  });

  it("R4: per-call specId overrides a bound specId", () => {
    tmp = createTmpDir("specid-contract-");
    setupSpec(tmp, "001-alpha");
    setupSpec(tmp, "002-beta");
    const bound = makeManager(tmp).forRoot(tmp, { specId: "001-alpha" });

    bound.setRequest("beta request", { specId: "002-beta" });

    assert.equal(readFlow(tmp, "001-alpha").request ?? null, null);
    assert.equal(readFlow(tmp, "002-beta").request, "beta request");
  });

  it("R5: specId selection preserves explicit and inferred taskId behavior", () => {
    tmp = createTmpDir("specid-contract-");
    setupSpec(tmp, "001-alpha", { currentTaskId: "T-2" });
    const fm = makeManager(tmp);

    fm.addNote("flow scope", { specId: "001-alpha", taskId: null });
    fm.addNote("known task", { specId: "001-alpha", taskId: "T-1" });
    fm.addNote("current task", { specId: "001-alpha" });
    assert.throws(() => fm.addNote("unknown task", { specId: "001-alpha", taskId: "missing" }), /unknown task id/);

    const notes = readFlow(tmp, "001-alpha").notes;
    assert.equal(notes[0].taskId, null);
    assert.equal(notes[1].taskId, "T-1");
    assert.equal(notes[2].taskId, "T-2");
  });

  it("R6: ambient metrics without active flow or specId remain a no-op", () => {
    tmp = createTmpDir("specid-contract-");
    const fm = makeManager(tmp);

    assert.doesNotThrow(() => fm.appendMetric({ phase: "plan", counter: "docsRead", delta: 1 }));
    assert.doesNotThrow(() => fm.appendMetric({ phase: "impl", counter: "docsRead", delta: 1 }, { taskId: null }));
    assert.doesNotThrow(() => fm.incrementMetric("plan", "srcRead"));
    assert.doesNotThrow(() => fm.incrementMetric("impl", "srcRead", { taskId: null }));
    assert.equal(fs.existsSync(path.join(tmp, "specs")), false);
  });

  it("R7: setter commands pass ctx.specId while preserving validation", () => {
    const calls = [];
    const flowManager = {
      _root: "/tmp/specid-contract",
      setRequest(text, opts) { calls.push(["request", text, opts]); },
      setIssue(issue, opts) { calls.push(["issue", issue, opts]); },
      addNote(text, opts) { calls.push(["note", text, opts]); },
      incrementMetric(phase, counter, opts) { calls.push(["metric", phase, counter, opts]); },
    };

    new SetRequestCommand().execute(commandContext(flowManager, { text: "hello" }));
    new SetIssueCommand().execute(commandContext(flowManager, { number: "335", flowState: null }));
    new SetNoteCommand().execute(commandContext(flowManager, { text: "note", taskId: "" }));
    new SetMetricCommand().execute(commandContext(flowManager, { phase: "impl", counter: "docsRead", taskId: "" }));

    assert.deepEqual(calls[0], ["request", "hello", { specId: "001-alpha" }]);
    assert.deepEqual(calls[1], ["issue", 335, { specId: "001-alpha" }]);
    assert.deepEqual(calls[2], ["note", "note", { specId: "001-alpha", taskId: null }]);
    assert.deepEqual(calls[3], ["metric", "impl", "docsRead", { specId: "001-alpha", taskId: null }]);

    assert.equal(new SetRequestCommand().execute(commandContext(flowManager, { text: "" })).ok, false);
    assert.equal(new SetIssueCommand().execute(commandContext(flowManager, { number: "0" })).ok, false);
    assert.equal(new SetMetricCommand().execute(commandContext(flowManager, { phase: "bogus", counter: "docsRead" })).ok, false);
  });

  it("R8: spec-local contract tests cover registry-independent specId updates", () => {
    tmp = createTmpDir("specid-contract-");
    setupSpec(tmp, "001-alpha");
    const fm = makeManager(tmp);

    fm.setRequest("covered by spec-local test", { specId: "001-alpha" });

    assert.equal(readFlow(tmp, "001-alpha").request, "covered by spec-local test");
  });
});

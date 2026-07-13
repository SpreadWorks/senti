import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow, makeFlowManager, makeDefaultTask, replaceFlowState } from "../../../tests/helpers/flow-setup.js";

describe("243: Remove T-pending-spec placeholder", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: FlowStore.load() accepts tasks: [] without throwing", () => {
    tmp = createTmpDir();
    setupFlow(tmp, { tasks: [makeDefaultTask()], currentTaskId: null });
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    state.tasks = [];
    replaceFlowState(tmp, state);
    const reloaded = fm.load();
    assert.ok(Array.isArray(reloaded.tasks));
    assert.equal(reloaded.tasks.length, 0);
  });

  it("R1: FlowStore.load() still rejects missing tasks field", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    tmp = createTmpDir();
    setupFlow(tmp, { tasks: [makeDefaultTask()], currentTaskId: null });
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    delete state.tasks;
    const specId = state.spec.split("/")[1];
    const flowPath = path.join(tmp, "specs", specId, "flow.json");
    fs.writeFileSync(flowPath, JSON.stringify(state, null, 2) + "\n", "utf8");
    assert.throws(() => fm.load(), /tasks/i);
  });

  it("R2: No T-pending-spec reference in run-prepare-spec.js", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const url = await import("node:url");
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const srcRoot = path.resolve(__dirname, "../../../src");
    const content = fs.readFileSync(
      path.join(srcRoot, "flow/lib/run-prepare-spec.js"),
      "utf8",
    );
    assert.ok(
      !content.includes("T-pending-spec"),
      "run-prepare-spec.js should not reference T-pending-spec",
    );
  });

  it("R3: No filterPendingSpecPlaceholder in run-gate.js", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const url = await import("node:url");
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const srcRoot = path.resolve(__dirname, "../../../src");
    const content = fs.readFileSync(
      path.join(srcRoot, "flow/lib/run-gate.js"),
      "utf8",
    );
    assert.ok(
      !content.includes("filterPendingSpecPlaceholder"),
      "run-gate.js should not contain filterPendingSpecPlaceholder",
    );
    assert.ok(
      !content.includes("T-pending-spec"),
      "run-gate.js should not reference T-pending-spec",
    );
  });
});

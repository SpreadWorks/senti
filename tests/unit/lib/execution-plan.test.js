import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExecutionMode, WritePlan } from "../../../src/lib/execution-plan.js";

describe("ExecutionMode and WritePlan", () => {
  it("renders the plan without committing actions in dry-run mode", async () => {
    let commits = 0;
    let output = "";
    const plan = new WritePlan("update files", { preview: "  - docs/overview.md" });
    plan.add("write documentation", () => { commits += 1; });

    await ExecutionMode.fromDryRun(true).execute(plan, {
      write(rendered) { output = rendered; },
    });

    assert.equal(commits, 0);
    assert.match(output, /^DRY-RUN: update files/m);
    assert.match(output, /write documentation/);
    assert.match(output, /docs\/overview\.md/);
  });

  it("commits actions in order without rendering in commit mode", async () => {
    const events = [];
    const plan = new WritePlan("update files");
    plan.add("first write", async () => { events.push("first"); });
    plan.add("second write", async () => { events.push("second"); });

    await ExecutionMode.fromDryRun(false).execute(plan, {
      write() { events.push("render"); },
    });

    assert.deepEqual(events, ["first", "second"]);
  });
});

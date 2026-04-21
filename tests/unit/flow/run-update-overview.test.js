import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { persistOverviewUpdate } from "../../../src/flow/lib/run-update-overview.js";

function makeFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec-207-"));
  const spec = {
    goal: "g",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: {
      modules: [{ text: "src/existing.js" }],
      data_flow: [],
      decisions: [],
    },
    background: "",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
  fs.writeFileSync(path.join(tmp, "spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  return { dir: tmp };
}

const meta = {
  title: "207-test",
  featureBranch: "feature/207-test",
  created: "2026-04-21",
  status: "Draft",
  input: "test",
};

describe("persistOverviewUpdate", () => {
  it("appends additions to spec.json with added_by_task stamped and re-renders spec.md", () => {
    const { dir } = makeFixture();
    const { specJsonPath, specMdPath } = persistOverviewUpdate({
      specDir: dir,
      additions: { modules: ["src/new.js"], data_flow: ["a -> b"], decisions: ["use Z"] },
      taskId: "T9",
      meta,
    });
    const updated = JSON.parse(fs.readFileSync(specJsonPath, "utf8"));
    assert.deepEqual(updated.overview.modules, [
      { text: "src/existing.js" },
      { text: "src/new.js", added_by_task: "T9" },
    ]);
    assert.deepEqual(updated.overview.data_flow, [{ text: "a -> b", added_by_task: "T9" }]);
    assert.deepEqual(updated.overview.decisions, [{ text: "use Z", added_by_task: "T9" }]);

    const md = fs.readFileSync(specMdPath, "utf8");
    const overviewSection = md.slice(md.indexOf("## Overview"), md.indexOf("## Clarifications"));
    assert.ok(overviewSection.includes("- src/existing.js"));
    assert.ok(overviewSection.includes("- src/new.js"));
    assert.ok(overviewSection.includes("- a -> b"));
    assert.ok(overviewSection.includes("- use Z"));
    assert.ok(!md.includes("T9"), "taskId must not leak into rendered markdown");
  });

  it("rejects non-additions-only payloads (removals/modifications)", () => {
    const { dir } = makeFixture();
    assert.throws(
      () =>
        persistOverviewUpdate({
          specDir: dir,
          additions: {
            modules: [],
            data_flow: [],
            decisions: [],
            removals: { modules: [0] },
          },
          taskId: "T9",
          meta,
        }),
      /invalid additions/,
    );
  });

  it("produces byte-identical results on two identical runs (determinism)", () => {
    const { dir: a } = makeFixture();
    const { dir: b } = makeFixture();
    const additions = { modules: ["src/m.js"], data_flow: ["x -> y"], decisions: [] };
    persistOverviewUpdate({ specDir: a, additions, taskId: "T9", meta });
    persistOverviewUpdate({ specDir: b, additions, taskId: "T9", meta });
    const mdA = fs.readFileSync(path.join(a, "spec.md"), "utf8");
    const mdB = fs.readFileSync(path.join(b, "spec.md"), "utf8");
    assert.equal(mdA, mdB);
    const jsonA = fs.readFileSync(path.join(a, "spec.json"), "utf8");
    const jsonB = fs.readFileSync(path.join(b, "spec.json"), "utf8");
    assert.equal(jsonA, jsonB);
  });
});

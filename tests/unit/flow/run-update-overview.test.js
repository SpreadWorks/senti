import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { persistOverviewUpdate } from "../../../src/flow/lib/run-update-overview.js";
import { RenderArtifactSnapshot } from "../../helpers/render-artifact-snapshot.js";

function makeFixture(extras = {}) {
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
    ...extras,
  };
  fs.writeFileSync(path.join(tmp, "spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  return { dir: tmp };
}

function specTask(id, parent = null) {
  return {
    id,
    title: `Task ${id}`,
    goal: `Goal ${id}`,
    parent,
    origin: "plan",
    added_round: 0,
    status: "pending",
  };
}

describe("persistOverviewUpdate", () => {
  it("appends additions to spec.json with added_by_task stamped and re-renders spec.md", () => {
    const { dir } = makeFixture();
    const { specJsonPath, specMdPath } = persistOverviewUpdate({
      specDir: dir,
      additions: { modules: ["src/new.js"], data_flow: ["a -> b"], decisions: ["use Z"] },
      taskId: "T9",
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
        }),
      /invalid additions/,
    );
  });

  it("preserves spec, views, tasks, and flow bytes when render planning rejects", () => {
    const fixtures = [
      { label: "duplicate", tasks: [specTask("T-1"), specTask("T-1")] },
      { label: "unknown-parent", tasks: [specTask("child", "missing")] },
      {
        label: "over-limit",
        tasks: Array.from({ length: 201 }, (_, index) => specTask(`T-${index}`)),
      },
    ];

    for (const fixture of fixtures) {
      const { dir } = makeFixture({ tasks: fixture.tasks });
      const tasksDir = path.join(dir, "tasks");
      fs.mkdirSync(tasksDir, { recursive: true });
      fs.writeFileSync(path.join(dir, "spec.md"), "existing spec view\n");
      fs.writeFileSync(path.join(dir, "flow.json"), `${JSON.stringify({
        specId: "foreign",
        featureBranch: "feature/foreign",
        issue: 999,
      })}\n`);
      fs.writeFileSync(path.join(tasksDir, "existing.md"), "existing task\n");
      fs.writeFileSync(path.join(tasksDir, "orphan.md"), "orphan task\n");
      const snapshot = new RenderArtifactSnapshot(dir);

      assert.throws(
        () => persistOverviewUpdate({
          specDir: dir,
          additions: { modules: ["src/new.js"], data_flow: [], decisions: [] },
          taskId: "T9",
        }),
        /TaskId|duplicate|parent|missing|200|collection/i,
      );
      snapshot.assertUnchanged(fixture.label);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is deterministic within a selected context and isolates directory defaults", () => {
    const { dir: a } = makeFixture();
    const { dir: b } = makeFixture();
    const additions = { modules: ["src/m.js"], data_flow: ["x -> y"], decisions: [] };
    const specJsonA = path.join(a, "spec.json");
    const initialJsonA = fs.readFileSync(specJsonA);

    persistOverviewUpdate({ specDir: a, additions, taskId: "T9" });
    const mdA = fs.readFileSync(path.join(a, "spec.md"), "utf8");
    const jsonA = fs.readFileSync(specJsonA, "utf8");

    fs.writeFileSync(specJsonA, initialJsonA);
    persistOverviewUpdate({ specDir: a, additions, taskId: "T9" });
    assert.equal(fs.readFileSync(path.join(a, "spec.md"), "utf8"), mdA);
    assert.equal(fs.readFileSync(specJsonA, "utf8"), jsonA);

    persistOverviewUpdate({ specDir: b, additions, taskId: "T9" });
    const mdB = fs.readFileSync(path.join(b, "spec.md"), "utf8");
    const jsonB = fs.readFileSync(path.join(b, "spec.json"), "utf8");

    const basenameA = path.basename(a);
    const basenameB = path.basename(b);
    assert.ok(mdA.includes(`# Feature Specification: ${basenameA}`));
    assert.ok(mdA.includes(`**Feature Branch**: \`feature/${basenameA}\``));
    assert.ok(mdB.includes(`# Feature Specification: ${basenameB}`));
    assert.ok(mdB.includes(`**Feature Branch**: \`feature/${basenameB}\``));
    assert.ok(!mdA.includes(basenameB));
    assert.ok(!mdB.includes(basenameA));

    const normalizeSelectedMeta = (markdown, basename) => markdown
      .replace(`# Feature Specification: ${basename}`, "# Feature Specification: <selected>")
      .replace(
        `**Feature Branch**: \`feature/${basename}\``,
        "**Feature Branch**: `feature/<selected>`",
      );
    assert.equal(
      normalizeSelectedMeta(mdA, basenameA),
      normalizeSelectedMeta(mdB, basenameB),
    );
    assert.equal(jsonA, jsonB);
  });
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import RunScenarioValidityCommand from "../../../src/flow/lib/run-scenario-validity.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

test("scenario-validity bypasses implementation-diff preflight only for the latest spec-correction rewind", async () => {
  const root = createTmpDir("scenario-validity-spec-correction-");
  const spec = "specs/demo/spec.json";
  const specDir = path.join(root, "specs", "demo");
  try {
    fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, spec), JSON.stringify({
      requirements: [{ id: "R1", desc: "Exercise the scenario-validity preflight.", priority: "must" }],
    }, null, 2) + "\n");
    fs.writeFileSync(path.join(specDir, "tests", "scenario.test.js"), [
      "// spec: R1",
      "import assert from 'node:assert/strict';",
      "import { test } from 'node:test';",
      "test('R1: expected initial failure', () => assert.fail('expected failure'));",
      "",
    ].join("\n"));
    initGitRepo(root);
    commitAll(root, "Create scenario validity fixture");
    fs.writeFileSync(path.join(root, "src", "already-applied.js"), "export const changed = true;\n");

    const command = new RunScenarioValidityCommand();
    const context = (planRewinds) => ({
      root,
      config: { test: { timeoutSeconds: 5 } },
      flowState: { spec, baseBranch: "main", planRewinds },
    });

    await assert.rejects(
      command.execute(context([])),
      (error) => error?.code === "SCENARIO_VALIDITY_BLOCKED",
    );
    const blocked = JSON.parse(fs.readFileSync(path.join(specDir, "scenario-validity-result.json"), "utf8"));
    assert.deepEqual(blocked.preflight.invalid_paths, ["src/already-applied.js"]);

    const completed = await command.execute(context([{ category: "spec-correction" }]));
    assert.equal(completed.result, "pass");
    assert.equal(completed.artifacts.completed, true);
  } finally {
    removeTmpDir(root);
  }
});

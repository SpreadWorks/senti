import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DirectVerificationCommandResolver,
} from "../../../src/flow/lib/direct-verification-command.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

describe("DirectVerificationCommandResolver", () => {
  const roots = [];

  afterEach(() => {
    for (const root of roots.splice(0)) removeTmpDir(root);
  });

  function fixture() {
    const root = createTmpDir("direct-verification-command-");
    roots.push(root);
    const spec = "specs/direct-command/spec.json";
    fs.mkdirSync(path.dirname(path.join(root, spec)), { recursive: true });
    return { root, spec, state: { spec } };
  }

  it("prefers an explicit override and then prior direct verification", () => {
    const { root, state } = fixture();
    state.directFlowSession = {
      verification: { testCommand: "node --test prior.test.js" },
    };
    const resolver = new DirectVerificationCommandResolver({ root, state });

    assert.deepEqual(resolver.resolve("node --test explicit.test.js").toJSON(), {
      command: "node --test explicit.test.js",
      source: "explicit CLI option",
    });
    assert.deepEqual(resolver.resolve().toJSON(), {
      command: "node --test prior.test.js",
      source: "direct verification history",
    });
  });

  it("reuses a completed final-regression command", () => {
    const { root, spec, state } = fixture();
    fs.writeFileSync(
      path.join(path.dirname(path.join(root, spec)), "final-regression-result.json"),
      JSON.stringify({
        completed: true,
        command: "node tests/run.js",
      }),
    );

    assert.deepEqual(
      new DirectVerificationCommandResolver({ root, state }).resolve().toJSON(),
      {
        command: "node tests/run.js",
        source: "final-regression-result.json",
      },
    );
  });

  it("reuses one requirement-test command when final regression is unavailable", () => {
    const { root, spec, state } = fixture();
    fs.writeFileSync(
      path.join(path.dirname(path.join(root, spec)), "test-execute-result.json"),
      JSON.stringify({
        summary: [
          { evidence: { command: "node --test specs/direct-command/tests/direct.test.js" } },
          { evidence: { command: "node --test specs/direct-command/tests/direct.test.js" } },
        ],
      }),
    );

    assert.deepEqual(
      new DirectVerificationCommandResolver({ root, state }).resolve().toJSON(),
      {
        command: "node --test specs/direct-command/tests/direct.test.js",
        source: "test-execute-result.json",
      },
    );
  });

  it("falls back to project configuration without asking for a known command", () => {
    const { root, state } = fixture();
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
      scripts: { test: "node tests/run.js" },
    }));

    assert.deepEqual(
      new DirectVerificationCommandResolver({ root, state }).resolve().toJSON(),
      {
        command: "npm test --",
        source: "package.json:scripts.test",
      },
    );
  });
});

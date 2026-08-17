/**
 * Spec 152 verification: all callAgent/callAgentAsync call sites use the
 * agent.js logging helpers (callAgentWithLog / callAgentAwaitLog /
 * callAgentAsyncWithLog) so that AgentLog + Logger integration is centralized.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");

const FLOW_TARGETS = [
  "src/flow/commands/review.js",
  "src/flow/lib/run-gate.js",
  "src/flow/lib/run-retro.js",
  "src/flow/lib/get-context.js",
];

const DOCS_TARGETS = [
  "src/docs/commands/text.js",
  "src/docs/commands/forge.js",
  "src/docs/commands/enrich.js",
  "src/docs/commands/init.js",
  "src/docs/commands/translate.js",
  "src/docs/commands/agents.js",
  "src/docs/lib/template-merger.js",
];

const ALL_TARGETS = [...FLOW_TARGETS, ...DOCS_TARGETS];

const HELPER_NAMES = ["callAgentWithLog", "callAgentAwaitLog", "callAgentAsyncWithLog"];

// Flow targets that have access to a flow/state object in scope.
// get-context.js is invoked from a context-search utility that has no flow
// state, so it is allowed to log with spec: null.
const FLOW_TARGETS_WITH_SPEC = [
  "src/flow/commands/review.js",
  "src/flow/lib/run-gate.js",
  "src/flow/lib/run-retro.js",
];

describe("Spec 152: callsite logger coverage", () => {
  for (const target of ALL_TARGETS) {
    it(`${target} imports a logging helper from agent.js`, () => {
      const content = fs.readFileSync(path.join(ROOT, target), "utf8");
      const importRe = /import\s*\{[^}]*\}\s*from\s*["'][^"']*lib\/agent\.js["']/g;
      const importMatches = content.match(importRe) || [];
      const importedHelpers = importMatches.flatMap((m) =>
        HELPER_NAMES.filter((h) => m.includes(h)),
      );
      assert.ok(
        importedHelpers.length > 0,
        `${target} should import one of ${HELPER_NAMES.join(", ")} from agent.js`,
      );
    });

    it(`${target} calls a logging helper`, () => {
      const content = fs.readFileSync(path.join(ROOT, target), "utf8");
      const used = HELPER_NAMES.some((h) => new RegExp(`\\b${h}\\s*\\(`).test(content));
      assert.ok(
        used,
        `${target} should call one of ${HELPER_NAMES.join(", ")}`,
      );
    });

    it(`${target} no longer references AgentLog or Logger directly`, () => {
      const content = fs.readFileSync(path.join(ROOT, target), "utf8");
      assert.ok(
        !content.includes("AgentLog"),
        `${target} should not reference AgentLog directly (use helper)`,
      );
      assert.ok(
        !content.includes("Logger.getInstance()"),
        `${target} should not call Logger.getInstance() directly (use helper)`,
      );
    });
  }

  for (const target of FLOW_TARGETS_WITH_SPEC) {
    it(`${target} passes getSpecName(...) as part of logCtx`, () => {
      const content = fs.readFileSync(path.join(ROOT, target), "utf8");
      assert.ok(
        /spec:\s*getSpecName\(\s*(flow|state)\s*\)/.test(content),
        `${target} should pass spec: getSpecName(flow|state) in logCtx`,
      );
    });
  }

  for (const target of DOCS_TARGETS) {
    it(`${target} passes spec: null in logCtx`, () => {
      const content = fs.readFileSync(path.join(ROOT, target), "utf8");
      // docs call sites have no flow context, so logCtx must include spec: null
      assert.ok(
        /spec:\s*null/.test(content),
        `${target} should pass spec: null in logCtx`,
      );
    });
  }
});

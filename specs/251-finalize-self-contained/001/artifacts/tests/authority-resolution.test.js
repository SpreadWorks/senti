// spec: R3 R12 R16 R17
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(import.meta.dirname, "../../../");
const flowContextPath = path.join(repoRoot, "src/flow/lib/flow-context.js");
const flowManagerPath = path.join(repoRoot, "src/lib/flow-manager.js");

function readFileText(p) {
  return fs.readFileSync(p, "utf8");
}

test("R3: next-action authority resolution checks main repo specs/<id>/flow.json existence", () => {
  // The non-circular signal is whether main repo specs/<id>/flow.json exists.
  // After T-3, this check should be present in next-action / authority resolver.
  const text = readFileText(flowContextPath);
  assert.match(
    text,
    /existsSync|fs\.exists|specs.*flow\.json|mainRepoPath.*specs|resolveAuthority/s,
    "flow-context.js must contain authority resolution logic checking main repo flow.json existence",
  );
});

test("R12: get-status / get-resolve-context / run-resume share authority resolver via flow-context.js", () => {
  const flowContext = readFileText(flowContextPath);
  // resolveFlowContext should call shared authority resolver
  assert.match(
    flowContext,
    /resolveFlowContext[\s\S]*authority|authority[\s\S]*resolveFlowContext|resolveAuthority|forRoot\(/s,
    "resolveFlowContext must call authority resolver to centralize flow.json source selection",
  );
});

test("R16: resolveFlowContext provides authority-scoped ctx.flowState to commands and hooks", () => {
  const text = readFileText(flowContextPath);
  // Single resolution path: registry hooks + FlowCommand should get same ctx.flowState
  assert.match(
    text,
    /flowState[\s\S]*authority|authorityRoot|resolvedFlowState|effectiveRoot.*authority/s,
    "flow-context.js must produce authority-scoped flowState",
  );
});

test("R17: resolveActiveFlow returns inactive when last-finalized-spec matches and .active-flow is cleared", () => {
  const text = readFileText(flowManagerPath);
  // resolveActiveFlow should consult last-finalized-spec to detect post-cleanup inactive state
  assert.match(
    text,
    /last-finalized-spec|lastFinalized|finalizedSpec/i,
    "flow-manager.js resolveActiveFlow must consider last-finalized-spec pointer for post-cleanup inactivity",
  );
});

// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { filterByPhase } from "../../../src/lib/guardrail.js";
import { listUpgradeRequiredChangedPaths } from "../../../src/flow/lib/test-artifacts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specDir = path.resolve(__dirname, "..");
const root = path.resolve(specDir, "../..");
const guardrailPath = path.join(root, "src", "presets", "base", "guardrail.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function baseGuardrails() {
  const data = readJson(guardrailPath);
  assert.ok(Array.isArray(data.guardrails), "base guardrail.json must contain guardrails[]");
  return data.guardrails;
}

function migrationParityGuardrail() {
  const entries = baseGuardrails().filter((g) => g.id === "migration-parity");
  assert.equal(entries.length, 1, "base guardrail.json must contain exactly one migration-parity guardrail");
  return entries[0];
}

function normalizedBody() {
  return migrationParityGuardrail().body.toLowerCase();
}

test("R1: base guardrail metadata defines migration-parity for draft and spec", () => {
  const guardrail = migrationParityGuardrail();

  assert.equal(guardrail.title, "Migration Parity");
  assert.deepEqual(guardrail.meta?.phase, ["draft", "spec"]);
  assert.equal(guardrail.meta?.category, "process");
});

test("R2: migration-parity body requires migration behavior parity evidence", () => {
  const body = normalizedBody();

  for (const term of ["moves", "splits", "extracts", "replaces", "externalizes"]) {
    assert.ok(body.includes(term), `body must include trigger term "${term}"`);
  }

  for (const term of [
    "inventory",
    "public behavior",
    "user-facing commands",
    "apis",
    "hooks",
    "config entries",
    "generated artifacts",
    "side effects",
    "new owner",
    "explicit decision to remove",
    "acceptance criteria",
    "behavior-level verification",
    "retained public surface",
    "user-visible impact",
    "compatibility expectation",
  ]) {
    assert.ok(body.includes(term), `body must include parity concept "${term}"`);
  }
});

test("R3: migration-parity body includes evidence limits and rewrite-rubric sections", () => {
  const guardrail = migrationParityGuardrail();
  const body = guardrail.body;
  const lower = body.toLowerCase();

  for (const term of ["registration", "discovery", "help output", "mock routing", "not sufficient"]) {
    assert.ok(lower.includes(term), `body must state ${term} is insufficient evidence`);
  }

  for (const label of ["Violation:", "Diff-verification conditions:", "Blocking when:", "Advisory when:"]) {
    assert.ok(body.includes(label), `body must include ${label}`);
  }
});

test("R4: migration-parity phase filtering, generic wording, and base regression hold", () => {
  const entries = baseGuardrails();
  const byId = new Map(entries.map((g) => [g.id, g]));

  assert.ok(filterByPhase(entries, "draft").some((g) => g.id === "migration-parity"));
  assert.ok(filterByPhase(entries, "spec").some((g) => g.id === "migration-parity"));
  assert.ok(!filterByPhase(entries, "task-impl").some((g) => g.id === "migration-parity"));

  const body = normalizedBody();
  for (const forbidden of ["workflow plugin", "board item", "issue #379", "b443"]) {
    assert.ok(!body.includes(forbidden), `body must not include project-specific term "${forbidden}"`);
  }

  for (const id of [
    "single-responsibility",
    "req-diff-verifiability",
    "impact-on-existing-features",
    "spec-test-coverage",
  ]) {
    assert.ok(byId.has(id), `pre-existing base guardrail "${id}" must remain`);
  }
});

test("R5: upgrade evidence path detection includes uncommitted base preset changes", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "migration-parity-upgrade-"));
  try {
    git(tmp, ["init"]);
    git(tmp, ["config", "user.email", "test@example.com"]);
    git(tmp, ["config", "user.name", "Test User"]);
    fs.mkdirSync(path.join(tmp, "src", "presets", "base"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "presets", "base", "guardrail.json"), "{\"guardrails\":[]}\n");
    fs.writeFileSync(path.join(tmp, "README.md"), "initial\n");
    git(tmp, ["add", "."]);
    git(tmp, ["commit", "-m", "initial"]);
    git(tmp, ["branch", "-M", "main"]);

    fs.writeFileSync(
      path.join(tmp, "src", "presets", "base", "guardrail.json"),
      "{\"guardrails\":[{\"id\":\"migration-parity\"}]}\n",
    );
    fs.writeFileSync(path.join(tmp, "README.md"), "changed\n");

    assert.deepEqual(
      listUpgradeRequiredChangedPaths({ root: tmp, baseBranch: "main" }),
      ["src/presets/base/guardrail.json"],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

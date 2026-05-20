// spec: R6 R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveIncludes } from "../../../src/lib/include.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function readContractText(relPath) {
  const absPath = path.join(ROOT, relPath);
  const text = fs.readFileSync(absPath, "utf8");
  if (!relPath.startsWith("src/templates/skills/")) return text;
  return resolveIncludes(text, {
    baseDir: path.dirname(absPath),
    pkgDir: path.join(ROOT, "src"),
    templatesDir: path.join(ROOT, "src", "templates"),
    presetsDir: path.join(ROOT, "src", "presets"),
    sourceFile: absPath,
  });
}

describe("finalize-cleanup guidance contract", () => {
  it("R6: prompt and skills describe CLI Report display without legacy report-show fallback", () => {
    for (const relPath of [
      "src/flow/prompts/impl/finalize-cleanup.md",
      "src/templates/skills/sdd-forge.flow/SKILL.md",
      ".agents/skills/sdd-forge.flow/SKILL.md",
      ".claude/skills/sdd-forge.flow/SKILL.md",
    ]) {
      const text = readContractText(relPath);
      assert.match(
        text,
        /(?:finalize-cleanup|cleanup command|command itself)[\s\S]{0,160}(?:emits|displays|prints)[\s\S]{0,80}Report/i,
        `${relPath} must describe CLI-owned Report display`,
      );
      assert.doesNotMatch(
        text,
        /sdd-forge flow report show/,
        `${relPath} must not reintroduce the legacy post-cleanup report-show instruction`,
      );
      assert.doesNotMatch(
        text,
        /Place that text verbatim inside a fenced code block|Read `data\.report\.text`[\s\S]{0,120}fenced code block/,
        `${relPath} must not describe manual data.report.text pasting as the sole delivery mechanism`,
      );
    }
  });

  it("R7: spec-local tests declare and name every requirement they cover", () => {
    const testDir = path.join(ROOT, "specs", "261-finalize-report-delivery", "tests");
    const files = fs.readdirSync(testDir).filter((name) => name.endsWith(".test.js"));
    const allText = files.map((name) => fs.readFileSync(path.join(testDir, name), "utf8")).join("\n");

    for (const id of ["R1", "R2", "R3", "R4", "R5", "R6", "R7"]) {
      assert.match(allText, new RegExp(`// spec:.*\\b${id}\\b`), `${id} must appear in a spec header`);
      assert.match(allText, new RegExp(`["']${id}:`), `${id} must have a matching test name`);
    }
    assert.match(
      allText,
      /argv:\s*\[\s*["']--agent-work-dir["']/,
      "R7 must include a fixture that passes --agent-work-dir under the worktree",
    );
    assert.match(
      allText,
      /fs\.rmSync\(worktreeRoot,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/,
      "R7 must include a fixture where cleanup deletes the worktree",
    );
  });
});

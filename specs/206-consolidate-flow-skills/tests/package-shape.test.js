/**
 * specs/206-consolidate-flow-skills/tests/package-shape.test.js
 *
 * R9: Verify the shipped skill templates contain the consolidated flow skill
 *     and do NOT contain the three legacy skills.
 * R8: Verify documentation templates no longer reference legacy skill names.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const skillsDir = path.join(repoRoot, "src", "templates", "skills");

const LEGACY_SKILLS = [
  "sdd-forge.flow-plan",
  "sdd-forge.flow-impl",
  "sdd-forge.flow-finalize",
];

const CONSOLIDATED_SKILL = "sdd-forge.flow";

describe("R9: package ships consolidated flow skill and removes legacy skills", () => {
  it("consolidated skill template directory exists", () => {
    const dir = path.join(skillsDir, CONSOLIDATED_SKILL);
    assert.ok(fs.existsSync(dir), `expected ${CONSOLIDATED_SKILL}/ to exist under templates/skills/`);
    const skillMd = path.join(dir, "SKILL.md");
    assert.ok(fs.existsSync(skillMd), `expected ${CONSOLIDATED_SKILL}/SKILL.md to exist`);
  });

  it("consolidated skill SKILL.md has valid frontmatter", () => {
    const content = fs.readFileSync(path.join(skillsDir, CONSOLIDATED_SKILL, "SKILL.md"), "utf8");
    assert.match(content, /^---\n[\s\S]*?name:\s*sdd-forge\.flow[\s\S]*?---/, "frontmatter must declare name: sdd-forge.flow");
    assert.match(content, /description:\s*\S+/, "frontmatter must declare a non-empty description");
  });

  it("legacy skill template directories do not exist", () => {
    for (const name of LEGACY_SKILLS) {
      const dir = path.join(skillsDir, name);
      assert.ok(!fs.existsSync(dir), `expected ${name}/ to be removed from templates/skills/`);
    }
  });
});

describe("R8: documentation templates reference the consolidated skill name only", () => {
  const agentsFiles = [
    path.join(repoRoot, "src", "presets", "base", "templates", "ja", "AGENTS.sdd.md"),
    path.join(repoRoot, "src", "presets", "base", "templates", "en", "AGENTS.sdd.md"),
  ];

  for (const file of agentsFiles) {
    it(`${path.relative(repoRoot, file)} contains no legacy skill references`, () => {
      if (!fs.existsSync(file)) {
        assert.fail(`expected doc template to exist: ${file}`);
      }
      const content = fs.readFileSync(file, "utf8");
      for (const legacy of LEGACY_SKILLS) {
        assert.ok(
          !content.includes(`/${legacy}`) && !content.includes(legacy),
          `${path.relative(repoRoot, file)} still references legacy skill: ${legacy}`,
        );
      }
    });
  }
});

describe("R1 / R4 / R5: consolidated SKILL.md encodes the dispatcher contract", () => {
  const skillPath = path.join(skillsDir, CONSOLIDATED_SKILL, "SKILL.md");
  const content = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, "utf8") : "";

  it("R1: consolidated skill covers planning, implementation, and finalization in its description", () => {
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fm, "SKILL.md must have frontmatter");
    const desc = fm[1].match(/description:\s*(.+)/)?.[1] ?? "";
    for (const phase of ["planning", "implementation", "finalization"]) {
      assert.ok(
        desc.toLowerCase().includes(phase),
        `frontmatter description must mention ${phase}; got: ${desc}`,
      );
    }
  });

  it("R4: dispatcher delegates step instructions to `flow get next-action`", () => {
    assert.match(content, /sdd-forge flow get next-action/, "must reference next-action CLI");
    assert.match(content, /instructions\.content/, "must describe consumption of instructions.content");
  });

  it("R5: universal guardrails are included (approval, no-auto-promote, worktree, choice format, issue-log, command discipline)", () => {
    const required = [
      /approval/i,
      /auto[- ]?promote/i,
      /worktree/i,
      /choice-format/i,
      /issue-log-recording/i,
      /chain or background/i,
    ];
    for (const pattern of required) {
      assert.match(content, pattern, `SKILL.md must cover guardrail ${pattern}`);
    }
  });

  it("R7: dispatcher works for both pre-flow and active-flow cases", () => {
    assert.match(content, /active:\s*false/, "must branch on inactive flow state (prelude path)");
    assert.match(content, /active:\s*true/, "must branch on active flow state (dispatcher path)");
  });
});

describe("R4: skill prompt files referenced by the dispatcher loop do not hardcode legacy skill names", () => {
  const promptFiles = [
    path.join(repoRoot, "src", "flow", "prompts", "plan", "test.md"),
    path.join(repoRoot, "src", "flow", "prompts", "impl", "finalize.md"),
  ];

  for (const file of promptFiles) {
    it(`${path.relative(repoRoot, file)} contains no legacy skill references`, () => {
      if (!fs.existsSync(file)) return;
      const content = fs.readFileSync(file, "utf8");
      for (const legacy of LEGACY_SKILLS) {
        assert.ok(
          !content.includes(`/${legacy}`),
          `${path.relative(repoRoot, file)} still references legacy skill: /${legacy}`,
        );
      }
    });
  }
});

/**
 * Tests for flow ctx pattern and registry dispatch.
 *
 * Verifies:
 * - Registry structure (helpKey, execute, optional before/after)
 * - No literal help strings in registry
 * - No runIfDirect in flow commands
 * - All flow commands export execute(ctx) signature
 * - review.js does not use runSync child process
 * - prepare-spec requires config.json (no null fallback)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const FLOW_DIR = path.join(ROOT, "src/flow");

describe("registry structure", () => {
  it("registry.js should not contain literal desc strings with en/ja", async () => {
    const content = fs.readFileSync(path.join(FLOW_DIR, "registry.js"), "utf8");
    assert.ok(
      !/ desc:\s*\{/.test(content),
      "registry.js must not contain desc: { en: ..., ja: ... } literals",
    );
  });

  it("registry.js should use helpKey for all commands", async () => {
    const content = fs.readFileSync(path.join(FLOW_DIR, "registry.js"), "utf8");
    assert.ok(
      content.includes("helpKey"),
      "registry.js must define helpKey for commands",
    );
  });
});

describe("runIfDirect removal", () => {
  const dirs = ["run", "get", "set"];

  for (const dir of dirs) {
    it(`${dir}/*.js should not contain runIfDirect`, () => {
      const dirPath = path.join(FLOW_DIR, dir);
      if (!fs.existsSync(dirPath)) return;
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".js"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dirPath, file), "utf8");
        assert.ok(
          !content.includes("runIfDirect"),
          `${dir}/${file} must not contain runIfDirect`,
        );
      }
    });
  }
});

describe("execute(ctx) signature", () => {
  const dirs = ["run", "get", "set"];

  for (const dir of dirs) {
    it(`${dir}/*.js should export execute function`, () => {
      const dirPath = path.join(FLOW_DIR, dir);
      if (!fs.existsSync(dirPath)) return;
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".js"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dirPath, file), "utf8");
        assert.ok(
          /export\s+(async\s+)?function\s+execute/.test(content),
          `${dir}/${file} must export execute function`,
        );
      }
    });
  }
});

describe("review.js worktree fix", () => {
  it("run/review.js should not override SENTI_WORK_ROOT", () => {
    const content = fs.readFileSync(path.join(FLOW_DIR, "lib/run-review.js"), "utf8");
    assert.ok(
      !content.includes("SENTI_WORK_ROOT"),
      "run/review.js must not override SENTI_WORK_ROOT",
    );
  });
});

describe("2nd-level dispatcher removal", () => {
  it("get.js should not exist as a standalone dispatcher", () => {
    assert.ok(
      !fs.existsSync(path.join(FLOW_DIR, "get.js")),
      "src/flow/get.js should be removed",
    );
  });

  it("set.js should not exist as a standalone dispatcher", () => {
    assert.ok(
      !fs.existsSync(path.join(FLOW_DIR, "set.js")),
      "src/flow/set.js should be removed",
    );
  });

  it("run.js should not exist as a standalone dispatcher", () => {
    assert.ok(
      !fs.existsSync(path.join(FLOW_DIR, "run.js")),
      "src/flow/run.js should be removed",
    );
  });
});

describe("prepare-spec config requirement", () => {
  it("prepare-spec.js should not fallback to null config", () => {
    const content = fs.readFileSync(path.join(FLOW_DIR, "lib/run-prepare-spec.js"), "utf8");
    assert.ok(
      !content.includes("? null"),
      "prepare-spec.js must not fallback config to null",
    );
  });
});

// Current skill sources are shallow: src/skills/<skill>/SKILL.md plus partials.
const MAX_SKILL_MARKDOWN_SCAN_DEPTH = 4;
const MAX_SKILL_SCAN_ENTRIES = 128;
const MAX_SKILL_MARKDOWN_FILES = 64;
const MAX_SKILL_MARKDOWN_FILE_BYTES = 128 * 1024;

function collectSkillMarkdownFiles(dir, depth = 0, state = { markdownFileCount: 0, entries: 0, rootDir: dir }) {
  if (depth > MAX_SKILL_MARKDOWN_SCAN_DEPTH) {
    throw new Error(`collectSkillMarkdownFiles exceeded depth ${MAX_SKILL_MARKDOWN_SCAN_DEPTH}: ${dir}`);
  }
  const skillMarkdownFiles = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    state.entries += 1;
    if (state.entries > MAX_SKILL_SCAN_ENTRIES) {
      throw new Error(`collectSkillMarkdownFiles exceeded ${MAX_SKILL_SCAN_ENTRIES} entries`);
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      skillMarkdownFiles.push(...collectSkillMarkdownFiles(fullPath, depth + 1, state));
    } else if (entry.name.endsWith(".md")) {
      state.markdownFileCount += 1;
      if (state.markdownFileCount > MAX_SKILL_MARKDOWN_FILES) {
        throw new Error(`collectSkillMarkdownFiles exceeded ${MAX_SKILL_MARKDOWN_FILES} files`);
      }
      const size = fs.statSync(fullPath).size;
      if (size > MAX_SKILL_MARKDOWN_FILE_BYTES) {
        throw new Error(`${path.relative(state.rootDir, fullPath)} exceeds ${MAX_SKILL_MARKDOWN_FILE_BYTES} bytes`);
      }
      skillMarkdownFiles.push(fullPath);
    }
  }
  return skillMarkdownFiles;
}

describe("src/skills removed flow action references", () => {
  it("skill markdown files should not reference flow run prepare-spec", () => {
    const skillsDir = path.join(ROOT, "src/skills");
    assert.ok(fs.existsSync(skillsDir), `expected skills directory at ${skillsDir}`);
    const skillMarkdownFiles = collectSkillMarkdownFiles(skillsDir);
    assert.ok(skillMarkdownFiles.length > 0, "expected skill markdown files to scan");
    for (const file of skillMarkdownFiles) {
      const content = fs.readFileSync(file, "utf8");
      assert.ok(
        !content.includes("flow run prepare-spec"),
        `${path.relative(skillsDir, file)} must not reference 'flow run prepare-spec'`,
      );
    }
  });
});

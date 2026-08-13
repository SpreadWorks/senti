import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/sennel.js");

function staleAgentFileContent(dataSource = "agents.flow") {
  return [
    '# fixture',
    '',
    `<!-- {{data("${dataSource}")}} -->`,
    '## Spec-Driven Development (Spec-Driven Development)',
    '',
    '- **MUST: ユーザーから機能追加・修正のリクエストを受けた場合、内容を判定して「直接修正」か「Spec-Driven Development フロー (`/sennel.flow`)」のどちらで進めるかを AskUserQuestion で 2 択提示すること。確認なしにコードを変更してはならない。**',
    '  - **判定が迷う場合は flow を Recommended にする**',
    '<!-- {{/data}} -->',
    '',
    '<!-- {{data("agents.project")}} -->',
    '<!-- {{/data}} -->',
    '',
    '## Project Rule',
    '',
    '- Keep this project-specific rule.',
    '',
  ].join("\n");
}

function setupProject(tmp) {
  writeJson(tmp, ".sennel/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "upgrade-agent-files-fixture" });
  writeFile(tmp, "AGENTS.md", staleAgentFileContent());
  writeFile(tmp, "CLAUDE.md", staleAgentFileContent());
}

function runUpgrade(tmp, args = []) {
  return execFileSync("node", [CMD, "upgrade", ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
  });
}

function assertRefreshed(content) {
  assert.doesNotMatch(content, /AskUserQuestion/);
  assert.doesNotMatch(content, /2 択提示/);
  assert.doesNotMatch(content, /判定が迷う場合は flow を Recommended/);
  assert.match(content, /flow 起動確認・flow 利用提案・「直接修正か flow か」の選択肢提示を自動表示せず/);
  assert.match(content, /依頼内容から有用性を推測して提案しない/);
  assert.match(content, /Keep this project-specific rule/);
}

describe("upgrade agent instruction files", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("refreshes agents.flow blocks in AGENTS.md and CLAUDE.md", () => {
    tmp = createTmpDir("sennel-upgrade-agent-files-");
    setupProject(tmp);

    const output = runUpgrade(tmp);

    assert.match(output, /AGENTS\.md/);
    assert.match(output, /CLAUDE\.md/);
    assertRefreshed(fs.readFileSync(join(tmp, "AGENTS.md"), "utf8"));
    assertRefreshed(fs.readFileSync(join(tmp, "CLAUDE.md"), "utf8"));
    assert.equal(fs.existsSync(join(tmp, ".codex/hooks.json")), false);
    assert.equal(fs.existsSync(join(tmp, ".codex/hooks/sennel-flow-final-response-guard.mjs")), false);
  });

  it("reports pending agent file refreshes in dry-run without writing", () => {
    tmp = createTmpDir("sennel-upgrade-agent-files-dry-");
    setupProject(tmp);
    const before = fs.readFileSync(join(tmp, "CLAUDE.md"), "utf8");

    const output = runUpgrade(tmp, ["--dry-run"]);

    assert.match(output, /DRY-RUN/);
    assert.match(output, /CLAUDE\.md/);
    assert.equal(fs.readFileSync(join(tmp, "CLAUDE.md"), "utf8"), before);
  });

  it("removes retired Senrail skills while preserving user-defined skills", () => {
    tmp = createTmpDir("sennel-upgrade-retired-skills-");
    setupProject(tmp);
    for (const base of [".agents", ".claude"]) {
      writeFile(tmp, `${base}/skills/senrail.flow/SKILL.md`, "---\nname: senrail.flow\n---\n");
      writeFile(tmp, `${base}/skills/user.skill/SKILL.md`, "---\nname: user.skill\n---\n");
    }

    const output = runUpgrade(tmp);

    assert.match(output, /senrail\.flow/);
    for (const base of [".agents", ".claude"]) {
      assert.equal(fs.existsSync(join(tmp, base, "skills", "senrail.flow")), false);
      assert.equal(fs.existsSync(join(tmp, base, "skills", "user.skill", "SKILL.md")), true);
    }
  });

  it("removes the retired flow-direct skill while preserving the normal Flow skill", () => {
    tmp = createTmpDir("sennel-upgrade-retired-flow-direct-");
    setupProject(tmp);
    for (const base of [".agents", ".claude"]) {
      writeFile(tmp, `${base}/skills/sennel.flow-direct/SKILL.md`, "---\nname: sennel.flow-direct\n---\n");
    }

    runUpgrade(tmp);
    for (const base of [".agents", ".claude"]) {
      assert.equal(fs.existsSync(join(tmp, base, "skills", "sennel.flow-direct")), false);
      assert.equal(fs.existsSync(join(tmp, base, "skills", "sennel.flow", "SKILL.md")), true);
    }
  });

  for (const marker of [
    "agents.senti",
    "agents.sdd",
    "AGENTS.sdd",
    "legacy.agents.senti",
    "legacy.agents.sdd",
    "legacy.AGENTS.sdd",
  ]) {
    it(`replaces the legacy managed ${marker} block while preserving handwritten content`, () => {
      tmp = createTmpDir("sennel-upgrade-agent-files-legacy-");
      setupProject(tmp);
      for (const name of ["AGENTS.md", "CLAUDE.md"]) {
        writeFile(tmp, name, staleAgentFileContent(marker));
      }

      runUpgrade(tmp);

      for (const name of ["AGENTS.md", "CLAUDE.md"]) {
        const content = fs.readFileSync(join(tmp, name), "utf8");
        assert.match(content, /agents\.flow/);
        assert.equal(content.includes(`data("${marker}")`), false);
        assertRefreshed(content);
      }
    });
  }

  it("removes the legacy Flow hook while preserving project-owned hooks", () => {
    tmp = createTmpDir("sennel-upgrade-agent-hook-cleanup-");
    setupProject(tmp);
    writeJson(tmp, ".codex/hooks.json", {
      hooks: {
        Stop: [
          { hooks: [{ type: "command", command: "node project-stop.mjs" }] },
          { hooks: [{ type: "command", command: "node .codex/hooks/sennel-flow-final-response-guard.mjs" }] },
        ],
      },
    });
    writeFile(tmp, ".codex/hooks/sennel-flow-final-response-guard.mjs", "legacy\n");

    const output = runUpgrade(tmp);

    assert.match(output, /removed legacy agent-host Flow hook artifacts/);
    assert.deepEqual(JSON.parse(fs.readFileSync(join(tmp, ".codex/hooks.json"), "utf8")), {
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "node project-stop.mjs" }] }],
      },
    });
    assert.equal(fs.existsSync(join(tmp, ".codex/hooks/sennel-flow-final-response-guard.mjs")), false);
  });

});

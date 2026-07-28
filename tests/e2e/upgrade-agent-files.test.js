import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");

function staleAgentFileContent(dataSource = "agents.senti") {
  return [
    '# fixture',
    '',
    `<!-- {{data("${dataSource}")}} -->`,
    '## Spec-Driven Development (Spec-Driven Development)',
    '',
    '- **MUST: ユーザーから機能追加・修正のリクエストを受けた場合、内容を判定して「直接修正」か「Spec-Driven Development フロー (`/senti.flow`)」のどちらで進めるかを AskUserQuestion で 2 択提示すること。確認なしにコードを変更してはならない。**',
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
  writeJson(tmp, ".senti/config.json", {
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
    env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
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

  it("refreshes agents.senti blocks in AGENTS.md and CLAUDE.md", () => {
    tmp = createTmpDir("senti-upgrade-agent-files-");
    setupProject(tmp);

    const output = runUpgrade(tmp);

    assert.match(output, /AGENTS\.md/);
    assert.match(output, /CLAUDE\.md/);
    assertRefreshed(fs.readFileSync(join(tmp, "AGENTS.md"), "utf8"));
    assertRefreshed(fs.readFileSync(join(tmp, "CLAUDE.md"), "utf8"));
    const hooks = JSON.parse(fs.readFileSync(join(tmp, ".codex/hooks.json"), "utf8"));
    assert.equal(hooks.hooks.Stop.length, 1);
    assert.match(hooks.hooks.Stop[0].hooks[0].command, /senti-flow-final-response-guard\.mjs/);
    assert.ok(fs.existsSync(join(tmp, ".codex/hooks/senti-flow-final-response-guard.mjs")));
  });

  it("reports pending agent file refreshes in dry-run without writing", () => {
    tmp = createTmpDir("senti-upgrade-agent-files-dry-");
    setupProject(tmp);
    const before = fs.readFileSync(join(tmp, "CLAUDE.md"), "utf8");

    const output = runUpgrade(tmp, ["--dry-run"]);

    assert.match(output, /DRY-RUN/);
    assert.match(output, /CLAUDE\.md/);
    assert.equal(fs.readFileSync(join(tmp, "CLAUDE.md"), "utf8"), before);
  });

  it("refreshes legacy agents.sdd blocks without rewriting project-owned content", () => {
    tmp = createTmpDir("senti-upgrade-legacy-agent-files-");
    setupProject(tmp);
    writeFile(tmp, "AGENTS.md", `${staleAgentFileContent("agents.sdd")}\nLegacy sdd project note.\n`);

    runUpgrade(tmp);

    const content = fs.readFileSync(join(tmp, "AGENTS.md"), "utf8");
    assertRefreshed(content);
    assert.match(content, /data\("agents\.senti"\)/);
    assert.match(content, /Legacy sdd project note\./);
  });
});

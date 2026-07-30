// spec: R1 R2 R3 R4 R5 R6 R8
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import workflowCommand from "../../../.senti/plugins/workflow/commands/workflow.js";

const SPEC_ID = "001-retro-src";
const SPEC_DIR = path.join("specs", SPEC_ID);

const api = {
  Envelope: {
    ok(type, key, data) {
      return { ok: true, type, key, data };
    },
    fail(type, key, code, message) {
      return { ok: false, type, key, errors: [{ code, messages: [message] }] };
    },
  },
};

const candidates = [
  candidate("src implementation", ["src/flow/lib/example.js"]),
  candidate("legacy lib", ["lib/legacy.js"]),
  candidate("legacy command", ["commands/run.js"]),
  candidate("legacy hook", ["hooks/preflight.js"]),
  candidate("legacy plugin", ["plugin.json"]),
  candidate("legacy defaults", ["config.defaults.json"]),
  candidate("legacy schema", ["config.schema.json"]),
  candidate("docs only", ["docs/guide.js"]),
  candidate("skill only", [".senti/plugins/workflow/skills/senti.workflow/SKILL.md"]),
  candidate("agents only", [".agents/skills/senti.workflow/SKILL.md"]),
  candidate("claude only", [".claude/skills/senti.workflow/SKILL.md"]),
  candidate("spec only", ["specs/001-retro-src/spec-helper.js"]),
  candidate("fixture only", ["fixtures/helper.js"]),
  candidate("singular test dir", ["test/unit/example.js"]),
  candidate("test dir", ["tests/unit/example.js"]),
  candidate("__tests__ dir", ["__tests__/unit/example.js"]),
  candidate("test basename", ["src/flow/lib/example.test.js"]),
  candidate("spec basename", ["src/flow/lib/example.spec.js"]),
  candidate("unsafe absolute", ["/tmp/outside.js"]),
  candidate("unsafe traversal", ["../outside.js"]),
  candidate("outside repository", ["src/flow/lib/outside-link.js"]),
  candidate("untracked", ["src/flow/lib/untracked.js"]),
  candidate("external scope", ["src/flow/lib/example.js"], "external"),
  candidate("empty target", []),
  candidate("too many targets", Array.from({ length: 51 }, (_, index) => `lib/over-limit-${index}.js`)),
];

let tmpRoots = [];

afterEach(() => {
  for (const tmp of tmpRoots.splice(0)) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("workflow retro source-root eligibility", () => {
  test("R1: display treats tracked top-level src production JavaScript as code eligible", async () => {
    const root = fixtureProject();
    const result = await runRetro(root, [SPEC_ID]);

    assert.equal(result.ok, true);
    assertCandidate(result.data.candidates, "src implementation");
    assertNoFilteredReason(result.data.filtered, "src implementation", "non-code-target");
  });

  test("R2: src production JavaScript detection excludes test, spec, docs, fixture, skill, and agent paths", async () => {
    const root = fixtureProject();
    const result = await runRetro(root, [SPEC_ID]);

    assertFiltered(result.data.filtered, "docs only", "non-code-target");
    assertFiltered(result.data.filtered, "skill only", "non-code-target");
    assertFiltered(result.data.filtered, "agents only", "non-code-target");
    assertFiltered(result.data.filtered, "claude only", "non-code-target");
    assertFiltered(result.data.filtered, "spec only", "non-code-target");
    assertFiltered(result.data.filtered, "fixture only", "non-code-target");
    assertFiltered(result.data.filtered, "singular test dir", "non-code-target");
    assertFiltered(result.data.filtered, "test dir", "non-code-target");
    assertFiltered(result.data.filtered, "__tests__ dir", "non-code-target");
    assertFiltered(result.data.filtered, "test basename", "non-code-target");
    assertFiltered(result.data.filtered, "spec basename", "non-code-target");
  });

  test("R3: legacy workflow code paths remain eligible", async () => {
    const root = fixtureProject();
    const result = await runRetro(root, [SPEC_ID]);

    for (const title of ["legacy lib", "legacy command", "legacy hook", "legacy plugin", "legacy defaults", "legacy schema"]) {
      assertCandidate(result.data.candidates, title);
    }
  });

  test("R4: fail-closed prerequisites remain enforced before eligibility", async () => {
    const root = fixtureProject();
    const result = await runRetro(root, [SPEC_ID]);

    assertFiltered(result.data.filtered, "unsafe absolute", "unsafe-target");
    assertFiltered(result.data.filtered, "unsafe traversal", "unsafe-target");
    assertFiltered(result.data.filtered, "outside repository", "unsafe-target");
    assertFiltered(result.data.filtered, "untracked", "untracked");
    assertFiltered(result.data.filtered, "external scope", "scope must be in-project");
    assertFiltered(result.data.filtered, "empty target", "targetPaths must be non-empty");
    assertFiltered(result.data.filtered, "too many targets", "targetPaths-limit exceeded");
  });

  test("R4: tracked-file loading over the cap fails closed before code eligibility", async () => {
    const root = fixtureProject();
    const result = await runRetro(root, [SPEC_ID], { fakeGitLsFilesOverLimit: true });

    assert.deepEqual(result.data.candidates, []);
    assertFiltered(result.data.filtered, "src implementation", "untracked");
    assertNoFilteredReason(result.data.filtered, "src implementation", "non-code-target");
  });

  test("R5: display candidate numbers are addable while filtered numbers are skipped for the same reason", async () => {
    const root = fixtureProject();
    const display = await runRetro(root, [SPEC_ID]);
    const srcNumber = findCandidate(display.data.candidates, "src implementation").number;
    const filteredParityReasons = new Map([
      ["docs only", "non-code-target"],
      ["unsafe absolute", "unsafe-target"],
      ["outside repository", "unsafe-target"],
      ["untracked", "untracked"],
      ["external scope", "scope must be in-project"],
      ["empty target", "targetPaths must be non-empty"],
      ["too many targets", "targetPaths-limit exceeded"],
    ]);
    const filteredByNumber = new Map([...filteredParityReasons.keys()].map((title) => {
      const filtered = findCandidate(display.data.filtered, title);
      assert.match(filtered.reason, new RegExp(escapeRegExp(filteredParityReasons.get(title))));
      return [filtered.number, filtered];
    }));
    const selectedNumbers = [srcNumber, ...filteredByNumber.keys()];

    const add = await runRetro(root, [SPEC_ID, "--add", selectedNumbers.join(",")]);

    assert.equal(add.ok, true);
    assert.deepEqual(add.data.added.map((entry) => entry.sourceTitle), ["src implementation"]);
    assert.equal(add.data.skipped.length, filteredByNumber.size);
    for (const skipped of add.data.skipped) {
      const displayFiltered = filteredByNumber.get(skipped.number);
      assert.ok(displayFiltered, `unexpected skipped candidate ${skipped.number}`);
      assert.equal(skipped.reason, displayFiltered.reason);
    }
  });

  test("R6: tracked non-code candidates remain non-code even when a src source root is present", async () => {
    const root = fixtureProject();
    const result = await runRetro(root, [SPEC_ID]);

    for (const title of ["docs only", "skill only", "agents only", "claude only", "spec only", "fixture only", "singular test dir", "test dir", "__tests__ dir", "test basename", "spec basename"]) {
      assertFiltered(result.data.filtered, title, "non-code-target");
    }
  });

  test("R8: cached retro display and add include src/flow/lib/example.js instead of filtering or skipping it", async () => {
    const root = fixtureProject();
    const first = await runRetro(root, [SPEC_ID]);
    const second = await runRetro(root, [SPEC_ID]);
    const src = findCandidate(second.data.candidates, "src implementation");

    assert.deepEqual(first.data.candidates.map((entry) => entry.number), second.data.candidates.map((entry) => entry.number));
    assert.equal(src.targetPaths.length, 1);
    assert.equal(src.targetPaths[0], "src/flow/lib/example.js");
    assertNoFilteredReason(second.data.filtered, "src implementation", "non-code-target");

    const add = await runRetro(root, [SPEC_ID, "--add", String(src.number)]);
    assert.equal(add.data.added.length, 1);
    assert.equal(add.data.added[0].sourceTitle, "src implementation");
    assert.deepEqual(add.data.skipped, []);
  });
});

function candidate(title, targetPaths, scope = "in-project") {
  return {
    title,
    body: `${title} body`,
    labels: ["enhancement"],
    rationale: `${title} rationale`,
    phenomenon: `${title} phenomenon`,
    problem: `${title} problem`,
    proposal: `${title} proposal`,
    targetPaths,
    evidence: [`${title} evidence`],
    scope,
    verification: ["node --test"],
  };
}

function fixtureProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retro-src-root-"));
  tmpRoots.push(root);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });

  writeRetroCache(root);
  for (const file of trackedFixtureFiles()) writeFile(root, file, file.endsWith(".json") ? "{}\n" : `${file}\n`);
  writeOutsideRepositorySymlink(root);
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  return root;
}

function trackedFixtureFiles() {
  return [
    "src/flow/lib/example.js",
    "src/flow/lib/example.test.js",
    "src/flow/lib/example.spec.js",
    "lib/legacy.js",
    "commands/run.js",
    "hooks/preflight.js",
    "plugin.json",
    "config.defaults.json",
    "config.schema.json",
    "docs/guide.js",
    ".senti/plugins/workflow/skills/senti.workflow/SKILL.md",
    ".agents/skills/senti.workflow/SKILL.md",
    ".claude/skills/senti.workflow/SKILL.md",
    "specs/001-retro-src/spec-helper.js",
    "fixtures/helper.js",
    "test/unit/example.js",
    "tests/unit/example.js",
    "__tests__/unit/example.js",
    ...Array.from({ length: 51 }, (_, index) => `lib/over-limit-${index}.js`),
  ];
}

function writeRetroCache(root) {
  const specDir = path.join(root, SPEC_DIR);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "ideas.json"), JSON.stringify({ candidates }, null, 2) + "\n");
}

function writeFile(root, relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function writeOutsideRepositorySymlink(root) {
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "retro-src-outside-"));
  tmpRoots.push(outsideRoot);
  const outsideFile = path.join(outsideRoot, "outside.js");
  fs.writeFileSync(outsideFile, "outside\n");
  const link = path.join(root, "src/flow/lib/outside-link.js");
  fs.symlinkSync(outsideFile, link);
}

async function runRetro(root, argv, options = {}) {
  const boardAdds = [];
  const originalPath = process.env.PATH;
  if (options.fakeGitLsFilesOverLimit) process.env.PATH = `${fakeGitLsFilesOverLimit(root)}${path.delimiter}${originalPath}`;
  try {
    const result = await workflowCommand(api).main(["retro", ...argv], {
      project: { root },
      clients: {
        board: {
          async add(input) {
            const entry = {
              id: `item-${boardAdds.length + 1}`,
              sourceTitle: input.title,
              title: input.title,
              body: input.body,
              category: input.category,
            };
            boardAdds.push(entry);
            return entry;
          },
        },
        agent: {
          resolve() {
            return false;
          },
          async call() {
            throw new Error("retro cache should avoid agent calls");
          },
        },
      },
    });
    return result;
  } finally {
    process.env.PATH = originalPath;
  }
}

function fakeGitLsFilesOverLimit(root) {
  const bin = path.join(root, "fake-bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = path.join(bin, "git");
  fs.writeFileSync(git, `#!/bin/sh
if [ "$1" = "ls-files" ]; then
  i=0
  while [ "$i" -le 50000 ]; do
    printf 'src/overflow-%s.js\\0' "$i"
    i=$((i + 1))
  done
  exit 0
fi
exec /usr/bin/git "$@"
`);
  fs.chmodSync(git, 0o755);
  return bin;
}

function findCandidate(entries, title) {
  const found = entries.find((entry) => entry.title === title);
  assert.ok(found, `expected ${title}`);
  return found;
}

function assertCandidate(entries, title) {
  findCandidate(entries, title);
}

function assertFiltered(entries, title, reason) {
  const found = findCandidate(entries, title);
  assert.match(found.reason, new RegExp(escapeRegExp(reason)));
}

function assertNoFilteredReason(entries, title, reason) {
  const found = entries.find((entry) => entry.title === title);
  if (found) assert.doesNotMatch(found.reason, new RegExp(escapeRegExp(reason)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../support/builders/tmp-dir.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..", "..");
const FILL_SCRIPT = join(REPO_ROOT, "specs", "167-metrics-token-difficulty", "001", "artifacts", "migration", "legacy-files", "fill-flow-counts.js");

describe("fill-flow-counts script", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("supports --spec and --dry-run for flow.json backfill", () => {
    tmp = createTmpDir("sennel-fill-flow-counts-");
    writeFile(tmp, "src/.keep", "");
    writeFile(tmp, "specs/alpha/review.md", [
      "# Code Review Results",
      "",
      "### [x] 1. one",
      "### [ ] 2. two",
    ].join("\n"));
    writeJson(tmp, "specs/alpha/issue-log.json", {
      entries: [{ step: "draft", reason: "r1" }, { step: "impl", reason: "r2" }],
    });
    writeJson(tmp, "specs/alpha/flow.json", {
      request: "hello request",
      metrics: {
        draft: {},
      },
    });

    const out = execFileSync("node", [FILL_SCRIPT, "--spec", "alpha", "--dry-run"], {
      cwd: tmp,
      encoding: "utf8",
    });

    assert.match(out, /would update/i);
    assert.match(out, /reviewCount=\{spec:2,test:0,impl:0\}/i);
    assert.match(out, /redoCount=2/i);
    assert.match(out, /metrics\.draft\.question=0/i);
    assert.match(out, /requestChars=13/i);

    const flow = JSON.parse(readFileSync(join(tmp, "specs/alpha/flow.json"), "utf8"));
    assert.equal(flow.reviewCount, undefined, "dry-run must not modify flow.json");
    assert.equal(flow.redoCount, undefined, "dry-run must not modify flow.json");
  });

  it("fills qaCount/requestChars on write and does not overwrite existing values", () => {
    tmp = createTmpDir("sennel-fill-flow-counts-write-");
    writeFile(tmp, "src/.keep", "");
    writeFile(tmp, "specs/beta/qa.md", [
      "# Clarification Q&A",
      "",
      "- Q: one",
      "  - A: a",
      "- Q: two",
      "  - A: b",
    ].join("\n"));
    writeJson(tmp, "specs/beta/flow.json", {
      request: "abcde",
      requestChars: 999,
      metrics: {
        draft: { question: 7 },
      },
    });

    const out = execFileSync("node", [FILL_SCRIPT, "--spec", "beta"], {
      cwd: tmp,
      encoding: "utf8",
    });

    assert.match(out, /updated/i);
    assert.doesNotMatch(out, /metrics\.draft\.question=/i, "existing question should not be overwritten");
    assert.doesNotMatch(out, /requestChars=/i, "existing requestChars should not be overwritten");

    const flow = JSON.parse(readFileSync(join(tmp, "specs/beta/flow.json"), "utf8"));
    assert.equal(flow.metrics.draft.question, 7);
    assert.equal(flow.requestChars, 999);
    assert.deepEqual(flow.reviewCount, { spec: 0, test: 0, impl: 0 });
    assert.equal(flow.redoCount, 0);
  });
});

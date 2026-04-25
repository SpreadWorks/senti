import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// spec 229: prompt 内容検証
// R4: リサーチ→自己検証→質問生成手順, R5: コミュニケーションルール, R6: フィールドマッピング

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, "../../../src/flow/prompts");

function readPrompt(relPath) {
  return fs.readFileSync(path.join(PROMPTS_DIR, relPath), "utf8");
}

describe("draft prompt (plan/draft.md) — R4: research-before-asking", () => {
  it("contains instruction to investigate code before asking questions", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /investigat|調査|research|検証.*前/i.test(text),
      "draft prompt must contain research-before-asking instruction",
    );
  });

  it("contains instruction to verify assumptions before generating questions", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /verif|前提.*検証|assumption/i.test(text),
      "draft prompt must contain assumption verification instruction",
    );
  });
});

describe("draft prompt (plan/draft.md) — R5: communication rules", () => {
  it("contains language consistency rule", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /config\.lang|言語.*混在|language.*mix/i.test(text),
      "draft prompt must contain language consistency rule",
    );
  });

  it("contains term definition rule", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /定義.*添|未定義.*禁止|definition|technical term/i.test(text),
      "draft prompt must contain term definition rule",
    );
  });

  it("contains question self-containment rule", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /自己完結|self.contain|単独.*理解|standalone/i.test(text),
      "draft prompt must contain question self-containment rule",
    );
  });
});

describe("draft prompt (plan/draft.md) — R1: JSON format", () => {
  it("references draft.json (not draft.md as the artifact)", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /draft\.json/i.test(text),
      "draft prompt must reference draft.json",
    );
  });

  it("contains JSON schema or field description for draft.json", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /devType|analysis.*problem|evidence.*why.*considered/i.test(text),
      "draft prompt must describe draft.json fields",
    );
  });
});

describe("spec prompt (plan/spec.md) — R6: structured transfer rules", () => {
  it("contains field mapping from draft.json to spec.json", () => {
    const text = readPrompt("plan/spec.md");
    assert.ok(
      /draft\.json|field.*mapp|フィールド.*マッピング|転記/i.test(text),
      "spec prompt must contain draft.json transfer rules",
    );
  });

  it("maps qa evidence to decisions", () => {
    const text = readPrompt("plan/spec.md");
    assert.ok(
      /evidence.*decision|qa.*decision|evidence/i.test(text),
      "spec prompt must map qa evidence to decisions",
    );
  });
});

describe("gate-draft prompt (plan/gate-draft.md) — draft.json reference", () => {
  it("references draft.json", () => {
    const text = readPrompt("plan/gate-draft.md");
    assert.ok(
      /draft\.json/i.test(text),
      "gate-draft prompt must reference draft.json",
    );
  });
});

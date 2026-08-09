import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const TEMPLATE_DIR = path.join(process.cwd(), "src/presets/base/templates");

function readTemplate(lang) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, lang, "flow-agent-instructions.md"), "utf8");
}

describe("flow-agent-instructions start policy", () => {
  it("uses the role-based template name and does not ship an AGENTS.senrail template", () => {
    for (const lang of ["en", "ja"]) {
      assert.equal(fs.existsSync(path.join(TEMPLATE_DIR, lang, "flow-agent-instructions.md")), true);
      assert.equal(fs.existsSync(path.join(TEMPLATE_DIR, lang, "AGENTS.senrail.md")), false);
    }
  });

  it("Japanese template forbids proactive flow suggestions for ordinary fix requests", () => {
    const text = readTemplate("ja");

    assert.match(text, /flow 起動確認・flow 利用提案・「直接修正か flow か」の選択肢提示を自動表示せず/);
    assert.match(text, /依頼内容から有用性を推測して提案しない/);
    assert.doesNotMatch(text, /flow が有用な依頼では選択肢として提案してよい/);
  });

  it("English template forbids proactive flow suggestions for ordinary fix requests", () => {
    const text = readTemplate("en");

    assert.match(text, /without automatic flow-start confirmation, flow-use suggestions, or "direct editing vs flow" choices/);
    assert.match(text, /Do not infer usefulness from the request and suggest the flow proactively/);
    assert.doesNotMatch(text, /If a request would benefit from the flow, suggest it as an option/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../../src/lib/config.js";

function baseConfig() {
  return {
    lang: "en",
    type: "sample-node-command",
    docs: { languages: ["en"], defaultLanguage: "en" },
  };
}

describe("081: validateConfig — commands and flow.push", () => {
  it("accepts config with commands.gh: enable", () => {
    const cfg = { ...baseConfig(), commands: { gh: "enable" } };
    assert.doesNotThrow(() => validate(cfg));
  });

  it("accepts config with commands.gh: disable", () => {
    const cfg = { ...baseConfig(), commands: { gh: "disable" } };
    assert.doesNotThrow(() => validate(cfg));
  });

  it("rejects commands.gh with invalid value", () => {
    const cfg = { ...baseConfig(), commands: { gh: "yes" } };
    assert.throws(() => validate(cfg), /commands\.gh/);
  });

  it("accepts config without commands section", () => {
    const cfg = baseConfig();
    assert.doesNotThrow(() => validate(cfg));
  });

  it("accepts config with flow.push.remote", () => {
    const cfg = { ...baseConfig(), flow: { push: { remote: "upstream" } } };
    assert.doesNotThrow(() => validate(cfg));
  });

  it("rejects flow.push.remote with non-string value", () => {
    const cfg = { ...baseConfig(), flow: { push: { remote: 123 } } };
    assert.throws(() => validate(cfg), /flow\.push\.remote/);
  });

  it("accepts flow with both merge and push", () => {
    const cfg = {
      ...baseConfig(),
      flow: { merge: "squash", push: { remote: "origin" } },
    };
    assert.doesNotThrow(() => validate(cfg));
  });
});

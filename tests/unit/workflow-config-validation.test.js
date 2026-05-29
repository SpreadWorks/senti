import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate as validateConfig } from "../../src/lib/config.js";

const baseConfig = {
  lang: "ja",
  type: "node-cli",
  docs: {
    languages: ["ja"],
    defaultLanguage: "ja",
  },
};

describe("config validation: workflow", () => {
  it("accepts config without a workflow section", () => {
    assert.doesNotThrow(() => validateConfig(baseConfig));
  });

  it("accepts workflow.languages with source and publish", () => {
    const cfg = {
      ...baseConfig,
      workflow: { languages: { source: "ja", publish: "en" } },
    };
    assert.doesNotThrow(() => validateConfig(cfg));
  });

  it("accepts workflow without languages (uses fallback)", () => {
    const cfg = { ...baseConfig, workflow: {} };
    assert.doesNotThrow(() => validateConfig(cfg));
  });

  it("rejects non-string workflow.languages.source", () => {
    const cfg = {
      ...baseConfig,
      workflow: { languages: { source: 123 } },
    };
    assert.throws(() => validateConfig(cfg), /workflow\.languages\.source/);
  });

  it("rejects non-string workflow.languages.publish", () => {
    const cfg = {
      ...baseConfig,
      workflow: { languages: { publish: true } },
    };
    assert.throws(() => validateConfig(cfg), /workflow\.languages\.publish/);
  });

  it("rejects non-object workflow", () => {
    const cfg = { ...baseConfig, workflow: "yes" };
    assert.throws(() => validateConfig(cfg), /workflow/);
  });

  it("rejects the removed experimental.workflow key", () => {
    const cfg = {
      ...baseConfig,
      experimental: { workflow: { enable: true } },
    };
    assert.throws(() => validateConfig(cfg), /experimental/);
  });
});

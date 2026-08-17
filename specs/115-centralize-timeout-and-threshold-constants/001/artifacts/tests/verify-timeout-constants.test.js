import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SRC = path.join(ROOT, "src");

describe("timeout constant centralization", () => {
  it("DEFAULT_AGENT_TIMEOUT_MS is exported from agent.js", async () => {
    const { DEFAULT_AGENT_TIMEOUT_MS } = await import(path.join(SRC, "lib/agent.js"));
    assert.equal(typeof DEFAULT_AGENT_TIMEOUT_MS, "number");
    assert.equal(DEFAULT_AGENT_TIMEOUT_MS, 300000);
  });

  it("no DEFAULT_AGENT_TIMEOUT * 1000 in code (except JSDoc comments)", () => {
    const files = [
      "docs/commands/text.js",
      "docs/commands/forge.js",
      "docs/commands/translate.js",
      "docs/commands/enrich.js",
      "docs/commands/readme.js",
      "docs/commands/agents.js",
      "lib/agent.js",
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(SRC, file), "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip JSDoc comment lines and the definition line in agent.js
        if (line.trim().startsWith("*") || line.trim().startsWith("//")) continue;
        if (line.includes("export const DEFAULT_AGENT_TIMEOUT_MS")) continue;
        assert.ok(
          !line.includes("DEFAULT_AGENT_TIMEOUT * 1000"),
          `${file}:${i + 1} still has DEFAULT_AGENT_TIMEOUT * 1000`
        );
      }
    }
  });

  it("text.js, forge.js, translate.js do not compute DEFAULT_TIMEOUT_MS from seconds", () => {
    const files = ["docs/commands/text.js", "docs/commands/forge.js", "docs/commands/translate.js"];
    for (const file of files) {
      const content = fs.readFileSync(path.join(SRC, file), "utf8");
      assert.ok(
        !content.includes("DEFAULT_AGENT_TIMEOUT * 1000"),
        `${file} still computes timeout from seconds`
      );
    }
  });
});

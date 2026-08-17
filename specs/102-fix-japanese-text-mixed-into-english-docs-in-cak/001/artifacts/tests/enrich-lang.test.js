import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for enrich.js buildEnrichPrompt language control.
 * Verifies that opts.lang produces explicit language instruction in the prompt.
 */

describe("buildEnrichPrompt language instruction", () => {
  let buildEnrichPrompt;

  const chapters = ["overview", "stack_and_ops"];
  const batch = [
    { index: 0, path: "app/Controller/AppController.php", lines: 50, source: "<?php\nclass AppController {}" },
  ];

  it("includes 'Write summary and detail in English' when lang is 'en'", async () => {
    ({ buildEnrichPrompt } = await import(`${process.cwd()}/src/docs/commands/enrich.js`));
    const prompt = buildEnrichPrompt(chapters, batch, { lang: "en" });
    assert.ok(prompt.includes("Write summary and detail in English"), "should contain English language instruction");
    assert.ok(!prompt.includes("project's primary language"), "should not contain old ambiguous instruction");
  });

  it("includes 'Write summary and detail in Japanese' when lang is 'ja'", async () => {
    ({ buildEnrichPrompt } = await import(`${process.cwd()}/src/docs/commands/enrich.js`));
    const prompt = buildEnrichPrompt(chapters, batch, { lang: "ja" });
    assert.ok(prompt.includes("Write summary and detail in Japanese"), "should contain Japanese language instruction");
  });

  it("defaults to English when lang is not provided", async () => {
    ({ buildEnrichPrompt } = await import(`${process.cwd()}/src/docs/commands/enrich.js`));
    const prompt = buildEnrichPrompt(chapters, batch, {});
    assert.ok(prompt.includes("Write summary and detail in English"), "should default to English");
  });

  it("uses language code as-is for unknown languages", async () => {
    ({ buildEnrichPrompt } = await import(`${process.cwd()}/src/docs/commands/enrich.js`));
    const prompt = buildEnrichPrompt(chapters, batch, { lang: "th" });
    assert.ok(prompt.includes("Write summary and detail in th"), "should use code directly for unmapped language");
  });
});

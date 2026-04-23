import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as md from "../../../src/docs/lib/lang/md.js";
import { minify as genericMinify } from "../../../src/docs/lib/minify.js";
import { getLangHandler } from "../../../src/docs/lib/lang-factory.js";

describe("md language handler (spec 225 R4, R5, R6)", () => {
  describe("R5 — lang-factory dispatch", () => {
    it("getLangHandler('any.md') returns the md handler", () => {
      const h = getLangHandler("README.md");
      assert.ok(h, "expected a handler for .md");
      assert.equal(typeof h.minify, "function");
    });

    it("md handler exports preserveBlankLines === true", () => {
      assert.equal(md.preserveBlankLines, true);
    });
  });

  describe("R4 — minify transformations", () => {
    it("removes HTML comment (single line)", () => {
      assert.equal(md.minify("<!-- x -->\n本文").trim(), "本文");
    });

    it("removes HTML comment (multi-line)", () => {
      const out = md.minify("<!--\nhello\nmulti\n-->\n本文");
      assert.ok(!out.includes("hello"));
      assert.ok(out.includes("本文"));
    });

    it("reduces image reference to alt text", () => {
      assert.equal(md.minify("![alt](http://x)").trim(), "alt");
    });

    it("reduces image reference with empty alt to empty string", () => {
      assert.equal(md.minify("![](http://x)").trim(), "");
    });

    it("removes horizontal rule '---' on its own line", () => {
      const out = md.minify("前\n---\n後");
      assert.ok(!out.includes("---"));
      assert.ok(out.includes("前"));
      assert.ok(out.includes("後"));
    });

    it("removes horizontal rule '***' on its own line", () => {
      const out = md.minify("前\n***\n後");
      assert.ok(!out.includes("***"));
    });

    it("removes horizontal rule '___' on its own line", () => {
      const out = md.minify("前\n___\n後");
      assert.ok(!out.includes("___"));
    });

    it("collapses 3+ consecutive newlines to exactly one blank line", () => {
      const out = md.minify("本文\n\n\n\n本文");
      assert.equal(out, "本文\n\n本文");
    });

    it("preserves single blank line between paragraphs", () => {
      const out = md.minify("段落1\n\n段落2");
      assert.equal(out, "段落1\n\n段落2");
    });

    it("removes trailing whitespace on lines", () => {
      const out = md.minify("line with trailing   \nnext");
      assert.ok(!out.includes("trailing   "));
      assert.ok(out.includes("line with trailing"));
    });

    it("preserves <details>...</details> block verbatim", () => {
      const src = "<details><summary>s</summary>中身</details>";
      assert.equal(md.minify(src), src);
    });

    it("preserves multi-line <details> block content", () => {
      const src = "<details>\n<summary>s</summary>\n\n中身\n\n</details>";
      const out = md.minify(src);
      assert.ok(out.includes("<details>"));
      assert.ok(out.includes("</details>"));
      assert.ok(out.includes("中身"));
    });

    it("applies transformations together on a realistic fragment", () => {
      const src = [
        "# Title",
        "",
        "<!-- draft -->",
        "Hello ![logo](logo.png) world   ",
        "",
        "",
        "",
        "---",
        "",
        "End",
      ].join("\n");
      const out = md.minify(src);
      assert.ok(!out.includes("<!--"));
      assert.ok(!out.includes("![logo]"));
      assert.ok(out.includes("logo"));
      assert.ok(!out.includes("---"));
      // No quadruple blank lines, but single blank gap kept
      assert.ok(!out.includes("\n\n\n\n"));
      assert.ok(out.includes("# Title"));
      assert.ok(out.includes("End"));
    });
  });

  describe("R4 — truncate helper", () => {
    it("returns original text when length <= maxChars", () => {
      assert.equal(md.truncate("short", 100), "short");
    });

    it("truncates at default 20,000 chars with suffix", () => {
      const big = "a".repeat(20_500);
      const out = md.truncate(big);
      assert.ok(out.length < big.length);
      assert.ok(out.endsWith("... (truncated)"));
      assert.ok(out.startsWith("a".repeat(100)));
      // head portion is exactly 20000 chars
      assert.ok(out.length >= 20_000);
    });

    it("respects explicit maxChars argument", () => {
      const out = md.truncate("abcdefghij", 5);
      assert.ok(out.startsWith("abcde"));
      assert.ok(out.endsWith("... (truncated)"));
    });

    it("does not touch exact-boundary input", () => {
      const exact = "x".repeat(20_000);
      assert.equal(md.truncate(exact), exact);
    });
  });

  describe("R6 — generic pipeline respects preserveBlankLines", () => {
    it("minify('…', 'x.md') preserves paragraph blank lines", () => {
      const src = "A\n\nB";
      const out = genericMinify(src, "x.md");
      assert.ok(out.includes("A"));
      assert.ok(out.includes("B"));
      // blank line must remain between A and B (generic removeBlankLines would fuse them)
      assert.match(out, /A\n+B/);
      const between = out.substring(out.indexOf("A") + 1, out.indexOf("B"));
      assert.ok(between.includes("\n\n") || between === "\n\n", `expected blank between A and B, got ${JSON.stringify(between)}`);
    });

    it("minify('…', 'x.md') removes HTML comment via md handler", () => {
      const src = "<!-- x -->\nA\n\nB";
      const out = genericMinify(src, "x.md");
      assert.ok(!out.includes("<!--"));
      assert.ok(out.includes("A"));
      assert.ok(out.includes("B"));
    });

    it("minify('code','x.js') still strips all blank lines for handlers without preserveBlankLines", () => {
      const src = "a = 1;\n\n\nb = 2;";
      const out = genericMinify(src, "x.js");
      // legacy behavior: blank lines stripped
      assert.ok(!/\n\n/.test(out));
    });
  });
});

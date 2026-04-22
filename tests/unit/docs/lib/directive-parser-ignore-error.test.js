import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseDirectives,
  resolveDataDirectives,
} from "../../../../src/docs/lib/directive-parser.js";
import { Paragraph } from "../../../../src/docs/lib/renderable.js";

// ---------------------------------------------------------------------------
// {{data(..., {ignoreError: true})}} パラメータ解析
// ---------------------------------------------------------------------------

describe("parseDirectives — data params", () => {
  it("parses ignoreError: true parameter on block data directive", () => {
    const text = [
      "# Title",
      '<!-- {{data("base.monorepo.apps", {ignoreError: true})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    const d = result[0];
    assert.equal(d.type, "data");
    assert.equal(d.preset, "base");
    assert.equal(d.source, "monorepo");
    assert.equal(d.method, "apps");
    assert.deepEqual(d.params, { ignoreError: true });
  });

  it("parses data directive without params (backward compatible)", () => {
    const text = [
      '<!-- {{data("base.project.name")}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].params, {});
  });

  it("parses multiple params on data directive", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {ignoreError: true, maxRows: 10})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].params, { ignoreError: true, maxRows: 10 });
  });

  it("parses ignoreError: true on inline data directive", () => {
    const text =
      '<!-- {{data("base.monorepo.apps", {ignoreError: true})}} --><!-- {{/data}} -->';
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].params, { ignoreError: true });
  });

  it("parses header and footer parameters", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {header: "### Apps", footer: "---", ignoreError: true})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].params, {
      ignoreError: true,
      header: "### Apps",
      footer: "---",
    });
  });

  it("parses \\n in quoted string as newline", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {header: "### Apps\\nOverview:"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].params.header, "### Apps\nOverview:");
  });
});

// ---------------------------------------------------------------------------
// resolveDataDirectives — ignoreError behavior
// ---------------------------------------------------------------------------

describe("resolveDataDirectives — ignoreError", () => {
  it("keeps directive lines and clears content when null + ignoreError=true", () => {
    const text = [
      "# Title",
      '<!-- {{data("base.monorepo.apps", {ignoreError: true})}} -->',
      "old content here",
      "<!-- {{/data}} -->",
      "footer",
    ].join("\n");

    const resolveFn = () => null;
    const result = resolveDataDirectives(text, resolveFn);

    const lines = result.text.split("\n");
    assert.equal(lines[0], "# Title");
    assert.ok(lines[1].includes("monorepo.apps"), "directive open tag preserved");
    assert.equal(lines[2], "<!-- {{/data}} -->");
    assert.equal(lines[3], "footer");
    assert.equal(result.replaced, 1);
  });

  it("does not call onUnresolved when null + ignoreError=true", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {ignoreError: true})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    let unresolvedCalled = false;
    const resolveFn = () => null;
    resolveDataDirectives(text, resolveFn, {
      onUnresolved: () => { unresolvedCalled = true; },
    });

    assert.equal(unresolvedCalled, false);
  });

  it("resolves normally when DataSource returns content and ignoreError=true", () => {
    const text = [
      "# Title",
      '<!-- {{data("base.monorepo.apps", {ignoreError: true})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    const resolveFn = () => new Paragraph("> 対象: Frontend, Backend");
    const result = resolveDataDirectives(text, resolveFn);

    assert.ok(result.text.includes("> 対象: Frontend, Backend"));
    assert.equal(result.replaced, 1);
  });

  it("does not resolve when DataSource returns null without ignoreError", () => {
    const text = [
      "# Title",
      '<!-- {{data("base.monorepo.apps")}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    const resolveFn = () => null;
    const result = resolveDataDirectives(text, resolveFn);

    // Original text should be unchanged
    assert.ok(result.text.includes("monorepo.apps"));
    assert.equal(result.replaced, 0);
  });
});

// ---------------------------------------------------------------------------
// resolveDataDirectives — header / footer
// ---------------------------------------------------------------------------

describe("resolveDataDirectives — header/footer", () => {
  it("outputs header + data + footer when data exists", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {header: "### Apps", footer: "---"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    const resolveFn = () => new Paragraph("| Name |\n| --- |\n| App1 |");
    const result = resolveDataDirectives(text, resolveFn);

    const lines = result.text.split("\n");
    // open tag, header, data lines, footer, close tag
    assert.ok(lines[0].includes("monorepo.apps"), "directive open tag preserved");
    assert.equal(lines[1], "### Apps");
    assert.equal(lines[2], "| Name |");
    assert.equal(lines[3], "| --- |");
    assert.equal(lines[4], "| App1 |");
    assert.equal(lines[5], "---");
    assert.equal(lines[6], "<!-- {{/data}} -->");
    assert.equal(result.replaced, 1);
  });

  it("clears content when data is null + ignoreError + header/footer", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {header: "### Apps", footer: "---", ignoreError: true})}} -->',
      "old content",
      "<!-- {{/data}} -->",
    ].join("\n");

    const resolveFn = () => null;
    const result = resolveDataDirectives(text, resolveFn);

    const lines = result.text.split("\n");
    assert.ok(lines[0].includes("monorepo.apps"), "directive open tag preserved");
    assert.equal(lines[1], "<!-- {{/data}} -->");
    assert.ok(!result.text.includes("old content"), "old content cleared");
    // header/footer values exist in directive attrs but not as content lines
    const contentLines = lines.slice(1, -1);
    assert.ok(!contentLines.includes("### Apps"), "header not output as content");
    assert.equal(result.replaced, 1);
  });

  it("outputs header only when footer is not specified", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {header: "### Apps"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    const resolveFn = () => new Paragraph("content");
    const result = resolveDataDirectives(text, resolveFn);

    const lines = result.text.split("\n");
    assert.ok(lines[0].includes("monorepo.apps"));
    assert.equal(lines[1], "### Apps");
    assert.equal(lines[2], "content");
    assert.equal(lines[3], "<!-- {{/data}} -->");
    assert.equal(result.replaced, 1);
  });

  it("outputs footer only when header is not specified", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {footer: "---"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    const resolveFn = () => new Paragraph("content");
    const result = resolveDataDirectives(text, resolveFn);

    const lines = result.text.split("\n");
    assert.ok(lines[0].includes("monorepo.apps"));
    assert.equal(lines[1], "content");
    assert.equal(lines[2], "---");
    assert.equal(lines[3], "<!-- {{/data}} -->");
    assert.equal(result.replaced, 1);
  });

  it("handles \\n in header as newline in output", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {header: "### Apps\\nOverview:"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    const resolveFn = () => new Paragraph("content");
    const result = resolveDataDirectives(text, resolveFn);

    const lines = result.text.split("\n");
    assert.ok(lines[0].includes("monorepo.apps"));
    assert.equal(lines[1], "### Apps");
    assert.equal(lines[2], "Overview:");
    assert.equal(lines[3], "content");
    assert.equal(result.replaced, 1);
  });

  it("calls onUnresolved when null + header/footer without ignoreError", () => {
    const text = [
      '<!-- {{data("base.monorepo.apps", {header: "### Apps", footer: "---"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");

    let unresolvedCalled = false;
    const resolveFn = () => null;
    const result = resolveDataDirectives(text, resolveFn, {
      onUnresolved: () => { unresolvedCalled = true; },
    });

    assert.equal(unresolvedCalled, true);
    assert.equal(result.replaced, 0);
    assert.ok(result.text.includes("monorepo.apps"), "directive preserved");
  });
});

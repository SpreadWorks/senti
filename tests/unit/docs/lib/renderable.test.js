import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Renderable,
  Table,
  BulletList,
  OrderedList,
  Paragraph,
  CodeBlock,
  Blockquote,
  Heading,
  Fragment,
} from "../../../../src/docs/lib/renderable.js";

// ---------------------------------------------------------------------------
// Exports / inheritance
// ---------------------------------------------------------------------------

describe("Renderable exports", () => {
  it("exports 9 classes (base + 8 concrete)", () => {
    for (const C of [Renderable, Table, BulletList, OrderedList, Paragraph, CodeBlock, Blockquote, Heading, Fragment]) {
      assert.equal(typeof C, "function");
    }
  });

  it("each concrete class extends Renderable", () => {
    assert.ok(new Table(["A"], []) instanceof Renderable);
    assert.ok(new BulletList([]) instanceof Renderable);
    assert.ok(new OrderedList([]) instanceof Renderable);
    assert.ok(new Paragraph("") instanceof Renderable);
    assert.ok(new CodeBlock("", "") instanceof Renderable);
    assert.ok(new Blockquote("") instanceof Renderable);
    assert.ok(new Heading("t", 1) instanceof Renderable);
    assert.ok(new Fragment([]) instanceof Renderable);
  });

  it("base Renderable.toMarkdown() throws when not overridden", () => {
    const r = new Renderable();
    assert.throws(() => r.toMarkdown(), /abstract|not implemented/i);
  });
});

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

describe("Table", () => {
  it("renders header + separator + body", () => {
    const t = new Table(["Name", "Value"], [["a", "1"], ["b", "2"]]);
    assert.equal(
      t.toMarkdown(),
      "| Name | Value |\n| --- | --- |\n| a | 1 |\n| b | 2 |",
    );
  });

  it("allows empty rows (labels only)", () => {
    const t = new Table(["Name"], []);
    assert.equal(t.toMarkdown(), "| Name |\n| --- |\n");
  });

  it("escapes pipe characters in cells and labels", () => {
    const t = new Table(["A|B"], [["x|y"]]);
    const md = t.toMarkdown();
    assert.ok(md.includes("A\\|B"));
    assert.ok(md.includes("x\\|y"));
  });

  it("renders null/undefined cells as em-dash", () => {
    const t = new Table(["A"], [[null], [undefined]]);
    const md = t.toMarkdown();
    assert.ok(md.includes("| — |"));
  });

  it("throws when labels is empty", () => {
    assert.throws(() => new Table([], [["x"]]), /labels/i);
  });

  it("throws when row column count does not match labels", () => {
    assert.throws(
      () => new Table(["A", "B"], [["x"]]),
      /column count|mismatch/i,
    );
  });

  it("renders two-column rows as markdown bullet list items", () => {
    const t = new Table(["Name", "Role"], [["auth", "login"], ["docs", "build"]]);
    assert.equal(t.toMarkdownList(), "- auth: login\n- docs: build");
  });

  it("renders null/undefined list cells as em-dash", () => {
    const t = new Table(["Name", "Role"], [[null, undefined]]);
    assert.equal(t.toMarkdownList(), "- —: —");
  });

  it("throws when list rendering is requested for a non-two-column table", () => {
    assert.throws(
      () => new Table(["A"], [["x"]]).toMarkdownList(),
      /format.*2-column Table/i,
    );
    assert.throws(
      () => new Table(["A", "B", "C"], [["x", "y", "z"]]).toMarkdownList(),
      /format.*2-column Table/i,
    );
  });
});

// ---------------------------------------------------------------------------
// BulletList
// ---------------------------------------------------------------------------

describe("BulletList", () => {
  it("renders string items with '- ' prefix", () => {
    const b = new BulletList(["a", "b", "c"]);
    assert.equal(b.toMarkdown(), "- a\n- b\n- c");
  });

  it("renders empty list as empty string", () => {
    const b = new BulletList([]);
    assert.equal(b.toMarkdown(), "");
  });

  it("indents nested Renderable items by 2 spaces", () => {
    const nested = new Table(["H"], [["v"]]);
    const b = new BulletList(["first", nested]);
    const md = b.toMarkdown();
    const lines = md.split("\n");
    assert.equal(lines[0], "- first");
    assert.equal(lines[1], "- | H |");
    assert.equal(lines[2], "  | --- |");
    assert.equal(lines[3], "  | v |");
  });
});

// ---------------------------------------------------------------------------
// OrderedList
// ---------------------------------------------------------------------------

describe("OrderedList", () => {
  it("renders items with '1. ', '2. ' prefixes", () => {
    const o = new OrderedList(["a", "b", "c"]);
    assert.equal(o.toMarkdown(), "1. a\n2. b\n3. c");
  });

  it("indents nested Renderable items", () => {
    const nested = new Paragraph("hello");
    const o = new OrderedList(["first", nested]);
    const md = o.toMarkdown();
    assert.ok(md.startsWith("1. first\n2. hello"));
  });
});

// ---------------------------------------------------------------------------
// Paragraph
// ---------------------------------------------------------------------------

describe("Paragraph", () => {
  it("renders text as-is", () => {
    const p = new Paragraph("Hello **world**");
    assert.equal(p.toMarkdown(), "Hello **world**");
  });

  it("preserves multi-line text", () => {
    const p = new Paragraph("line 1\nline 2");
    assert.equal(p.toMarkdown(), "line 1\nline 2");
  });
});

// ---------------------------------------------------------------------------
// CodeBlock
// ---------------------------------------------------------------------------

describe("CodeBlock", () => {
  it("fences code with language tag", () => {
    const c = new CodeBlock("const x = 1;", "js");
    assert.equal(c.toMarkdown(), "```js\nconst x = 1;\n```");
  });

  it("fences code without language when lang omitted", () => {
    const c = new CodeBlock("raw text");
    assert.equal(c.toMarkdown(), "```\nraw text\n```");
  });
});

// ---------------------------------------------------------------------------
// Blockquote
// ---------------------------------------------------------------------------

describe("Blockquote", () => {
  it("prefixes each line with '> '", () => {
    const b = new Blockquote("line 1\nline 2");
    assert.equal(b.toMarkdown(), "> line 1\n> line 2");
  });

  it("accepts Renderable as content", () => {
    const b = new Blockquote(new Paragraph("note"));
    assert.equal(b.toMarkdown(), "> note");
  });
});

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

describe("Heading", () => {
  it("renders h1 to h6", () => {
    assert.equal(new Heading("t", 1).toMarkdown(), "# t");
    assert.equal(new Heading("t", 6).toMarkdown(), "###### t");
  });

  it("throws when level is below 1", () => {
    assert.throws(() => new Heading("t", 0), /level/i);
  });

  it("throws when level is above 6", () => {
    assert.throws(() => new Heading("t", 7), /level/i);
  });
});

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

describe("Fragment", () => {
  it("joins string parts with blank-line separator", () => {
    const f = new Fragment(["a", "b"]);
    assert.equal(f.toMarkdown(), "a\n\nb");
  });

  it("joins Renderable parts via toMarkdown()", () => {
    const f = new Fragment([new Paragraph("intro"), new Table(["H"], [["v"]])]);
    assert.equal(
      f.toMarkdown(),
      "intro\n\n| H |\n| --- |\n| v |",
    );
  });

  it("renders empty fragment as empty string", () => {
    const f = new Fragment([]);
    assert.equal(f.toMarkdown(), "");
  });
});

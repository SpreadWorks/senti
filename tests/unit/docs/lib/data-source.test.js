import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "../../../../src/docs/lib/data-source.js";
import { Table } from "../../../../src/docs/lib/renderable.js";

describe("DataSource base class", () => {
  // ---------------------------------------------------------------------------
  // init() / desc()
  // ---------------------------------------------------------------------------

  it("desc() returns fallback when not initialized", () => {
    const ds = new DataSource();
    assert.equal(ds.desc("controllers", "FooController"), "—");
  });

  it("desc() uses injected _desc after init()", () => {
    const ds = new DataSource();
    ds.init({
      desc: (section, key) => `override:${section}.${key}`,
      loadOverrides: () => ({}),
    });
    assert.equal(ds.desc("controllers", "FooController"), "override:controllers.FooController");
  });

  it("desc() returns fallback character from descFactory when no override exists", () => {
    const ds = new DataSource();
    ds.init({
      desc: () => "—",
      loadOverrides: () => ({}),
    });
    assert.equal(ds.desc("missing", "key"), "—");
  });

  // ---------------------------------------------------------------------------
  // mergeDesc()
  // ---------------------------------------------------------------------------

  it("mergeDesc() returns items unchanged when no overrides for section", () => {
    const ds = new DataSource();
    ds.init({ desc: () => "—", loadOverrides: () => ({}) });

    const items = [{ className: "Foo", summary: "original" }];
    const result = ds.mergeDesc(items, "controllers");
    assert.deepEqual(result, items);
  });

  it("mergeDesc() applies override to matching items", () => {
    const ds = new DataSource();
    ds.init({
      desc: () => "—",
      loadOverrides: () => ({
        controllers: { FooController: "Overridden description" },
      }),
    });

    const items = [
      { className: "FooController", summary: "original" },
      { className: "BarController", summary: "stays" },
    ];
    const result = ds.mergeDesc(items, "controllers");
    assert.equal(result[0].summary, "Overridden description");
    assert.equal(result[1].summary, "stays");
  });

  it("mergeDesc() does not mutate original items", () => {
    const ds = new DataSource();
    ds.init({
      desc: () => "—",
      loadOverrides: () => ({
        models: { User: "User model" },
      }),
    });

    const original = { className: "User", summary: "old" };
    const items = [original];
    ds.mergeDesc(items, "models");
    assert.equal(original.summary, "old");
  });

  it("mergeDesc() uses custom keyField", () => {
    const ds = new DataSource();
    ds.init({
      desc: () => "—",
      loadOverrides: () => ({
        routes: { "/api/users": "User API" },
      }),
    });

    const items = [{ path: "/api/users", summary: "old" }];
    const result = ds.mergeDesc(items, "routes", "path");
    assert.equal(result[0].summary, "User API");
  });

  it("mergeDesc() works without _loadOverrides", () => {
    const ds = new DataSource();
    const items = [{ className: "Foo", summary: "ok" }];
    const result = ds.mergeDesc(items, "section");
    assert.deepEqual(result, items);
  });

  // ---------------------------------------------------------------------------
  // overrides()
  // ---------------------------------------------------------------------------

  it("overrides() returns empty object when not initialized", () => {
    const ds = new DataSource();
    assert.deepEqual(ds.overrides(), {});
  });

  it("overrides() returns loaded overrides", () => {
    const ds = new DataSource();
    const data = { controllers: { Foo: "desc" } };
    ds.init({ desc: () => "—", loadOverrides: () => data });
    assert.deepEqual(ds.overrides(), data);
  });

  // ---------------------------------------------------------------------------
  // toRows()
  // ---------------------------------------------------------------------------

  it("toRows() maps items with mapper function", () => {
    const ds = new DataSource();
    const items = [
      { name: "a", count: 1 },
      { name: "b", count: 2 },
    ];
    const rows = ds.toRows(items, (i) => [i.name, i.count]);
    assert.deepEqual(rows, [["a", 1], ["b", 2]]);
  });

  it("toRows() returns empty array for empty items", () => {
    const ds = new DataSource();
    assert.deepEqual(ds.toRows([], (i) => [i]), []);
  });

  // ---------------------------------------------------------------------------
  // toMarkdownTable()
  // ---------------------------------------------------------------------------

  it("toMarkdownTable() returns a Table instance with correct markdown output", () => {
    const ds = new DataSource();
    const rows = [
      ["FooController", "3", "Handles foo"],
      ["BarController", "5", "Handles bar"],
    ];
    const labels = ["Name", "Actions", "Description"];
    const t = ds.toMarkdownTable(rows, labels);

    assert.ok(t instanceof Table);
    const md = t.toMarkdown();
    assert.ok(md.includes("| Name | Actions | Description |"));
    assert.ok(md.includes("| --- | --- | --- |"));
    assert.ok(md.includes("| FooController | 3 | Handles foo |"));
    assert.ok(md.includes("| BarController | 5 | Handles bar |"));
  });

  it("toMarkdownTable() escapes pipe characters in values", () => {
    const ds = new DataSource();
    const t = ds.toMarkdownTable([["a|b", "c"]], ["Col1", "Col2"]);
    assert.ok(t.toMarkdown().includes("a\\|b"));
  });

  it("toMarkdownTable() replaces null/undefined with dash", () => {
    const ds = new DataSource();
    const t = ds.toMarkdownTable([[null, undefined, "ok"]], ["A", "B", "C"]);
    assert.ok(t.toMarkdown().includes("| — | — | ok |"));
  });

  it("toMarkdownTable() handles empty rows", () => {
    const ds = new DataSource();
    const t = ds.toMarkdownTable([], ["A", "B"]);
    const md = t.toMarkdown();
    assert.ok(md.includes("| A | B |"));
    assert.ok(md.includes("| --- | --- |"));
  });

  it("toMarkdownTable() delegates to Table construction", () => {
    const ds = new DataSource();
    const rows = [["x", "1"], ["y", "2"]];
    const labels = ["Name", "Count"];
    assert.equal(
      ds.toMarkdownTable(rows, labels).toMarkdown(),
      new Table(labels, rows).toMarkdown(),
    );
  });
});

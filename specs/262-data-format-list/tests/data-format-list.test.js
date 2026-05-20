// spec: R1 R2 R3 R4 R5 R6 R7 R8
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseDirectives,
  resolveDataDirectives,
} from "../../../src/docs/lib/directive-parser.js";
import {
  Paragraph,
  Table,
} from "../../../src/docs/lib/renderable.js";

function dataDirective(options = "") {
  const suffix = options ? `, {${options}}` : "";
  return [
    `<!-- {{data("base.project.list"${suffix})}} -->`,
    "old content",
    "<!-- {{/data}} -->",
  ].join("\n");
}

function renderedBody(result) {
  return result.text
    .split("\n")
    .slice(1, -1)
    .join("\n");
}

describe("data directive format option", () => {
  it("R1: parser accepts table and list format options for data directives", () => {
    const table = parseDirectives(dataDirective('format: "table"'))[0];
    const list = parseDirectives(dataDirective('format: "list"'))[0];

    assert.equal(table.params.format, "table");
    assert.equal(list.params.format, "list");
  });

  it("R2: format is not forwarded to DataSource resolver params", () => {
    let receivedParams;

    resolveDataDirectives(
      dataDirective('format: "list", labels: "Name|Role", custom: "keep"'),
      (preset, source, method, labels, params) => {
        receivedParams = params;
        return new Table(["Name", "Role"], [["auth", "login"]]);
      },
    );

    assert.deepEqual(receivedParams, { custom: "keep" });
  });

  it("R3: omitted and explicit table format render the existing markdown table", () => {
    const table = new Table(["Name", "Role"], [["auth", "login"], ["docs", "build"]]);
    const omitted = resolveDataDirectives(dataDirective(), () => table);
    const explicit = resolveDataDirectives(dataDirective('format: "table"'), () => table);
    const expected = "| Name | Role |\n| --- | --- |\n| auth | login |\n| docs | build |";

    assert.equal(renderedBody(omitted), expected);
    assert.equal(renderedBody(explicit), expected);
  });

  it("R4: list format renders two-column tables as markdown bullet rows", () => {
    const result = resolveDataDirectives(
      dataDirective('format: "list"'),
      () => new Table(["Name", "Role"], [["auth", "login"], ["docs", "build"]]),
    );

    assert.equal(renderedBody(result), "- auth: login\n- docs: build");
  });

  it("R5: list format rejects non-Table renderables and non-two-column tables", () => {
    assert.throws(
      () => resolveDataDirectives(dataDirective('format: "list"'), () => new Paragraph("plain")),
      /format.*Table/i,
    );
    assert.throws(
      () => resolveDataDirectives(
        dataDirective('format: "list"'),
        () => new Table(["A", "B", "C"], [["a", "b", "c"]]),
      ),
      /format.*2-column Table/i,
    );
  });

  it("R6: unsupported format values throw an explicit error naming the value", () => {
    assert.throws(
      () => resolveDataDirectives(
        dataDirective('format: "grid"'),
        () => new Table(["Name", "Role"], [["auth", "login"]]),
      ),
      /grid/,
    );
  });

  it("R7: resolveDataDirectives applies the same format behavior at the shared expansion boundary", () => {
    const result = resolveDataDirectives(
      dataDirective('format: "list", header: "## Modules", footer: "_done_"'),
      () => new Table(["Name", "Role"], [["auth", "login"]]),
    );

    assert.equal(renderedBody(result), "## Modules\n- auth: login\n_done_");
  });

  it("R8: this spec-local test file declares coverage for every testable requirement", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");

    assert.match(source, /^\/\/ spec: R1 R2 R3 R4 R5 R6 R7 R8/m);
    for (const id of ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]) {
      assert.match(source, new RegExp(`it\\("${id}:`));
    }
  });
});

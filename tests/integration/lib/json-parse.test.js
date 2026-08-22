import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { repairJson } from "../../../src/lib/json-parse.js";

function repairAndParse(input) {
  return JSON.parse(repairJson(input));
}

describe("repairJson — valid JSON", () => {
  it("returns valid JSON unchanged", () => {
    const json = '{"key": "value", "num": 42}';
    assert.deepEqual(repairAndParse(json), { key: "value", num: 42 });
  });

  it("handles nested objects and arrays", () => {
    const json = '{"a": {"b": [1, 2, 3]}, "c": true}';
    assert.deepEqual(repairAndParse(json), { a: { b: [1, 2, 3] }, c: true });
  });

  it("handles empty object", () => {
    assert.deepEqual(repairAndParse("{}"), {});
  });

  it("handles empty array", () => {
    assert.deepEqual(repairAndParse("[]"), []);
  });

  it("handles strings with valid escapes", () => {
    const json = '{"path": "C:\\\\Users\\\\test", "nl": "a\\nb"}';
    const result = repairAndParse(json);
    assert.equal(result.path, "C:\\Users\\test");
    assert.equal(result.nl, "a\nb");
  });
});

describe("repairJson — unescaped quotes", () => {
  it("fixes unescaped quote mid-value", () => {
    const broken = '{"a": "hello "world"}';
    const result = repairAndParse(broken);
    assert.ok(result.a.includes("hello"));
    assert.ok(result.a.includes("world"));
  });

  it('fixes type="" pattern (adjacent unescaped quotes)', () => {
    const broken = '{"detail": "type="" なら空フォーマット", "summary": "ok"}';
    const result = repairAndParse(broken);
    assert.ok(result.detail.includes("type="));
    assert.equal(result.summary, "ok");
  });

  it("fixes multiple unescaped quotes in one value", () => {
    const broken = '{"detail": "use "foo" and "bar" here"}';
    const result = repairAndParse(broken);
    assert.ok(result.detail.includes("foo"));
    assert.ok(result.detail.includes("bar"));
  });

  it("handles enrich-like response with unescaped quotes", () => {
    const broken = '{"controllers": [{"index": 18, "detail": "outputJtactConfirm は type="" なら空フォーマット", "summary": "JASRAC", "chapter": "business_logic", "role": "controller"}]}';
    const result = repairAndParse(broken);
    assert.equal(result.controllers[0].summary, "JASRAC");
    assert.ok(result.controllers[0].detail.includes("type="));
  });
});

describe("repairJson — markdown fences", () => {
  it("strips ```json fences", () => {
    const wrapped = '```json\n{"key": "value"}\n```';
    assert.deepEqual(repairAndParse(wrapped), { key: "value" });
  });

  it("strips ``` fences without language", () => {
    const wrapped = '```\n{"key": "value"}\n```';
    assert.deepEqual(repairAndParse(wrapped), { key: "value" });
  });
});

describe("repairJson — truncated JSON", () => {
  it("completes truncated string", () => {
    const truncated = '{"key": "val';
    const result = repairAndParse(truncated);
    assert.equal(result.key, "val");
  });

  it("completes truncated object (missing })", () => {
    const truncated = '{"a": 1, "b": 2';
    const result = repairAndParse(truncated);
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });

  it("completes truncated array (missing ])", () => {
    const truncated = '{"items": [1, 2, 3';
    const result = repairAndParse(truncated);
    assert.deepEqual(result.items, [1, 2, 3]);
  });

  it("completes deeply nested truncation", () => {
    const truncated = '{"a": {"b": [1, 2';
    const result = repairAndParse(truncated);
    assert.deepEqual(result.a.b, [1, 2]);
  });
});

describe("repairJson — surrounding text", () => {
  it("extracts JSON from surrounding text", () => {
    const text = 'Here is the result: {"key": "value"} and more';
    assert.deepEqual(repairAndParse(text), { key: "value" });
  });

  it("handles text before JSON", () => {
    const text = 'Some preamble\n{"key": "value"}';
    assert.deepEqual(repairAndParse(text), { key: "value" });
  });
});

describe("repairJson — edge cases", () => {
  it("removes invalid escape sequences", () => {
    const broken = '{"code": "value with \\` backtick"}';
    const result = repairAndParse(broken);
    assert.ok(result.code.includes("backtick"));
  });

  it("handles empty string values", () => {
    const json = '{"a": "", "b": "ok"}';
    const result = repairAndParse(json);
    assert.equal(result.a, "");
    assert.equal(result.b, "ok");
  });

  it("handles null, true, false values", () => {
    const json = '{"a": null, "b": true, "c": false}';
    const result = repairAndParse(json);
    assert.equal(result.a, null);
    assert.equal(result.b, true);
    assert.equal(result.c, false);
  });

  it("handles negative numbers and decimals", () => {
    const json = '{"a": -1, "b": 3.14, "c": 1e10}';
    const result = repairAndParse(json);
    assert.equal(result.a, -1);
    assert.equal(result.b, 3.14);
    assert.equal(result.c, 1e10);
  });
});

describe("repairJson — backtick-opened values (issue #159)", () => {
  it("R1/R2: hybrid open backtick / close double-quote (real retro failure pattern)", () => {
    const broken = '{ "note": `paths` サービスに 7 項目が提供され、している。" }';
    const result = repairAndParse(broken);
    assert.ok(typeof result.note === "string");
    assert.ok(result.note.includes("paths"));
    assert.ok(result.note.includes("サービス"));
  });

  it("R5: open backtick / close backtick value", () => {
    const broken = '{ "note": `simple value` }';
    const result = repairAndParse(broken);
    assert.equal(result.note, "simple value");
  });

  it("R3: backticks inside the value body are preserved", () => {
    const broken = '{ "note": `wrap `code` here" }';
    const result = repairAndParse(broken);
    assert.ok(result.note.includes("`code`"));
    assert.ok(result.note.startsWith("wrap"));
  });

  it("R5: multiple backtick-opened values in one object", () => {
    const broken = '{ "a": `first`, "b": `second`, "c": "third" }';
    const result = repairAndParse(broken);
    assert.equal(result.a, "first");
    assert.equal(result.b, "second");
    assert.equal(result.c, "third");
  });

  it("R1/R2: backtick-opened value followed by another field (hybrid close)", () => {
    const broken = '{ "a": `hello", "b": 42 }';
    const result = repairAndParse(broken);
    assert.equal(result.a, "hello");
    assert.equal(result.b, 42);
  });
});

/**
 * Spec verification tests for 159-fix-check-scan-report
 *
 * Tests run from worktree root:
 *   node specs/159-fix-check-scan-report/tests/check-scan-report.test.js
 */

import assert from "assert";
import { groupByExtension, computeCoverage, formatText } from "../../../src/check/commands/scan.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("check-scan-report spec tests\n");

// --- groupByExtension ---
console.log("groupByExtension");

test("件数降順でソートされる", () => {
  const files = ["a.php", "b.php", "c.php", "d.js", "e.js", "f.ts"];
  const result = groupByExtension(files);
  assert.deepStrictEqual(result, [
    { ext: ".php", count: 3 },
    { ext: ".js", count: 2 },
    { ext: ".ts", count: 1 },
  ]);
});

test("件数が同じ場合はアルファベット順", () => {
  const files = ["a.ts", "b.js", "c.ts", "d.js"];
  const result = groupByExtension(files);
  assert.deepStrictEqual(result, [
    { ext: ".js", count: 2 },
    { ext: ".ts", count: 2 },
  ]);
});

test("拡張子なしのファイルは空文字列キーにまとめる", () => {
  const files = ["Makefile", "Dockerfile", "a.js"];
  const result = groupByExtension(files);
  assert.strictEqual(result.find((r) => r.ext === ".js")?.count, 1);
  assert.strictEqual(result.find((r) => r.ext === "")?.count, 2);
});

test("空配列は空配列を返す", () => {
  assert.deepStrictEqual(groupByExtension([]), []);
});

// --- computeCoverage: includeCoverage を返さない ---
console.log("\ncomputeCoverage");

test("戻り値に includeCoverage キーが含まれない", () => {
  // computeCoverage はファイルシステムと analysis.json を必要とするため
  // 関数の戻り値の型だけ確認する（実際の呼び出しは integration テストで）
  // ここでは export されていることと、返値に includeCoverage がないことを
  // モック不要な形で検証する
  assert.strictEqual(typeof computeCoverage, "function", "computeCoverage is exported");
  // 関数の文字列表現に includeCoverage プロパティ生成がないことを確認
  const src = computeCoverage.toString();
  assert.ok(!src.includes("includeCoverage:"), "computeCoverage should not build includeCoverage object");
});

// --- formatText ---
console.log("\nformatText");

const sampleData = {
  dataSourceCoverage: {
    total: 45,
    analyzed: 40,
    uncovered: ["src/Foo.php", "src/Bar.php", "src/Baz.php"],
  },
};

test("出力の先頭に DataSource カバレッジ率が含まれる", () => {
  const output = formatText(sampleData, false);
  const lines = output.split("\n");
  const firstMeaningfulLine = lines.find((l) => l.trim().length > 0);
  assert.ok(
    firstMeaningfulLine.includes("DataSource") && firstMeaningfulLine.includes("45"),
    `Expected first line to contain DataSource coverage, got: ${firstMeaningfulLine}`
  );
});

test("出力に 'Include' が含まれない", () => {
  const output = formatText(sampleData, false);
  assert.ok(!output.includes("Include Coverage"), `Output should not contain 'Include Coverage'`);
});

test("拡張子サマリーがファイルリストより前に出力される", () => {
  const output = formatText(sampleData, false);
  const extSummaryPos = output.indexOf(".php");
  const fileListPos = output.indexOf("src/Foo.php");
  assert.ok(extSummaryPos !== -1, "Extension summary should be present");
  assert.ok(fileListPos !== -1, "File list should be present");
  assert.ok(extSummaryPos < fileListPos, "Extension summary should appear before file list");
});

test("解析漏れ 0 件のとき拡張子サマリーセクションが出力されない", () => {
  const emptyData = {
    dataSourceCoverage: { total: 45, analyzed: 45, uncovered: [] },
  };
  const output = formatText(emptyData, false);
  assert.ok(!output.includes("extension"), `Output should not contain extension section when no uncovered files`);
  assert.ok(!output.includes("Uncovered"), `Output should not contain 'Uncovered' when no uncovered files`);
});

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

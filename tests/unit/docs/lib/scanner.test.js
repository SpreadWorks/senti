import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  findFiles, parseFile, parseJSFile, parsePHPFile,
  collectFiles,
} from "../../../../src/docs/lib/scanner.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../support/builders/tmp-dir.js";

describe("scanner utilities", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("findFiles", () => {
    it("finds matching files in a directory", () => {
      tmp = createTmpDir();
      writeFile(tmp, "src/hello.js", "export function greet() {}");
      writeFile(tmp, "src/readme.txt", "ignored");

      const results = findFiles(`${tmp}/src`, "*.js");
      assert.equal(results.length, 1);
      assert.equal(results[0].fileName, "hello.js");
    });

    it("supports subdirectory scanning", () => {
      tmp = createTmpDir();
      writeFile(tmp, "src/hello.js", "");
      writeFile(tmp, "src/lib/utils.js", "");

      const results = findFiles(`${tmp}/src`, "*.js", [], true);
      assert.equal(results.length, 2);
      const files = results.map((r) => r.relPath);
      assert.ok(files.includes("hello.js"));
      assert.ok(files.includes("lib/utils.js"));
    });

    it("respects exclude list", () => {
      tmp = createTmpDir();
      writeFile(tmp, "src/app.js", "");
      writeFile(tmp, "src/test.js", "");

      const results = findFiles(`${tmp}/src`, "*.js", ["test.js"]);
      assert.equal(results.length, 1);
      assert.equal(results[0].fileName, "app.js");
    });
  });

  describe("parseJSFile", () => {
    it("extracts exported functions", () => {
      tmp = createTmpDir();
      writeFile(tmp, "app.js", [
        "export function start() {}",
        "export async function stop() {}",
        "function internal() {}",
      ].join("\n"));

      const result = parseJSFile(`${tmp}/app.js`);
      assert.ok(result.methods.includes("start"));
      assert.ok(result.methods.includes("stop"));
      assert.ok(result.methods.includes("internal"));
    });
  });

  describe("parsePHPFile", () => {
    it("extracts class name and public methods", () => {
      tmp = createTmpDir();
      writeFile(tmp, "UsersController.php", [
        "<?php",
        "class UsersController extends AppController {",
        "  public function index() {}",
        "  public function view() {}",
        "  private function _helper() {}",
        "}",
      ].join("\n"));

      const result = parsePHPFile(`${tmp}/UsersController.php`);
      assert.equal(result.className, "UsersController");
      assert.equal(result.parentClass, "AppController");
      assert.deepEqual(result.methods, ["index", "view"]);
    });
  });

  describe("parseFile", () => {
    it("dispatches to PHP parser for php lang", () => {
      tmp = createTmpDir();
      writeFile(tmp, "Foo.php", "<?php\nclass Foo { public function bar() {} }");

      const result = parseFile(`${tmp}/Foo.php`, "php");
      assert.equal(result.className, "Foo");
      assert.deepEqual(result.methods, ["bar"]);
    });

    it("dispatches to JS parser for js lang", () => {
      tmp = createTmpDir();
      writeFile(tmp, "foo.js", "export function bar() {}");

      const result = parseFile(`${tmp}/foo.js`, "js");
      assert.ok(result.methods.includes("bar"));
    });
  });

  describe("collectFiles", () => {
    it("keeps recursive double-star patterns recursive when pruning directories", () => {
      tmp = createTmpDir();
      writeFile(tmp, "nested/deeper/file.js", "export {};\n");

      for (const pattern of ["**", "**.js"]) {
        assert.deepEqual(
          collectFiles(tmp, [pattern]).map((file) => file.relPath),
          ["nested/deeper/file.js"],
          pattern,
        );
      }
    });

    it("collects files matching include globs", () => {
      tmp = createTmpDir();
      writeFile(tmp, "src/app.js", "export function app() {}");
      writeFile(tmp, "src/lib/utils.js", "export function util() {}");
      writeFile(tmp, "README.md", "# Readme");

      const results = collectFiles(tmp, ["src/**/*.js"]);
      assert.equal(results.length, 2);
      const files = results.map((r) => r.relPath);
      assert.ok(files.includes("src/app.js"));
      assert.ok(files.includes("src/lib/utils.js"));
    });

    it("excludes files matching exclude globs", () => {
      tmp = createTmpDir();
      writeFile(tmp, "src/app.js", "");
      writeFile(tmp, "src/app.test.js", "");

      const results = collectFiles(tmp, ["src/**/*.js"], ["**/*.test.js"]);
      assert.equal(results.length, 1);
      assert.equal(results[0].relPath, "src/app.js");
    });

    it("returns empty array when no files match", () => {
      tmp = createTmpDir();
      writeFile(tmp, "src/app.js", "");

      const results = collectFiles(tmp, ["**/*.php"]);
      assert.deepEqual(results, []);
    });
  });
});

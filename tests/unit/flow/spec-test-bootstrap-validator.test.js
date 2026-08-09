import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { SpecTestBootstrapValidator } from "../../../src/flow/lib/spec-test-bootstrap-validator.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

function write(file, content = "") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function fixture(source) {
  root = createTmpDir("spec-test-bootstrap-");
  const repositoryRoot = path.join(root, "base");
  const executionRoot = path.join(root, "worktree");
  const canonicalSpecDir = path.join(repositoryRoot, "specs", "001-bootstrap");
  const payloadSpecDir = path.join(executionRoot, ".senrail", "handoffs", "payload");
  write(path.join(payloadSpecDir, "tests", "bootstrap.test.js"), source);
  return {
    repositoryRoot,
    executionRoot,
    canonicalSpecDir,
    payloadSpecDir,
    validate() {
      return new SpecTestBootstrapValidator({
        payloadSpecDir,
        canonicalSpecDir,
        repositoryRoot,
        executionRoot,
      }).validate();
    },
  };
}

test("accepts static imports that exist in the execution checkout", () => {
  const value = fixture([
    "// spec: R1",
    "import value from '../../../src/existing.js';",
    "import test from 'node:test';",
    "test('R1: existing module', () => value);",
    "",
  ].join("\n"));
  write(path.join(value.executionRoot, "src", "existing.js"), "export default true;\n");

  assert.equal(value.validate().ok, true);
});

test("accepts static imports within the declared spec-test payload", () => {
  const value = fixture([
    "// spec: R1",
    "import helper from './support/helper.js';",
    "import test from 'node:test';",
    "test('R1: payload helper', () => helper);",
    "",
  ].join("\n"));
  write(path.join(value.payloadSpecDir, "tests", "support", "helper.js"), "export default true;\n");

  assert.equal(value.validate().ok, true);
});

test("rejects a missing production module before test handoff publication", () => {
  const value = fixture([
    "// spec: R1",
    "import value from '../../../src/not-yet-implemented.js';",
    "import test from 'node:test';",
    "test('R1: future module', () => value);",
    "",
  ].join("\n"));

  const result = value.validate();
  assert.equal(result.ok, false);
  assert.throws(
    () => result.assertValid(),
    /statically imports missing pre-implementation module \.\.\/\.\.\/\.\.\/src\/not-yet-implemented\.js/,
  );
});

test("allows a caught dynamic import to express a future production contract", () => {
  const value = fixture([
    "// spec: R1",
    "import test from 'node:test';",
    "test('R1: future module', async () => {",
    "  const loaded = await import('../../../src/not-yet-implemented.js').catch(() => null);",
    "  if (!loaded) throw new Error('R1 contract is not implemented');",
    "});",
    "",
  ].join("\n"));

  assert.equal(value.validate().ok, true);
});

test("ignores import examples inside comments and template strings", () => {
  const value = fixture([
    "// spec: R1",
    "import test from 'node:test';",
    "/*",
    "import value from '../../../src/comment-example.js';",
    "*/",
    "const example = `",
    "import value from '../../../src/template-example.js';",
    "`;",
    "test('R1: examples are not imports', () => example);",
    "",
  ].join("\n"));

  assert.equal(value.validate().ok, true);
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { minify } from "../../../../src/docs/lib/minify.js";

// ---------------------------------------------------------------------------
// Generic minify (all extensions)
// ---------------------------------------------------------------------------

describe("generic minify", () => {
  it("removes blank lines", () => {
    const code = "line1\n\nline2\n\n\nline3\n";
    const result = minify(code, "file.unknown");
    assert.ok(!result.includes("\n\n"));
    assert.ok(result.includes("line1"));
    assert.ok(result.includes("line2"));
    assert.ok(result.includes("line3"));
  });

  it("removes trailing whitespace", () => {
    const code = "line1   \nline2\t\nline3\n";
    const result = minify(code, "file.unknown");
    assert.ok(!result.match(/[ \t]+\n/));
  });

  it("applies only generic minify for unknown extensions", () => {
    const code = "// this stays\nline1\n\nline2  \n";
    const result = minify(code, "file.xyz");
    assert.ok(result.includes("// this stays"));
  });
});

// ---------------------------------------------------------------------------
// JS/TS minify
// ---------------------------------------------------------------------------

describe("JS/TS minify", () => {
  it("removes line comments", () => {
    const code = "const x = 1; // comment\nconst y = 2;\n";
    const result = minify(code, "file.js");
    assert.ok(!result.includes("// comment"));
    assert.ok(result.includes("const x = 1;"));
    assert.ok(result.includes("const y = 2;"));
  });

  it("removes full-line comments", () => {
    const code = "// full line comment\nconst x = 1;\n";
    const result = minify(code, "file.ts");
    assert.ok(!result.includes("full line comment"));
    assert.ok(result.includes("const x = 1;"));
  });

  it("removes block comments", () => {
    const code = "/* block\ncomment */\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(!result.includes("block"));
    assert.ok(!result.includes("comment */"));
    assert.ok(result.includes("const x = 1;"));
  });

  it("does not remove // inside URLs", () => {
    const code = 'const url = "https://example.com";\n';
    const result = minify(code, "file.js");
    assert.ok(result.includes("https://example.com"));
  });

  it("normalizes indentation from 4 spaces to 2 spaces", () => {
    const code = "function f() {\n    const x = 1;\n        const y = 2;\n}\n";
    const result = minify(code, "file.js");
    assert.ok(result.includes("  const x = 1;"));
    assert.ok(result.includes("    const y = 2;"));
  });

  it("works with .mjs, .cjs, .jsx, .tsx extensions", () => {
    const code = "// comment\nconst x = 1;\n";
    for (const ext of [".mjs", ".cjs", ".jsx", ".tsx"]) {
      const result = minify(code, `file${ext}`);
      assert.ok(!result.includes("// comment"), `failed for ${ext}`);
      assert.ok(result.includes("const x = 1;"), `failed for ${ext}`);
    }
  });
});

// ---------------------------------------------------------------------------
// PHP minify
// ---------------------------------------------------------------------------

describe("PHP minify", () => {
  it("removes // comments", () => {
    const code = '$x = 1; // comment\n$y = 2;\n';
    const result = minify(code, "file.php");
    assert.ok(!result.includes("// comment"));
  });

  it("removes block comments", () => {
    const code = "/* block */\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(!result.includes("block"));
  });

  it("removes # comments", () => {
    const code = "# comment\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(!result.includes("# comment"));
  });

  it("preserves shebang lines", () => {
    const code = "#!/usr/bin/env php\n# comment\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(result.includes("#!/usr/bin/env php"));
    assert.ok(!result.includes("# comment"));
  });

  it("does not remove // inside URLs", () => {
    const code = '$url = "https://example.com";\n';
    const result = minify(code, "file.php");
    assert.ok(result.includes("https://example.com"));
  });
});

// ---------------------------------------------------------------------------
// Python minify
// ---------------------------------------------------------------------------

describe("Python minify", () => {
  it("removes # comments", () => {
    const code = "# comment\nx = 1\n";
    const result = minify(code, "file.py");
    assert.ok(!result.includes("# comment"));
    assert.ok(result.includes("x = 1"));
  });

  it("preserves shebang lines", () => {
    const code = "#!/usr/bin/env python3\n# comment\nx = 1\n";
    const result = minify(code, "file.py");
    assert.ok(result.includes("#!/usr/bin/env python3"));
    assert.ok(!result.includes("# comment"));
  });

  it("does NOT normalize indentation", () => {
    const code = "def f():\n    x = 1\n    if True:\n        y = 2\n";
    const result = minify(code, "file.py");
    assert.ok(result.includes("    x = 1"));
    assert.ok(result.includes("        y = 2"));
  });
});

// ---------------------------------------------------------------------------
// YAML minify
// ---------------------------------------------------------------------------

describe("YAML minify", () => {
  it("removes # comments", () => {
    const code = "# comment\nkey: value\n";
    const result = minify(code, "file.yaml");
    assert.ok(!result.includes("# comment"));
    assert.ok(result.includes("key: value"));
  });

  it("works with .yml extension", () => {
    const code = "# comment\nkey: value\n";
    const result = minify(code, "file.yml");
    assert.ok(!result.includes("# comment"));
  });

  it("preserves shebang lines", () => {
    const code = "#!/usr/bin/env yaml-lint\n# comment\nkey: value\n";
    const result = minify(code, "file.yaml");
    assert.ok(result.includes("#!/usr/bin/env yaml-lint"));
  });

  it("does NOT normalize indentation", () => {
    const code = "root:\n    child:\n        value: 1\n";
    const result = minify(code, "file.yaml");
    assert.ok(result.includes("    child:"));
    assert.ok(result.includes("        value: 1"));
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("minify edge cases", () => {
  it("handles empty string", () => {
    const result = minify("", "file.js");
    assert.equal(result, "");
  });

  it("handles code with only comments", () => {
    const code = "// comment 1\n// comment 2\n/* block */\n";
    const result = minify(code, "file.js");
    assert.equal(result.trim(), "");
  });

  it("handles inline block comments", () => {
    const code = "const x = /* inline */ 1;\n";
    const result = minify(code, "file.js");
    assert.ok(result.includes("const x ="));
    assert.ok(result.includes("1;"));
    assert.ok(!result.includes("inline"));
  });
});

// ---------------------------------------------------------------------------
// Prefix comment preservation (WHY: / HACK: / SECURITY:)
// ---------------------------------------------------------------------------

describe("prefix comment preservation (JS)", () => {
  it("keeps full-line // WHY: comments", () => {
    const code = "// WHY: deliberate choice for cache invariance\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(result.includes("// WHY: deliberate choice for cache invariance"));
    assert.ok(result.includes("const x = 1"));
  });

  it("keeps full-line // HACK: comments", () => {
    const code = "// HACK: workaround for legacy parser bug\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(result.includes("// HACK: workaround for legacy parser bug"));
  });

  it("keeps full-line // SECURITY: comments", () => {
    const code = "// SECURITY: constant-time comparison required\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(result.includes("// SECURITY: constant-time comparison required"));
  });

  it("keeps indented prefix comments", () => {
    const code = "function f() {\n  // WHY: early return for clarity\n  return 1;\n}\n";
    const result = minify(code, "file.js");
    assert.ok(result.includes("// WHY: early return for clarity"));
  });

  it("removes lowercase why: comments", () => {
    const code = "// why: not recognized\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(!result.includes("why: not recognized"));
  });

  it("removes mixed-case Why: comments", () => {
    const code = "// Why: not recognized\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(!result.includes("Why: not recognized"));
  });

  it("removes unknown prefix comments", () => {
    const code = "// TODO: not a recognized prefix\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(!result.includes("TODO: not a recognized prefix"));
  });

  it("removes end-of-line WHY: comments (prefix not preserved in trailing position)", () => {
    const code = "const x = 1; // WHY: trailing\nconst y = 2;\n";
    const result = minify(code, "file.js");
    assert.ok(!result.includes("WHY: trailing"));
    assert.ok(result.includes("const x = 1;"));
  });

  it("keeps prefix comments alongside regular code", () => {
    const code = "// WHY: reasoning here\n// regular comment\nconst x = 1;\n";
    const result = minify(code, "file.js");
    assert.ok(result.includes("// WHY: reasoning here"));
    assert.ok(!result.includes("regular comment"));
  });
});

describe("prefix comment preservation (PHP)", () => {
  it("keeps full-line // WHY: comments", () => {
    const code = "// WHY: business rule override\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(result.includes("// WHY: business rule override"));
  });

  it("keeps full-line # HACK: comments", () => {
    const code = "# HACK: workaround for php 5 compat\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(result.includes("# HACK: workaround for php 5 compat"));
  });

  it("keeps full-line # SECURITY: comments", () => {
    const code = "# SECURITY: sanitize input here\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(result.includes("# SECURITY: sanitize input here"));
  });

  it("removes lowercase # why: comments", () => {
    const code = "# why: not recognized\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(!result.includes("why: not recognized"));
  });

  it("still preserves shebang", () => {
    const code = "#!/usr/bin/env php\n# regular\n$x = 1;\n";
    const result = minify(code, "file.php");
    assert.ok(result.includes("#!/usr/bin/env php"));
    assert.ok(!result.includes("# regular"));
  });
});

describe("prefix comment preservation (Python)", () => {
  it("keeps full-line # WHY: comments", () => {
    const code = "# WHY: chosen for list mutation safety\nx = 1\n";
    const result = minify(code, "file.py");
    assert.ok(result.includes("# WHY: chosen for list mutation safety"));
  });

  it("keeps full-line # HACK: comments", () => {
    const code = "# HACK: workaround for CPython GIL\nx = 1\n";
    const result = minify(code, "file.py");
    assert.ok(result.includes("# HACK: workaround for CPython GIL"));
  });

  it("keeps full-line # SECURITY: comments", () => {
    const code = "# SECURITY: hash with bcrypt\nx = 1\n";
    const result = minify(code, "file.py");
    assert.ok(result.includes("# SECURITY: hash with bcrypt"));
  });

  it("removes lowercase # why: comments", () => {
    const code = "# why: not recognized\nx = 1\n";
    const result = minify(code, "file.py");
    assert.ok(!result.includes("why: not recognized"));
  });

  it("removes end-of-line WHY: comments", () => {
    const code = "x = 1  # WHY: trailing\n";
    const result = minify(code, "file.py");
    assert.ok(!result.includes("WHY: trailing"));
    assert.ok(result.includes("x = 1"));
  });
});

describe("prefix comment preservation (YAML)", () => {
  it("keeps full-line # WHY: comments", () => {
    const code = "# WHY: required for backward compat\nkey: value\n";
    const result = minify(code, "file.yaml");
    assert.ok(result.includes("# WHY: required for backward compat"));
  });

  it("keeps full-line # HACK: comments", () => {
    const code = "# HACK: workaround until issue #42\nkey: value\n";
    const result = minify(code, "file.yml");
    assert.ok(result.includes("# HACK: workaround until issue #42"));
  });

  it("keeps full-line # SECURITY: comments", () => {
    const code = "# SECURITY: never commit secrets\nkey: value\n";
    const result = minify(code, "file.yaml");
    assert.ok(result.includes("# SECURITY: never commit secrets"));
  });

  it("removes lowercase # why: comments", () => {
    const code = "# why: not recognized\nkey: value\n";
    const result = minify(code, "file.yaml");
    assert.ok(!result.includes("why: not recognized"));
  });
});

// ---------------------------------------------------------------------------
// Essential mode
// ---------------------------------------------------------------------------

describe("minify mode:essential", () => {
  const opts = { mode: "essential" };

  it("keeps import statements", () => {
    const code = 'import fs from "fs";\nconst x = 1;\n';
    const result = minify(code, "file.js", opts);
    assert.ok(result.includes('import fs from "fs"'));
  });

  it("keeps export function declarations", () => {
    const code = 'export function loadConfig(root) {\n  const p = senrailConfigPath(root);\n  return validateConfig(raw);\n}\n';
    const result = minify(code, "file.js", opts);
    assert.ok(result.includes("export function loadConfig(root)"));
  });

  it("keeps return statements", () => {
    const code = 'function foo() {\n  const x = calc();\n  return x + 1;\n}\n';
    const result = minify(code, "file.js", opts);
    assert.ok(result.includes("return x + 1"));
  });

  it("keeps throw statements", () => {
    const code = 'function bar() {\n  if (!ok) {\n    throw new Error("fail");\n  }\n  return true;\n}\n';
    const result = minify(code, "file.js", opts);
    assert.ok(result.includes('throw new Error("fail")'));
    assert.ok(result.includes("return true"));
  });

  it("keeps major API calls (fs, path, JSON, process)", () => {
    const code = 'const data = fs.readFileSync(p, "utf8");\nconst parsed = JSON.parse(data);\nconst full = path.join(root, name);\n';
    const result = minify(code, "file.js", opts);
    assert.ok(result.includes("fs.readFileSync"));
    assert.ok(result.includes("JSON.parse"));
    assert.ok(result.includes("path.join"));
  });

  it("removes plain variable assignments and control flow", () => {
    const code = 'const x = 1;\nlet y = "hello";\nif (x > 0) {\n  y = "world";\n}\nfor (const i of arr) {\n  console.log(i);\n}\n';
    const result = minify(code, "file.js", opts);
    assert.ok(!result.includes("const x = 1"));
    assert.ok(!result.includes("if (x > 0)"));
    assert.ok(!result.includes("for (const i"));
  });

  it("keeps export const for constants", () => {
    const code = 'export const DEFAULT_LANG = "en";\nconst internal = 42;\n';
    const result = minify(code, "file.js", opts);
    assert.ok(result.includes('export const DEFAULT_LANG'));
    assert.ok(!result.includes("internal = 42"));
  });

  it("default mode (no opts) is unchanged", () => {
    const code = '// comment\nconst x = 1;\nreturn x;\n';
    const withOpts = minify(code, "file.js");
    assert.ok(!withOpts.includes("// comment"));  // comment removed
    assert.ok(withOpts.includes("const x = 1"));  // code preserved
    assert.ok(withOpts.includes("return x"));
  });

  it("keeps async function and class declarations", () => {
    const code = 'export async function execute(ctx) {\n  const r = await fetch(url);\n  return r;\n}\nexport class Foo {\n}\n';
    const result = minify(code, "file.js", opts);
    assert.ok(result.includes("export async function execute(ctx)"));
    assert.ok(result.includes("export class Foo"));
  });
});

// ---------------------------------------------------------------------------
// Essential mode — PHP
// ---------------------------------------------------------------------------

describe("minify mode:essential (PHP)", () => {
  const opts = { mode: "essential" };

  it("keeps require/include statements", () => {
    const code = '<?php\nrequire_once "vendor/autoload.php";\ninclude "config.php";\n$x = 1;\n';
    const result = minify(code, "file.php", opts);
    assert.ok(result.includes("require_once"));
    assert.ok(result.includes("include"));
  });

  it("keeps use and namespace statements", () => {
    const code = '<?php\nnamespace App\\Controller;\nuse Cake\\Controller\\Controller;\n$logger = new Logger();\n';
    const result = minify(code, "file.php", opts);
    assert.ok(result.includes("namespace App"));
    assert.ok(result.includes("use Cake"));
  });

  it("keeps public/protected/private function declarations", () => {
    const code = '<?php\npublic function index() {\n  $data = $this->Model->find("all");\n  return $data;\n}\nprotected function _helper() {\n  return true;\n}\n';
    const result = minify(code, "file.php", opts);
    assert.ok(result.includes("public function index()"));
    assert.ok(result.includes("protected function _helper()"));
    assert.ok(result.includes("return"));
  });

  it("keeps class declarations", () => {
    const code = '<?php\nclass UsersController extends AppController {\n  public $uses = array();\n}\n';
    const result = minify(code, "file.php", opts);
    assert.ok(result.includes("class UsersController"));
  });

  it("keeps throw and new statements", () => {
    const code = '<?php\nthrow new NotFoundException("Not found");\n$obj = new stdClass();\n';
    const result = minify(code, "file.php", opts);
    assert.ok(result.includes("throw new NotFoundException"));
  });
});

// ---------------------------------------------------------------------------
// Essential mode — Python
// ---------------------------------------------------------------------------

describe("minify mode:essential (Python)", () => {
  const opts = { mode: "essential" };

  it("keeps import and from...import statements", () => {
    const code = 'import os\nfrom pathlib import Path\nx = 1\n';
    const result = minify(code, "file.py", opts);
    assert.ok(result.includes("import os"));
    assert.ok(result.includes("from pathlib import Path"));
  });

  it("keeps def and class declarations", () => {
    const code = 'def process(data):\n    result = transform(data)\n    return result\n\nclass Handler:\n    pass\n';
    const result = minify(code, "file.py", opts);
    assert.ok(result.includes("def process(data)"));
    assert.ok(result.includes("class Handler"));
    assert.ok(result.includes("return result"));
  });

  it("keeps raise and yield statements", () => {
    const code = 'def gen():\n    yield item\n    raise ValueError("bad")\n';
    const result = minify(code, "file.py", opts);
    assert.ok(result.includes("yield item"));
    assert.ok(result.includes("raise ValueError"));
  });
});

// ---------------------------------------------------------------------------
// Essential mode — fallback
// ---------------------------------------------------------------------------

describe("minify mode:essential (fallback)", () => {
  const opts = { mode: "essential" };

  it("falls back to regular minify for YAML", () => {
    const code = '# comment\nkey: value\nnested:\n  child: 1\n';
    const result = minify(code, "file.yaml", opts);
    // YAML has no extractEssential, so falls back to regular minify (comment removal)
    assert.ok(result.includes("key: value"));
    assert.ok(result.includes("child: 1"));
  });

  it("falls back to regular minify for unknown extensions", () => {
    const code = '// comment\nsome content here\n';
    const result = minify(code, "file.unknown", opts);
    assert.ok(result.includes("some content here"));
  });
});

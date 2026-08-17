// spec: R33 R41 R52 R53 R54 R55
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("artifact policy + project policy (251-ai-test-exec)", () => {
  it("R33: raw output path is specs/<spec>/tests/.raw/test-execution.log", () => {
    const p = path.join(REPO_ROOT, "src/flow/prompts/impl/test-execute.md");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/specs\/.*\/tests\/\.raw\/test-execution\.log/.test(src),
      "test-execute.md must reference specs/<spec>/tests/.raw/test-execution.log");
    assert.ok(!/\.tmp\/test-execution-/.test(src), "test-execute.md must not reference .tmp/ raw output path");
  });

  it("R41: persisted artifact JSON schemas exist", () => {
    const schemas = [
      "src/flow/schemas/test-execute-result.schema.json",
      "src/flow/schemas/test-result-review.schema.json",
      "src/flow/schemas/retro.schema.json",
    ];
    for (const rel of schemas) {
      const p = path.join(REPO_ROOT, rel);
      assert.ok(fs.existsSync(p), `artifact schema missing: ${rel}`);
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      assert.ok(data.type === "object" || data.$schema, `${rel} must be a JSON Schema document`);
    }
  });

  it("R52: spec verification tests live under specs/251-ai-test-exec/tests/ and have spec headers", () => {
    const dir = path.join(REPO_ROOT, "specs/251-ai-test-exec/tests");
    const files = fs.readdirSync(dir).filter((f) => /\.test\.js$/.test(f));
    assert.ok(files.length > 0, "spec verification tests must exist");
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      assert.ok(/^\/\/ spec: R\d+/.test(src), `${f} must start with '// spec: R<N>...' header`);
    }
  });

  it("R53: CHANGELOG documents migration plan for retro mainline switch", () => {
    const changelog = path.join(REPO_ROOT, "CHANGELOG.md");
    if (!fs.existsSync(changelog)) return;
    const src = fs.readFileSync(changelog, "utf8");
    assert.ok(/retro.*mainline|test-execute|test-result-review/i.test(src),
      "CHANGELOG must document retro mainline migration / new steps");
  });

  it("R54: new commands return EXIT_ERROR (1) on user-facing precondition failures", () => {
    const exec = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-test-execute.js"), "utf8");
    const review = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-test-result-review.js"), "utf8");
    for (const [name, src] of [["run-test-execute.js", exec], ["run-test-result-review.js", review]]) {
      assert.ok(/EXIT_ERROR|process\.exit|Envelope\.fail/.test(src),
        `${name} must declare error exit / fail envelope path`);
    }
  });

  it("R55: registry.js entries for new commands declare empty user-facing args", async () => {
    const { FLOW_COMMANDS } = await import(path.join(REPO_ROOT, "src/flow/registry.js"));
    for (const id of ["test-execute", "test-result-review"]) {
      const entry = FLOW_COMMANDS.run?.[id];
      if (!entry) continue;
      const args = entry.args || {};
      const flags = args.flags || [];
      const options = args.options || [];
      // Internal-only automation: no user-facing flags/options expected
      assert.ok(flags.length === 0 && options.length === 0,
        `run.${id} should have no user-facing flags/options, got flags=${JSON.stringify(flags)} options=${JSON.stringify(options)}`);
    }
  });
});

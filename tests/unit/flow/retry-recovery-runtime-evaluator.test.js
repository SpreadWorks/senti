import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { runRuntimeEvaluatorScenario } from "../../fixtures/retry-recovery-runtime-evaluator-worker.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("public retry recovery uses the runtime gate evaluator identity", async (context) => {
  const diagnosticPath = path.join(
    os.tmpdir(),
    `senti-runtime-evaluator-${process.pid}-${crypto.randomUUID()}.jsonl`,
  );
  context.diagnostic(`runtime evaluator JSONL: ${diagnosticPath}`);
  await runRuntimeEvaluatorScenario({ diagnosticPath, sourceRoot: repoRoot });
});

/**
 * src/flow/lib/run-update-overview.js
 *
 * Persist-side of the update-overview behavior (spec 207). Given a spec
 * directory, AI-emitted additions, a task identifier, and rendering meta,
 * this module:
 *
 *   1. reads `spec.json` from the spec dir,
 *   2. applies `additions` with `added_by_task = taskId` stamped (via the
 *      merge helper — no mutation),
 *   3. writes the updated `spec.json`,
 *   4. re-renders `spec.md` deterministically,
 *   5. writes the refreshed `spec.md`.
 *
 * The function is a pure orchestrator over existing primitives; AI
 * invocation lives in the caller (e.g. the flow runner) and is out of
 * scope for this module.
 */

import fs from "node:fs";
import path from "node:path";
import { applyOverviewAdditions } from "./overview-merge.js";
import { renderSpecMarkdown } from "../../spec/commands/render.js";

const MAX_SPEC_JSON_BYTES = 256 * 1024;

export function persistOverviewUpdate({ specDir, additions, taskId, meta }) {
  const specJsonPath = path.join(specDir, "spec.json");
  const specMdPath = path.join(specDir, "spec.md");

  const stat = fs.statSync(specJsonPath);
  if (stat.size > MAX_SPEC_JSON_BYTES) {
    throw new Error(
      `spec.json exceeds bounded size limit: ${stat.size} > ${MAX_SPEC_JSON_BYTES} bytes`,
    );
  }
  const raw = fs.readFileSync(specJsonPath, "utf8");
  const spec = JSON.parse(raw);

  const next = applyOverviewAdditions(spec, additions, taskId);

  fs.writeFileSync(specJsonPath, `${JSON.stringify(next, null, 2)}\n`);
  const md = renderSpecMarkdown(next, meta);
  fs.writeFileSync(specMdPath, md);

  return { specJsonPath, specMdPath };
}

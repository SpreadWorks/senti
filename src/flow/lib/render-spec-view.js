/**
 * Render the human-readable spec view from spec.json.
 *
 * spec.json is the source of truth for flow decisions. spec.md and task
 * markdown files are generated views, rendered only when a human-facing
 * approval/update step needs them.
 */

import fs from "node:fs";
import path from "node:path";
import { loadSpecJson, resolveSpecDir, resolveSpecJsonPath } from "../../lib/spec-json.js";
import { renderSpecMarkdown, renderTaskMarkdown } from "../../spec/commands/render.js";

function resolveInput(root, specPath) {
  if (!root) throw new Error("renderSpecView: root is required");
  if (!specPath) throw new Error("renderSpecView: specPath is required");
  return path.isAbsolute(specPath) ? specPath : path.resolve(root, specPath);
}

function buildSpecViewMeta({ specDir, specJsonPath, state }) {
  const specDirName = path.basename(specDir);
  return {
    title: specDirName,
    featureBranch: state?.featureBranch || `feature/${specDirName}`,
    created: fs.statSync(specJsonPath).mtime.toISOString().slice(0, 10),
    status: "Draft",
    input: state?.issue ? `GitHub Issue #${state.issue}` : "User request",
  };
}

export function renderSpecView({ root, specPath, state, spec = null, meta = null, optional = false }) {
  const input = resolveInput(root, specPath);
  const specDir = resolveSpecDir(input);
  const specJsonPath = resolveSpecJsonPath(input);

  if (!fs.existsSync(specJsonPath)) {
    if (optional) {
      return { rendered: false, changed: [], reason: `spec.json not found at ${specJsonPath}` };
    }
    throw new Error(`spec.json not found at ${specJsonPath}`);
  }

  const currentSpec = spec || loadSpecJson(specJsonPath);
  const renderMeta = meta || buildSpecViewMeta({ specDir, specJsonPath, state });
  const changed = [];

  const specMdPath = path.join(specDir, "spec.md");
  fs.writeFileSync(specMdPath, renderSpecMarkdown(currentSpec, renderMeta));
  changed.push(path.relative(root, specMdPath));

  if (Array.isArray(currentSpec.tasks) && currentSpec.tasks.length > 0) {
    const tasksDir = path.join(specDir, "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });
    for (const task of currentSpec.tasks) {
      const taskPath = path.join(tasksDir, `${task.id}.md`);
      fs.writeFileSync(taskPath, renderTaskMarkdown(task));
      changed.push(path.relative(root, taskPath));
    }
  }

  return { rendered: true, changed };
}

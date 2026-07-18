/**
 * Render the human-readable spec view from spec.json.
 *
 * spec.json is the source of truth for flow decisions. spec.md and task
 * markdown files are generated views, rendered only when a human-facing
 * approval/update step needs them.
 */

import fs from "node:fs";
import path from "node:path";
import {
  loadSpecJson,
  resolveSpecDir,
  resolveSpecJsonPath,
  validateSpecJsonObject,
} from "../../lib/spec-json.js";
import { renderSpecMarkdown, renderTaskMarkdown } from "../../spec/commands/render.js";
import {
  SpecRenderContext,
  TaskCollection,
  TaskRenderPlan,
} from "../../spec/lib/render-contract.js";

function resolveInput(root, specPath) {
  if (!root) throw new Error("renderSpecView: root is required");
  if (!specPath) throw new Error("renderSpecView: specPath is required");
  return path.isAbsolute(specPath) ? specPath : path.resolve(root, specPath);
}

export class SpecViewRenderPlan {
  #root;
  #specMdPath;
  #tasksDir;
  #specMarkdown;
  #taskPlan;

  constructor({ root, specDir, specJsonPath, spec }) {
    const collection = new TaskCollection(spec.tasks ?? []);
    validateSpecJsonObject(spec);
    const renderContext = new SpecRenderContext({ root, specDir, specJsonPath });
    const tasksDir = path.join(specDir, "tasks");
    const taskPlan = new TaskRenderPlan({
      collection,
      tasksDir,
      renderTask: renderTaskMarkdown,
    });

    this.#root = root;
    this.#specMdPath = path.join(specDir, "spec.md");
    this.#tasksDir = tasksDir;
    this.#specMarkdown = renderSpecMarkdown(spec, renderContext.toRenderMeta());
    this.#taskPlan = taskPlan;
    Object.freeze(this);
  }

  apply() {
    const changed = [];
    fs.writeFileSync(this.#specMdPath, this.#specMarkdown);
    changed.push(path.relative(this.#root, this.#specMdPath));

    if (this.#taskPlan.size > 0) {
      fs.mkdirSync(this.#tasksDir, { recursive: true });
      for (const entry of this.#taskPlan) {
        fs.writeFileSync(entry.outputPath.value, entry.markdown);
        changed.push(path.relative(this.#root, entry.outputPath.value));
      }
    }

    return { rendered: true, changed };
  }
}

class MissingSpecViewRenderPlan {
  constructor(reason) {
    this.reason = reason;
    Object.freeze(this);
  }

  apply() {
    return { rendered: false, changed: [], reason: this.reason };
  }
}

export function buildSpecViewPlan({ root, specPath, spec = null, optional = false }) {
  const input = resolveInput(root, specPath);
  const specDir = resolveSpecDir(input);
  const specJsonPath = resolveSpecJsonPath(input);

  if (!fs.existsSync(specJsonPath)) {
    if (optional) {
      return new MissingSpecViewRenderPlan(`spec.json not found at ${specJsonPath}`);
    }
    throw new Error(`spec.json not found at ${specJsonPath}`);
  }

  const currentSpec = spec === null
    ? loadSpecJson(specJsonPath, { validate: false })
    : spec;
  return new SpecViewRenderPlan({
    root,
    specDir,
    specJsonPath,
    spec: currentSpec,
  });
}

export function applySpecViewPlan(plan) {
  if (!(plan instanceof SpecViewRenderPlan) && !(plan instanceof MissingSpecViewRenderPlan)) {
    throw new Error("applySpecViewPlan requires a completed spec view render plan");
  }
  return plan.apply();
}

export function renderSpecView(options) {
  return applySpecViewPlan(buildSpecViewPlan(options));
}

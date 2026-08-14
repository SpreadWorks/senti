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
  validateSpecJsonObject,
} from "../../lib/spec-json.js";
import { renderSpecMarkdown, renderTaskMarkdown } from "../../spec/commands/render.js";
import {
  SpecRenderContext,
  SpecRenderOutputLocation,
  TaskCollection,
  TaskRenderPlan,
} from "../../spec/lib/render-contract.js";

export class SpecViewRenderPlan {
  #root;
  #specMdPath;
  #tasksDir;
  #specMarkdown;
  #taskPlan;

  constructor({ root, specDir, specJsonPath, spec, flowState }) {
    const collection = new TaskCollection(spec.tasks ?? []);
    validateSpecJsonObject(spec);
    const renderContext = new SpecRenderContext({ root, specDir, specJsonPath, flowState });
    const outputs = new SpecRenderOutputLocation({ specDir });
    const taskPlan = new TaskRenderPlan({
      collection,
      tasksDir: outputs.tasksDirectory,
      renderTask: renderTaskMarkdown,
    });

    this.#root = root;
    this.#specMdPath = outputs.specMarkdownFile;
    this.#tasksDir = outputs.tasksDirectory;
    this.#specMarkdown = renderSpecMarkdown(spec, renderContext.toRenderMeta());
    this.#taskPlan = taskPlan;
    Object.freeze(this);
  }

  apply() {
    const changed = [];
    fs.mkdirSync(path.dirname(this.#specMdPath), { recursive: true });
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

export function buildSpecViewPlan({ root, flowManager, flowState }) {
  if (!root) throw new Error("renderSpecView: root is required");
  if (!flowManager || typeof flowManager.readArtifact !== "function") {
    throw new Error("renderSpecView requires FlowManager.readArtifact");
  }
  if (flowState?.schemaRevision !== 3 || !flowState.specId) {
    throw new Error("renderSpecView requires a Version-1 Flow state");
  }
  const specDir = flowManager.specLocation(flowState.specId).directory;
  const specJsonPath = path.join(specDir, "spec.json");
  const artifact = flowManager.readArtifact({
    specId: flowState.specId,
    logicalKey: "spec.record",
    consumerNodeId: "flow",
  });
  const currentSpec = JSON.parse(artifact.bytes.toString("utf8"));
  return new SpecViewRenderPlan({
    root,
    specDir,
    specJsonPath,
    spec: currentSpec,
    flowState,
  });
}

export function applySpecViewPlan(plan) {
  if (!(plan instanceof SpecViewRenderPlan)) {
    throw new Error("applySpecViewPlan requires a completed spec view render plan");
  }
  return plan.apply();
}

export function renderSpecView(options) {
  return applySpecViewPlan(buildSpecViewPlan(options));
}

#!/usr/bin/env node
/**
 * One-shot migration script for spec 208 (cac6/T11).
 *
 * - Adds `tasks: []` + `currentTaskId: null` to legacy flow.json (T2 strict).
 * - Normalizes `notes` (string[] → objects) and `metrics` (dict → entries)
 *   to the T10 strict shape.
 * - Hoists per-task notes/metrics onto the flow-level arrays (T10).
 * - Renders a schema-valid spec.json from spec.md for every spec that
 *   does not yet have one, filling missing required fields with empty
 *   defaults (no fabrication).
 *
 * Not shipped: lives under specs/208-... because it runs once against this
 * repo's specs/ tree and then becomes history.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "../../src/lib/schema-validate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "src", "flow", "schemas", "spec.schema.json");
const SPECS_DIR = path.join(REPO_ROOT, "specs");
const EPOCH = "1970-01-01T00:00:00.000Z";

export const EMPTY_SPEC_DEFAULTS = Object.freeze({
  goal: "",
  background: "",
  scope: { in: [], out: [] },
  constraints: [],
  design_principles: [],
  overview: { modules: [], data_flow: [], decisions: [] },
  requirements: [],
  acceptance_criteria: [],
  clarifications: [],
  alternatives_considered: [],
  open_questions: [],
});

// ---------------------------------------------------------------------------
// flow.json migration
// ---------------------------------------------------------------------------

export function migrateFlowJson(state) {
  const next = structuredClone(state);
  let changed = false;

  if (!Array.isArray(next.tasks)) {
    next.tasks = [];
    changed = true;
  }
  if (!("currentTaskId" in next) || next.currentTaskId === undefined) {
    next.currentTaskId = null;
    changed = true;
  }

  // notes normalization
  if (next.notes !== undefined) {
    if (Array.isArray(next.notes) && next.notes.every((n) => typeof n === "string")) {
      next.notes = next.notes.map((text) => ({ taskId: null, text, ts: EPOCH }));
      changed = true;
    } else if (!Array.isArray(next.notes)) {
      // unknown shape — leave alone but flag via warning elsewhere
    }
  }

  // metrics normalization (dict → entry array)
  if (next.metrics !== undefined) {
    if (!Array.isArray(next.metrics) && typeof next.metrics === "object" && next.metrics !== null) {
      const entries = [];
      for (const [phase, counters] of Object.entries(next.metrics)) {
        if (counters && typeof counters === "object") {
          for (const [counter, value] of Object.entries(counters)) {
            if (typeof value === "number") {
              entries.push({ phase, counter, value, taskId: null, ts: EPOCH });
            }
          }
        }
      }
      next.metrics = entries;
      changed = true;
    }
  }

  // hoist per-task metrics / notes (T10: per-task arrays are rejected)
  for (const task of next.tasks) {
    if (task && typeof task === "object") {
      if ("notes" in task) {
        const taskNotes = task.notes;
        delete task.notes;
        if (!Array.isArray(next.notes)) next.notes = [];
        if (Array.isArray(taskNotes)) {
          for (const n of taskNotes) {
            if (typeof n === "string") {
              next.notes.push({ taskId: task.id ?? null, text: n, ts: EPOCH });
            } else if (n && typeof n === "object" && "text" in n) {
              next.notes.push({ taskId: task.id ?? null, text: n.text, ts: n.ts ?? EPOCH });
            }
          }
        }
        changed = true;
      }
      if ("metrics" in task) {
        const taskMetrics = task.metrics;
        delete task.metrics;
        if (!Array.isArray(next.metrics)) next.metrics = [];
        if (taskMetrics && typeof taskMetrics === "object" && !Array.isArray(taskMetrics)) {
          for (const [phase, counters] of Object.entries(taskMetrics)) {
            if (counters && typeof counters === "object") {
              for (const [counter, value] of Object.entries(counters)) {
                if (typeof value === "number") {
                  next.metrics.push({ phase, counter, value, taskId: task.id ?? null, ts: EPOCH });
                }
              }
            }
          }
        }
        changed = true;
      }
    }
  }

  return { state: next, changed };
}

// ---------------------------------------------------------------------------
// spec.md parsing
// ---------------------------------------------------------------------------

function splitSections(markdown) {
  const sections = {};
  const lines = markdown.split("\n");
  let currentH2 = null;
  let currentH3 = null;
  let buffer = [];

  const flushBuffer = () => {
    if (!currentH2) {
      buffer = [];
      return;
    }
    const key = currentH3 ? `${currentH2}::${currentH3}` : currentH2;
    sections[key] = (sections[key] || "") + buffer.join("\n");
    buffer = [];
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h2) {
      flushBuffer();
      currentH2 = h2[1].trim();
      currentH3 = null;
      continue;
    }
    if (h3 && currentH2) {
      flushBuffer();
      currentH3 = h3[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flushBuffer();
  return sections;
}

function normalizeHeading(name) {
  return name.toLowerCase().replace(/\s*\(.*?\)\s*$/, "").trim();
}

function findSection(sections, candidates) {
  for (const key of Object.keys(sections)) {
    const norm = normalizeHeading(key.split("::")[0]);
    if (candidates.includes(norm)) return sections[key];
  }
  return null;
}

function findSubsection(sections, h2Candidates, h3Predicate) {
  for (const key of Object.keys(sections)) {
    const [h2, h3] = key.split("::");
    if (h3 && h3Predicate(h3) && h2Candidates.includes(normalizeHeading(h2))) {
      return sections[key];
    }
  }
  return null;
}

const h3Is = (name) => (h3) => normalizeHeading(h3) === name;

function bulletList(text) {
  if (!text) return [];
  const items = [];
  const lines = text.split("\n");
  let current = null;
  for (const raw of lines) {
    const m = raw.match(/^-\s+(.*)$/);
    if (m) {
      if (current != null) items.push(current.trim());
      current = m[1];
    } else if (current != null && /^\s+\S/.test(raw)) {
      current += " " + raw.trim();
    } else if (current != null && raw.trim() === "") {
      // allow blank line to terminate a bullet
    }
  }
  if (current != null) items.push(current.trim());
  return items.filter((s) => s.length > 0);
}

function firstNonEmptyParagraph(text) {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  // take first paragraph (until blank line) but tolerate single bullet
  const unbullet = trimmed.replace(/^-\s+/, "");
  const firstPara = unbullet.split(/\n\s*\n/)[0];
  return firstPara.trim();
}

function parseRequirements(text) {
  const items = bulletList(text);
  const out = [];
  let idCounter = 0;
  for (const item of items) {
    idCounter += 1;
    // Shapes seen:
    //   "R1 [must]: desc"
    //   "R1: desc"
    //   "REQ-1: desc"
    //   "- [ ] REQ-1: desc"
    //   "desc"
    let rest = item.replace(/^\[\s*[x ]\s*\]\s*/i, "");
    const idMatch = rest.match(/^(REQ-\d+|R\d+|[A-Z]+-\d+)\b[:\s]*/);
    let id;
    if (idMatch) {
      id = idMatch[1];
      rest = rest.slice(idMatch[0].length);
    } else {
      id = `R${idCounter}`;
    }
    let priority;
    const prioMatch = rest.match(/^\[\s*(must|should|nice-to-have|high|low|p[1-5])\s*\]\s*:?\s*/i);
    if (prioMatch) {
      const p = prioMatch[1].toLowerCase();
      priority = ["must", "should", "nice-to-have"].includes(p) ? p : undefined;
      rest = rest.slice(prioMatch[0].length);
    }
    const desc = rest.replace(/^:?\s*/, "").trim();
    if (!desc) continue;
    const req = { id, desc };
    if (priority) req.priority = priority;
    out.push(req);
  }
  return out;
}

function parseClarifications(text) {
  if (!text) return [];
  const out = [];
  const lines = text.split("\n");
  let currentQ = null;
  for (const raw of lines) {
    const qMatch = raw.match(/^-\s*Q[:：]\s*(.*)$/i);
    const aMatch = raw.match(/^\s+-\s*A[:：]\s*(.*)$/i);
    if (qMatch) {
      if (currentQ) out.push(currentQ);
      currentQ = { q: qMatch[1].trim(), a: "" };
    } else if (aMatch && currentQ) {
      currentQ.a = aMatch[1].trim();
    } else if (currentQ && /^\s+\S/.test(raw) && currentQ.a === "") {
      currentQ.a = raw.trim();
    }
  }
  if (currentQ) out.push(currentQ);
  return out.filter((x) => x.q && x.a);
}

function parseAlternatives(text) {
  const items = bulletList(text);
  const out = [];
  for (const item of items) {
    // "option — reason" or "option: reason" or "option - reason"
    const m = item.match(/^(.*?)\s*(?:—|–|--|\s-\s|:)\s*(.+)$/);
    if (m) {
      out.push({ option: m[1].trim(), reason: m[2].trim() });
    } else {
      out.push({ option: item, reason: "" });
    }
  }
  return out.filter((x) => x.option && x.reason);
}

function parseOpenQuestions(text) {
  const items = bulletList(text);
  return items.map((s) => s.replace(/^\[\s*[x ]\s*\]\s*/i, "").trim()).filter(Boolean);
}

function parseOverviewSubsection(text) {
  return bulletList(text).map((t) => ({ text: t }));
}

export function parseSpecMd(markdown) {
  const sections = splitSections(markdown);

  const goal = firstNonEmptyParagraph(findSection(sections, ["goal"]));
  const background = firstNonEmptyParagraph(findSection(sections, ["background"]));
  const scopeIn = bulletList(findSection(sections, ["scope"]));
  const scopeOut = bulletList(findSection(sections, ["out of scope"]));
  const constraints = bulletList(findSection(sections, ["constraints"]));
  const designPrinciples = bulletList(findSection(sections, ["design principles"]));

  const modules = parseOverviewSubsection(findSubsection(sections, ["overview"], h3Is("modules")));
  const dataFlow = parseOverviewSubsection(findSubsection(sections, ["overview"], h3Is("data flow")));
  const decisions = parseOverviewSubsection(findSubsection(sections, ["overview"], h3Is("decisions")));

  const requirements = parseRequirements(findSection(sections, ["requirements"]));
  const acceptance = bulletList(findSection(sections, ["acceptance criteria", "user scenarios & testing", "user scenarios"]));
  const clarifications = parseClarifications(findSection(sections, ["clarifications"]));
  const alternatives = parseAlternatives(findSection(sections, ["alternatives considered", "alternatives"]));
  const openQuestions = parseOpenQuestions(findSection(sections, ["open questions"]));

  return {
    goal,
    background,
    scope: { in: scopeIn, out: scopeOut },
    constraints,
    design_principles: designPrinciples,
    overview: { modules, data_flow: dataFlow, decisions },
    requirements,
    acceptance_criteria: acceptance,
    clarifications,
    alternatives_considered: alternatives,
    open_questions: openQuestions,
  };
}

// ---------------------------------------------------------------------------
// spec.md → spec.json migration
// ---------------------------------------------------------------------------

let cachedSchema = null;
function loadSchema() {
  if (!cachedSchema) {
    cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  }
  return cachedSchema;
}

export function validateSpecJson(specJson) {
  const schema = loadSchema();
  const errors = validateSchema(specJson, schema);
  return { valid: errors.length === 0, errors };
}

function applyDefaults(parsed) {
  return {
    goal: parsed.goal || EMPTY_SPEC_DEFAULTS.goal,
    background: parsed.background || EMPTY_SPEC_DEFAULTS.background,
    scope: {
      in: parsed.scope.in.length ? parsed.scope.in : [...EMPTY_SPEC_DEFAULTS.scope.in],
      out: parsed.scope.out.length ? parsed.scope.out : [...EMPTY_SPEC_DEFAULTS.scope.out],
    },
    constraints: parsed.constraints.length ? parsed.constraints : [...EMPTY_SPEC_DEFAULTS.constraints],
    design_principles: parsed.design_principles.length
      ? parsed.design_principles
      : [...EMPTY_SPEC_DEFAULTS.design_principles],
    overview: {
      modules: parsed.overview.modules,
      data_flow: parsed.overview.data_flow,
      decisions: parsed.overview.decisions,
    },
    requirements: parsed.requirements,
    acceptance_criteria: parsed.acceptance_criteria,
    clarifications: parsed.clarifications,
    alternatives_considered: parsed.alternatives_considered,
    open_questions: parsed.open_questions,
  };
}

export function migrateSpecMd(markdown) {
  const warnings = [];
  const parsed = parseSpecMd(markdown);
  if (!parsed.goal) warnings.push("missing ## Goal section");
  if (!parsed.background) warnings.push("missing ## Background section");
  if (parsed.constraints.length === 0) warnings.push("missing ## Constraints section");
  if (parsed.design_principles.length === 0) warnings.push("missing ## Design Principles section");
  if (
    parsed.overview.modules.length === 0 &&
    parsed.overview.data_flow.length === 0 &&
    parsed.overview.decisions.length === 0
  ) {
    warnings.push("missing ## Overview section");
  }
  if (parsed.alternatives_considered.length === 0) warnings.push("missing ## Alternatives Considered section");

  const specJson = applyDefaults(parsed);
  return { specJson, warnings };
}

// ---------------------------------------------------------------------------
// Per-spec orchestration
// ---------------------------------------------------------------------------

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function processFlowJson(specDir, { dryRun }) {
  const flowPath = path.join(specDir, "flow.json");
  if (!fs.existsSync(flowPath)) return { result: "absent" };
  let state;
  try {
    state = readJson(flowPath);
  } catch (err) {
    return { result: "error", reason: `invalid JSON: ${err.message}` };
  }
  const { state: migrated, changed } = migrateFlowJson(state);
  if (!changed) return { result: "noop" };
  if (!dryRun) writeJson(flowPath, migrated);
  return { result: "migrated" };
}

function processSpecMd(specDir, { dryRun }) {
  const mdPath = path.join(specDir, "spec.md");
  const jsonPath = path.join(specDir, "spec.json");
  if (fs.existsSync(jsonPath)) return { result: "noop" };
  if (!fs.existsSync(mdPath)) return { result: "absent" };
  const md = fs.readFileSync(mdPath, "utf8");
  const { specJson, warnings } = migrateSpecMd(md);
  const { valid, errors } = validateSpecJson(specJson);
  if (!valid) {
    return { result: "schema_fail", warnings, errors };
  }
  if (!dryRun) writeJson(jsonPath, specJson);
  return { result: "migrated", warnings };
}

function listSpecDirs(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, e.name))
    .sort();
}

export function runMigration({ dryRun = false } = {}) {
  const specDirs = listSpecDirs(SPECS_DIR);
  const summary = {
    scanned: specDirs.length,
    flowMigrated: 0,
    flowNoop: 0,
    flowError: 0,
    specMigrated: 0,
    specNoop: 0,
    specError: 0,
    changes: [],
    warnings: [],
    errors: [],
  };

  for (const dir of specDirs) {
    const rel = path.relative(REPO_ROOT, dir);
    try {
      const flow = processFlowJson(dir, { dryRun });
      if (flow.result === "migrated") {
        summary.flowMigrated += 1;
        summary.changes.push(`${dryRun ? "would " : ""}migrate ${rel}/flow.json`);
      } else if (flow.result === "noop" || flow.result === "absent") summary.flowNoop += 1;
      else if (flow.result === "error") {
        summary.flowError += 1;
        summary.errors.push(`${rel}/flow.json: ${flow.reason}`);
      }

      const spec = processSpecMd(dir, { dryRun });
      if (spec.result === "migrated") {
        summary.specMigrated += 1;
        summary.changes.push(`${dryRun ? "would " : ""}write ${rel}/spec.json`);
        if (spec.warnings?.length) {
          for (const w of spec.warnings) summary.warnings.push(`${rel}: ${w}`);
        }
      } else if (spec.result === "noop" || spec.result === "absent") {
        summary.specNoop += 1;
      } else if (spec.result === "schema_fail") {
        summary.specError += 1;
        for (const e of spec.errors) summary.errors.push(`${rel}/spec.json: ${e}`);
        for (const w of spec.warnings ?? []) summary.warnings.push(`${rel}: ${w}`);
      }
    } catch (err) {
      summary.errors.push(`${rel}: uncaught ${err.message}`);
    }
  }

  return summary;
}

function printSummary(s, { dryRun }) {
  const lines = [];
  lines.push(`== migrate-flow-to-tasks ${dryRun ? "(dry-run)" : "apply"} ==`);
  if (s.changes.length) {
    lines.push(`-- ${dryRun ? "planned" : "applied"} changes (${s.changes.length}) --`);
    for (const c of s.changes) lines.push(`  ${c}`);
  } else {
    lines.push("(no changes)");
  }
  if (s.warnings.length) {
    lines.push(`\n-- warnings (${s.warnings.length}) --`);
    for (const w of s.warnings) lines.push(`  ${w}`);
  }
  if (s.errors.length) {
    lines.push(`\n-- errors (${s.errors.length}) --`);
    for (const e of s.errors) lines.push(`  ${e}`);
  }
  lines.push(`\n-- summary --`);
  lines.push(`scanned spec dirs: ${s.scanned}`);
  lines.push(`flow.json: migrated=${s.flowMigrated}, no-op=${s.flowNoop}, error=${s.flowError}`);
  lines.push(`spec.json: migrated=${s.specMigrated}, no-op=${s.specNoop}, error=${s.specError}`);
  process.stdout.write(lines.join("\n") + "\n");
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function parseCli(argv) {
  const result = { dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") result.dryRun = true;
    else if (a === "-h" || a === "--help") result.help = true;
    else result.unknown = a;
  }
  return result;
}

function printUsage() {
  process.stderr.write(
    "Usage: node specs/208-migrate-flow-to-tasks/migrate-flow-to-tasks.js [--dry-run]\n",
  );
}

function isMain() {
  return path.resolve(process.argv[1] ?? "") === __filename;
}

if (isMain()) {
  const cli = parseCli(process.argv.slice(2));
  if (cli.help) {
    printUsage();
    process.exit(0);
  }
  if (cli.unknown) {
    process.stderr.write(`unknown argument: ${cli.unknown}\n`);
    printUsage();
    process.exit(2);
  }
  const summary = runMigration({ dryRun: cli.dryRun });
  printSummary(summary, { dryRun: cli.dryRun });
  process.exit(summary.errors.length === 0 ? 0 : 1);
}

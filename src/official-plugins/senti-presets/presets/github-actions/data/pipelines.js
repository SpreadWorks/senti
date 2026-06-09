/**
 * PipelinesSource — GitHub Actions pipelines DataSource.
 *
 * Scans GitHub Actions workflow YAML files and provides
 * pipeline metadata as {{data}} directives.
 *
 * Available methods:
 *   pipelines.list("Name|File|Triggers|Jobs")
 *   pipelines.jobs("Pipeline|Job|Runner|Steps|Dependencies")
 *   pipelines.env("Pipeline|Secrets|Env Vars")
 */

import fs from "fs";

// ---------------------------------------------------------------------------
// Workflow YAML parser
// ---------------------------------------------------------------------------

/**
 * Parse a single GitHub Actions workflow YAML file.
 *
 * @param {string} content - YAML file content
 * @param {string} fileName - File name (for fallback name)
 * @returns {Object} Parsed pipeline data
 */
function parseWorkflow(content, fileName) {
  const result = {
    file: fileName,
    name: fileName,
    platform: "github-actions",
    triggers: [],
    jobs: [],
    envVars: [],
    secrets: [],
  };

  if (!content || !content.trim()) return result;

  const lines = content.split("\n");

  // Extract workflow name
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  // Extract triggers from `on:` section
  result.triggers = parseTriggers(lines);

  // Extract jobs
  result.jobs = parseJobs(lines);

  // Extract secrets and env var references from entire file
  result.secrets = extractRefs(content, /\$\{\{\s*secrets\.(\w+)\s*\}\}/g);
  result.envVars = extractRefs(content, /\$\{\{\s*env\.(\w+)\s*\}\}/g);

  return result;
}

function parseTriggers(lines) {
  const triggers = [];
  let inOn = false;
  let onIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    if (/^on\s*:/.test(trimmed)) {
      inOn = true;
      onIndent = 0;

      const inlineMatch = trimmed.match(/^on\s*:\s*(.+)$/);
      if (inlineMatch) {
        const val = inlineMatch[1].trim();
        if (val.startsWith("[")) {
          const items = val.replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
          triggers.push(...items);
          inOn = false;
        } else if (!val.endsWith(":")) {
          triggers.push(val);
          inOn = false;
        }
      }
      continue;
    }

    if (!inOn) continue;

    if (/^\S/.test(line) && !line.startsWith("#")) {
      inOn = false;
      continue;
    }

    const eventMatch = trimmed.match(/^\s{2}(\w[\w-]*)\s*:/);
    if (eventMatch) {
      const event = eventMatch[1];
      const branches = extractBranches(lines, i + 1);
      if (branches) {
        triggers.push(`${event} (${branches})`);
      } else {
        triggers.push(event);
      }
    }

    const cronMatch = trimmed.match(/^\s+-\s*cron\s*:\s*["']?(.+?)["']?\s*$/);
    if (cronMatch) {
      const scheduleIdx = triggers.indexOf("schedule");
      if (scheduleIdx >= 0) {
        triggers[scheduleIdx] = `schedule (${cronMatch[1]})`;
      }
    }
  }

  return triggers;
}

function extractBranches(lines, startIdx) {
  for (let i = startIdx; i < Math.min(startIdx + 5, lines.length); i++) {
    const trimmed = lines[i].trim();

    const inlineMatch = trimmed.match(/^branches\s*:\s*\[(.+)\]/);
    if (inlineMatch) {
      return inlineMatch[1].replace(/['"]/g, "").split(",").map((s) => s.trim()).join(", ");
    }

    if (/^branches\s*:\s*$/.test(trimmed)) {
      const branchList = [];
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const item = lines[j].trim();
        if (item.startsWith("- ")) {
          branchList.push(item.slice(2).trim().replace(/['"]/g, ""));
        } else {
          break;
        }
      }
      return branchList.length > 0 ? branchList.join(", ") : null;
    }

    if (/^\s{2}\w/.test(lines[i]) && !/^\s{4}/.test(lines[i])) break;
  }
  return null;
}

function parseJobs(lines) {
  const jobs = [];
  let inJobs = false;
  let currentJob = null;
  let inSteps = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    if (/^jobs\s*:\s*$/.test(trimmed)) {
      inJobs = true;
      continue;
    }

    if (!inJobs) continue;

    if (/^\S/.test(line) && !line.startsWith("#")) {
      if (currentJob) jobs.push(currentJob);
      break;
    }

    const jobMatch = trimmed.match(/^  (\w[\w-]*)\s*:\s*$/);
    if (jobMatch) {
      if (currentJob) jobs.push(currentJob);
      currentJob = { id: jobMatch[1], runner: "", steps: 0, dependencies: [] };
      inSteps = false;
      continue;
    }

    if (!currentJob) continue;

    const runsOnMatch = trimmed.match(/^\s+runs-on\s*:\s*(.+)$/);
    if (runsOnMatch) {
      currentJob.runner = runsOnMatch[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }

    if (/^\s+steps\s*:\s*$/.test(trimmed)) {
      inSteps = true;
      continue;
    }

    if (inSteps && /^\s+-\s/.test(line)) {
      currentJob.steps++;

      const usesMatch = trimmed.match(/^\s*-?\s*uses\s*:\s*(.+)$/);
      if (usesMatch) {
        currentJob.dependencies.push(usesMatch[1].trim().replace(/^["']|["']$/g, ""));
      }
    }

    if (inSteps && !line.trim().startsWith("-") && /^\s+uses\s*:\s*(.+)$/.test(trimmed)) {
      const m = trimmed.match(/^\s+uses\s*:\s*(.+)$/);
      if (m) {
        currentJob.dependencies.push(m[1].trim().replace(/^["']|["']$/g, ""));
      }
    }
  }

  if (currentJob) jobs.push(currentJob);

  for (const job of jobs) {
    job.dependencies = [...new Set(job.dependencies)];
  }

  return jobs;
}

function extractRefs(content, regex) {
  const refs = new Set();
  let m;
  while ((m = regex.exec(content)) !== null) {
    refs.add(m[1]);
  }
  return [...refs].sort();
}

// ---------------------------------------------------------------------------
// DataSource
// ---------------------------------------------------------------------------

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");

  class PipelineEntry extends AnalysisEntry {
    name = null;
    platform = null;
    triggers = null;
    jobs = null;
    envVars = null;
    secrets = null;

    static summary = {
      totalJobs: { field: "jobs", aggregate: "count" },
    };
  }

  class PipelinesSource extends Scannable(DataSource) {
    static Entry = PipelineEntry;

    match(relPath) {
      return /\.github\/workflows\/.*\.ya?ml$/.test(relPath);
    }

    parse(absPath) {
      const entry = new PipelineEntry();
      const content = fs.readFileSync(absPath, "utf8");
      // parseWorkflow expects (content, fileName) — fileName is used as fallback name.
      // We pass absPath as fileName; the common layer will set entry.file to relPath.
      const pipeline = parseWorkflow(content, absPath);
      entry.name = pipeline.name;
      entry.platform = pipeline.platform;
      entry.triggers = pipeline.triggers;
      entry.jobs = pipeline.jobs;
      entry.envVars = pipeline.envVars;
      entry.secrets = pipeline.secrets;
      return entry;
    }

    /** Pipeline summary table. */
    list(analysis, labels) {
      const items = analysis.pipelines?.entries || analysis.pipelines?.pipelines || [];
      if (items.length === 0) return null;
      const rows = this.toRows(items, (p) => [
        p.name,
        p.file,
        (p.triggers || []).join(", ") || "—",
        (p.jobs || []).length,
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Job detail table across all pipelines. */
    jobs(analysis, labels) {
      const items = analysis.pipelines?.entries || analysis.pipelines?.pipelines || [];
      if (items.length === 0) return null;
      const rows = [];
      for (const p of items) {
        for (const j of p.jobs || []) {
          rows.push([
            p.name,
            j.id,
            j.runner || "—",
            j.steps,
            (j.dependencies || []).join(", ") || "—",
          ]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Secrets and environment variables table. */
    env(analysis, labels) {
      const items = analysis.pipelines?.entries || analysis.pipelines?.pipelines || [];
      if (items.length === 0) return null;
      const rows = [];
      for (const p of items) {
        if ((p.secrets || []).length === 0 && (p.envVars || []).length === 0) continue;
        rows.push([
          p.name,
          (p.secrets || []).join(", ") || "—",
          (p.envVars || []).join(", ") || "—",
        ]);
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }
  }

  return PipelinesSource;
}

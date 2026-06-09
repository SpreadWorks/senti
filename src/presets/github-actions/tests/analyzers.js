/**
 * Directory-level analyzers for github-actions preset tests.
 *
 * These helpers are used only by unit tests. They were previously
 * exported from data/*.js modules but have been relocated here so
 * that preset data/ files do not import senti internals
 * (spec 191: preset DI container).
 */

/**
 * Parse a single GitHub Actions workflow YAML file.
 *
 * @param {string} content - YAML file content
 * @param {string} fileName - File name (for fallback name)
 * @returns {Object} Parsed pipeline data
 */
export function parseWorkflow(content, fileName) {
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

#!/usr/bin/env node
/**
 * src/docs/commands/changelog.js
 *
 * specs/ を走査して change_log.md を生成する。
 * 既存ファイルの MANUAL ブロックを保持する。
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { sourceRoot, parseArgs, formatUTCTimestamp } from "../../lib/cli.js";
import { DEFAULT_LANG } from "../../lib/config.js";
import { translate } from "../../lib/i18n.js";
import { Command } from "../../lib/command.js";
import { ExecutionMode, WritePlan } from "../../lib/execution-plan.js";
import { mapWithConcurrency } from "../lib/concurrency.js";

async function optional(fsOp) {
  try {
    return await fsOp();
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

const statIfExists = (p) => optional(() => fsp.stat(p));
const readIfExists = (p) => optional(() => fsp.readFile(p, "utf8"));

/**
 * パイプ文字をエスケープし、空白を正規化する。
 */
function sanitize(text) {
  return text
    .replace(/[\t\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\|/g, "\\|");
}

/**
 * spec ディレクトリから changelog 用メタ情報を取得する (spec 207 / T8)。
 *
 * title / inputLine は spec.json から、status / branch は flow.json から取得。
 * spec.json が存在しない spec はこの changelog から除外される（T11 migration
 * 実行後はこの方針で全 spec が揃う）。
 */
async function parseSpecDir(specDir, dirName) {
  const spec = JSON.parse(fs.readFileSync(path.join(specDir, "spec.json"), "utf8"));

  let title = dirName;
  let inputLine = "";
  if (spec.goal) {
    const firstLine = spec.goal.split("\n")[0].trim();
    if (firstLine) title = firstLine;
  }
  if (Array.isArray(spec.scope?.in) && spec.scope.in.length) {
    inputLine = spec.scope.in[0];
  }

  const specJsonPath = path.join(specDir, "spec.json");
  const jsonStat = await statIfExists(specJsonPath);
  const created = jsonStat ? jsonStat.mtime.toISOString().slice(0, 10) : "";

  let status = "";
  let branch = "";
  const flowPath = path.join(specDir, "flow.json");
  const flowText = await readIfExists(flowPath);
  if (flowText) {
    try {
      const flow = JSON.parse(flowText);
      status = flow.state?.finalizedAt ? "completed" : "active";
      if (flow.featureBranch) branch = flow.featureBranch;
    } catch (err) {
      process.stderr.write(`changelog: skipping malformed flow.json at ${flowPath}: ${err.message}\n`);
    }
  }

  return {
    title: sanitize(title || "n/a"),
    created: sanitize(created || "n/a"),
    status: sanitize(status || "n/a"),
    branch: sanitize(branch || "n/a"),
    inputLine: sanitize(inputLine || "n/a"),
  };
}

/**
 * ディレクトリ名からシリーズ情報を抽出する。
 */
function parseDirName(dirName) {
  let m = dirName.match(/^([0-9]{3})[-_](.+)$/);
  if (m) return { number: parseInt(m[1], 10), series: m[2], isBackup: false };

  m = dirName.match(/^bak\.([0-9]{3})[-_](.+)$/);
  if (m) return { number: parseInt(m[1], 10), series: m[2], isBackup: true };

  return null;
}

async function runChangelog(rawArgs, container) {
  const args = rawArgs;
  const optionArgs = args.filter((arg) => arg.startsWith("-"));
  const opts = parseArgs(optionArgs, { flags: ["--dry-run"], options: [], defaults: { dryRun: false } });

  if (opts.help) {
    const tu = translate();
    const h = tu.raw("ui:help.cmdHelp.changelog");
    const o = h.options;
    console.log([h.usage, "", `  ${h.desc}`, `  ${h.descDetail}`, "", "Options:", `  ${o.dryRun}`].join("\n"));
    return;
  }

  const root = container.get("root");
  const srcRoot = sourceRoot();
  const specsDir = path.join(srcRoot, "specs");
  const outFileArg = args.find((a) => !a.startsWith("-"));
  const outFile = outFileArg || path.join(root, "docs", "change_log.md");

  const cfgData = container.get("config");
  const lang = cfgData?.docs?.defaultLanguage || cfgData?.lang || DEFAULT_LANG;
  const t = translate();

  // Collect spec entries asynchronously with bounded concurrency — satisfies
  // the "no synchronous I/O in hot paths" and "bounded resource usage"
  // guardrails (spec 207 / T8).
  const dirsRaw = await statIfExists(specsDir);
  const dirNames = dirsRaw ? (await fsp.readdir(specsDir)).sort() : [];
  const concurrencyLimit = Math.max(1, cfgData?.concurrency || 4);
  const results = await mapWithConcurrency(dirNames, concurrencyLimit, async (dirName) => {
    const dirPath = path.join(specsDir, dirName);
    const specJsonStat = await statIfExists(path.join(dirPath, "spec.json"));
    if (!specJsonStat || !specJsonStat.isFile()) return null;

    const parsed = parseDirName(dirName);
    if (!parsed) return null;

    const meta = await parseSpecDir(dirPath, dirName);

    const dirEntries = await fsp.readdir(dirPath);
    const linkedFiles = dirEntries.filter((f) => f.endsWith(".md")).sort();

    return {
      dirName,
      series: parsed.series,
      number: parsed.number,
      isBackup: parsed.isBackup,
      ...meta,
      links: linkedFiles,
    };
  });
  const entries = [];
  for (const r of results) {
    if (r.error) throw r.error;
    if (r.value) entries.push(r.value);
  }

  // Find latest non-backup per series
  const latestBySeries = {};
  for (const entry of entries) {
    if (entry.isBackup) continue;
    const key = entry.series;
    if (!latestBySeries[key] || entry.number > latestBySeries[key].number) {
      latestBySeries[key] = entry;
    }
  }
  const latestEntries = Object.values(latestBySeries).sort((a, b) =>
    a.series.localeCompare(b.series)
  );

  // Generate output
  const now = formatUTCTimestamp();
  const out = [];

  out.push("<!-- AUTO-GEN:START -->");
  out.push(t("messages:changelog.heading"));
  out.push("");
  out.push(t("messages:changelog.sectionDescription"));
  out.push("");
  out.push(t("messages:changelog.descriptionBody"));
  out.push("");
  out.push(t("messages:changelog.sectionContents"));
  out.push("");
  out.push(t("messages:changelog.sectionTimestamp"));
  out.push("");
  out.push(`- generated_at: ${now}`);
  out.push("");
  out.push(t("messages:changelog.sectionLatestIndex"));
  out.push("");
  out.push("| series | latest | status | created | spec |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const e of latestEntries) {
    out.push(`| \`${e.series}\` | \`${e.dirName}\` | ${e.status} | ${e.created} | [spec](../specs/${e.dirName}/spec.md) |`);
  }
  out.push("");
  out.push(t("messages:changelog.sectionAllSpecs"));
  out.push("");
  out.push("| dir | status | created | title | summary | files |");
  out.push("| --- | --- | --- | --- | --- | --- |");

  const sortedEntries = [...entries].sort((a, b) => a.dirName.localeCompare(b.dirName));
  for (const e of sortedEntries) {
    let fileLinks;
    if (e.links.length > 1) {
      fileLinks = e.links.map((f) => `[${f}](../specs/${e.dirName}/${f})`).join(", ");
    } else {
      const f = e.links[0] || "spec.md";
      fileLinks = `[${f}](../specs/${e.dirName}/${f})`;
    }
    out.push(`| \`${e.dirName}\` | ${e.status} | ${e.created} | ${e.title} | ${e.inputLine} | ${fileLinks} |`);
  }

  out.push("<!-- AUTO-GEN:END -->");
  out.push("");

  const content = out.join("\n");
  const plan = new WritePlan(`generate changelog at ${outFile}`, { preview: content });
  plan.add(`create ${path.dirname(outFile)} and write ${outFile}`, async () => {
    await fsp.mkdir(path.dirname(outFile), { recursive: true });
    await fsp.writeFile(outFile, content);
    console.log(t("messages:changelog.generated", { path: outFile }));
  });

  const mode = ExecutionMode.fromDryRun(opts.dryRun);
  return mode.execute(plan, {
    write(rendered) {
      console.log(rendered);
      console.error(t("messages:changelog.dryRun", { path: outFile }));
    },
  });
}

export default class DocsChangelogCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runChangelog(ctx._rawArgs || [], this.container);
  }
}

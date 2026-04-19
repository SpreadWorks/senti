#!/usr/bin/env node
/**
 * src/docs/commands/changelog.js
 *
 * specs/ を走査して change_log.md を生成する。
 * 既存ファイルの MANUAL ブロックを保持する。
 */

import fs from "fs";
import path from "path";
import { sourceRoot, parseArgs, formatUTCTimestamp } from "../../lib/cli.js";
import { DEFAULT_LANG } from "../../lib/config.js";
import { translate } from "../../lib/i18n.js";
import { Command } from "../../lib/command.js";

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
 * spec.md から必要なメタ情報を抽出する。
 */
function parseSpecFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // title
  let title = "";
  for (const line of lines) {
    const m = line.match(/^# (.*)$/);
    if (m) {
      title = m[1].replace(/^Feature Specification:\s*/, "");
      break;
    }
  }
  if (!title) {
    // first non-empty line
    for (const line of lines) {
      if (line.trim()) {
        title = line.trim();
        break;
      }
    }
  }
  if (!title || title === "yaml") {
    title = "";
  }

  // metadata fields
  let created = "";
  let status = "";
  let branch = "";
  let inputLine = "";

  for (const line of lines) {
    const createdMatch = line.match(/^\*\*Created\*\*:\s*(.*?)\s*$/);
    if (createdMatch && !created) created = createdMatch[1];

    const statusMatch = line.match(/^\*\*Status\*\*:\s*(.*?)\s*$/);
    if (statusMatch && !status) status = statusMatch[1];

    const branchMatch = line.match(/^\*\*Feature Branch\*\*:\s*(.*?)\s*$/);
    if (branchMatch && !branch) branch = branchMatch[1].replace(/`/g, "");

    const inputMatch = line.match(/^\*\*Input\*\*:\s*(.*?)\s*$/);
    if (inputMatch && !inputLine) inputLine = inputMatch[1];
  }

  // fallback: first bullet in ## Scope
  if (!inputLine) {
    let inScope = false;
    for (const line of lines) {
      if (/^## Scope/.test(line)) {
        inScope = true;
        continue;
      }
      if (inScope && /^## /.test(line)) break;
      if (inScope && /^- /.test(line)) {
        inputLine = line.replace(/^- /, "");
        break;
      }
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

function runChangelog(rawArgs, container) {
  const args = rawArgs;
  const opts = parseArgs(args, { flags: ["--dry-run"], options: [], defaults: { dryRun: false } });

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

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  // Collect spec entries
  const entries = [];

  if (fs.existsSync(specsDir)) {
    for (const dirName of fs.readdirSync(specsDir).sort()) {
      const specFile = path.join(specsDir, dirName, "spec.md");
      if (!fs.existsSync(specFile)) continue;

      const parsed = parseDirName(dirName);
      if (!parsed) continue;

      const meta = parseSpecFile(specFile);

      // Discover linked files
      const dirPath = path.join(specsDir, dirName);
      const linkedFiles = fs
        .readdirSync(dirPath)
        .filter((f) => f.endsWith(".md"))
        .sort();

      entries.push({
        dirName,
        series: parsed.series,
        number: parsed.number,
        isBackup: parsed.isBackup,
        ...meta,
        links: linkedFiles,
      });
    }
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

  if (opts.dryRun) {
    console.log(out.join("\n"));
    console.error(t("messages:changelog.dryRun", { path: outFile }));
  } else {
    fs.writeFileSync(outFile, out.join("\n"));
    console.log(t("messages:changelog.generated", { path: outFile }));
  }
}

export default class DocsChangelogCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runChangelog(ctx._rawArgs || [], this.container);
  }
}


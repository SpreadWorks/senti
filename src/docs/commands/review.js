#!/usr/bin/env node
/**
 * src/docs/commands/review.js
 *
 * docs 品質チェック。
 * 章ファイルの基本構造を検証する。
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "../../lib/cli.js";
import { sddOutputDir } from "../../lib/config.js";
import { Command } from "../../lib/command.js";
import { translate } from "../../lib/i18n.js";
import { getChapterFiles } from "../lib/command-context.js";
import { parseDirectives } from "../lib/directive-parser.js";
import { ANALYSIS_META_KEYS } from "../lib/analysis-entry.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESIDUAL_BLOCK_RE = /^<!--\s*@(block:\s*[\w-]+|endblock|extends|parent)\s*-->$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripInlineCode(line) {
  return line.replace(/`[^`]+`/g, "");
}

function testIgnoringInlineCode(line, regex) {
  return regex.test(stripInlineCode(line));
}

/**
 * @param {string} content - File content
 * @returns {{ exposedDirectives: number, brokenComments: boolean, residualBlocks: number }}
 */
function checkOutputIntegrity(content) {
  const lines = content.split("\n");
  let exposedDirectives = 0;
  let residualBlocks = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const stripped = line
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/`[^`]+`/g, "");

    if (/\{\{(data\s*:|text\s*[\[:]|\/data\}\}|\/text\}\})/.test(stripped)) {
      exposedDirectives++;
    }

    if (RESIDUAL_BLOCK_RE.test(line.trim())) {
      residualBlocks++;
    }
  }

  let commentOpens = 0;
  let commentCloses = 0;
  inCodeBlock = false;
  for (const line of lines) {
    if (/^(`{3,}|~{3,})/.test(line.trim())) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    const o = line.match(/<!--/g);
    const c = line.match(/-->/g);
    if (o) commentOpens += o.length;
    if (c) commentCloses += c.length;
  }
  const brokenComments = commentOpens !== commentCloses;

  return { exposedDirectives, brokenComments, residualBlocks };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function runReview(rawArgs, container) {
  const args = rawArgs;
  const opts = parseArgs(args, { flags: [], options: [] });

  if (opts.help) {
    const tu = translate();
    const h = tu.raw("ui:help.cmdHelp.review");
    console.log(h.usage);
    console.log("");
    console.log(`  ${h.desc}`);
    console.log(`  ${h.descDetail}`);
    return;
  }

  const root = container.get("root");
  const t = translate();
  const targetDir = args.find((a) => !a.startsWith("-")) || path.join(root, "docs");
  const config = container.get("config");
  const type = config.type || "";

  let fail = 0;
  function reportFail(key, params) {
    console.log(t(key, params));
    fail = 1;
  }

  // Discover chapter files
  let chapterFiles = [];
  if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
    chapterFiles = getChapterFiles(targetDir, { type, configChapters: config.chapters, projectRoot: root });
  }

  if (chapterFiles.length === 0) {
    throw new Error(t("messages:review.noChapters", { dir: targetDir }));
  }

  console.log(t("messages:review.foundChapters", { count: chapterFiles.length }));

  const MIN_LINES = 15;

  for (const f of chapterFiles) {
    const filePath = path.join(targetDir, f);

    if (!fs.existsSync(filePath)) {
      reportFail("messages:review.missingFile", { path: filePath });
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    if (lines.length < MIN_LINES) {
      reportFail("messages:review.tooShort", { lines: lines.length, file: f });
    }

    if (!lines.some((line) => /^# /.test(line))) {
      reportFail("messages:review.missingH1", { file: f });
    }

    // Unfilled {{text}} directive check
    let unfilled = 0;
    {
      let inFence = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^(`{3,}|~{3,})/.test(lines[i].trim())) { inFence = !inFence; continue; }
        if (inFence) continue;
        if (!testIgnoringInlineCode(lines[i], /<!--\s*\{\{text\b/)) continue;
        let hasContent = false;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^<!--\s*\{\{\/text\}\}\s*-->$/.test(lines[j].trim())) break;
          if (lines[j].trim() !== "") { hasContent = true; break; }
        }
        if (!hasContent) unfilled++;
      }
    }
    if (unfilled > 0) {
      reportFail("messages:review.unfilledText", { count: unfilled, file: f });
    }
  }

  // Unfilled {{data}} directive check
  for (const f of chapterFiles) {
    const filePath = path.join(targetDir, f);
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    let unfilledData = 0;
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^(`{3,}|~{3,})/.test(lines[i].trim())) { inFence = !inFence; continue; }
      if (inFence) continue;
      if (!testIgnoringInlineCode(lines[i], /<!--\s*\{\{data\(/)) continue;
      let hasContent = false;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^<!--\s*\{\{\/data\}\}\s*-->$/.test(lines[j].trim())) break;
        if (lines[j].trim() !== "") { hasContent = true; break; }
      }
      if (!hasContent) unfilledData++;
    }
    if (unfilledData > 0) {
      reportFail("messages:review.unfilledData", { count: unfilledData, file: f });
    }
  }

  // Output integrity check (chapters + README.md)
  const integrityTargets = chapterFiles.map((f) => ({ label: f, path: path.join(targetDir, f) }));
  const readmePath = path.join(root, "README.md");
  if (fs.existsSync(readmePath)) {
    integrityTargets.push({ label: "README.md", path: readmePath });
  }

  for (const target of integrityTargets) {
    const content = fs.readFileSync(target.path, "utf8");
    const result = checkOutputIntegrity(content);
    if (result.exposedDirectives > 0) {
      reportFail("messages:review.exposedDirective", { count: result.exposedDirectives, file: target.label });
    }
    if (result.brokenComments) {
      reportFail("messages:review.brokenComment", { file: target.label });
    }
    if (result.residualBlocks > 0) {
      reportFail("messages:review.residualBlock", { count: result.residualBlocks, file: target.label });
    }
  }

  // analysis.json existence check
  const analysisPath = path.join(sddOutputDir(root), "analysis.json");
  if (!fs.existsSync(analysisPath)) {
    reportFail("messages:review.analysisNotFound");
  }

  // README.md check
  if (!fs.existsSync(path.join(root, "README.md"))) {
    reportFail("messages:review.readmeNotFound");
  }

  // Multi-language checks
  try {
    const docsCfg = config.docs;
    if (docsCfg.languages.length >= 2) {
      const docsBase = path.join(root, "docs");
      const nonDefaultLangs = docsCfg.languages.filter((l) => l !== docsCfg.defaultLanguage);
      for (const lang of nonDefaultLangs) {
        const langDir = path.join(docsBase, lang);
        if (!fs.existsSync(langDir)) {
          reportFail("messages:review.langDirMissing", { lang });
          continue;
        }
        const langFiles = getChapterFiles(langDir, { type, configChapters: config.chapters, projectRoot: root });
        if (langFiles.length === 0) {
          reportFail("messages:review.langNoChapters", { lang });
          continue;
        }
        for (const f of langFiles) {
          const filePath = path.join(langDir, f);
          const content = fs.readFileSync(filePath, "utf8");
          const lines = content.split("\n");
          const label = `${lang}/${f}`;
          if (lines.length < MIN_LINES) {
            reportFail("messages:review.tooShort", { lines: lines.length, file: label });
          }
          if (!lines.some((line) => /^# /.test(line))) {
            reportFail("messages:review.missingH1", { file: label });
          }
          const result = checkOutputIntegrity(content);
          if (result.exposedDirectives > 0) {
            reportFail("messages:review.exposedDirective", { count: result.exposedDirectives, file: label });
          }
          if (result.brokenComments) {
            reportFail("messages:review.brokenComment", { file: label });
          }
          if (result.residualBlocks > 0) {
            reportFail("messages:review.residualBlock", { count: result.residualBlocks, file: label });
          }
        }
      }
    }
  } catch (_) {
    // config not available — skip multi-lang check
  }

  // Analysis coverage check
  if (fs.existsSync(analysisPath)) {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const analysisCategories = Object.keys(analysis).filter((k) => !ANALYSIS_META_KEYS.has(k));

    if (analysisCategories.length > 0) {
      const referencedSources = new Set();
      const allDocsFiles = [...chapterFiles.map((f) => path.join(targetDir, f))];
      if (fs.existsSync(readmePath)) allDocsFiles.push(readmePath);

      for (const fp of allDocsFiles) {
        if (!fs.existsSync(fp)) continue;
        const content = fs.readFileSync(fp, "utf8");
        const directives = parseDirectives(content);
        for (const d of directives) {
          if (d.type === "data") referencedSources.add(d.source);
        }
      }

      for (const cat of analysisCategories) {
        if (!referencedSources.has(cat)) {
          const catData = analysis[cat];
          const entries = catData?.entries;
          const count = Array.isArray(entries) ? entries.length
            : (typeof catData === "object" && catData !== null) ? Object.keys(catData).length
            : 1;
          console.log(t("messages:review.uncoveredCategory", { cat, count }));
        }
      }
    }
  }

  if (fail !== 0) {
    throw new Error(t("messages:review.failed"));
  }

  console.log(t("messages:review.passed"));
}

export default class DocsReviewCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runReview(ctx._rawArgs || [], this.container);
  }
}


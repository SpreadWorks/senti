#!/usr/bin/env node
/**
 * src/docs/commands/agents.js
 *
 * AGENTS.md を更新する。
 * AGENTS.md 内の {{data("agents.sdd")}} / {{data("agents.project")}} ディレクティブを解決し、
 * PROJECT セクションは AI で精査する。
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "../../lib/cli.js";
import { sddOutputDir } from "../../lib/config.js";
import { container } from "../../lib/container.js";
import { translate } from "../../lib/i18n.js";
import { createResolver } from "../lib/resolver-factory.js";
import { createLogger } from "../../lib/progress.js";
import { parseDirectives, replaceBlockDirective, resolveDataDirectives } from "../lib/directive-parser.js";
import { loadFullAnalysis, getChapterFiles, readText } from "../lib/command-context.js";
import { loadSddTemplate } from "../../lib/agents-md.js";
import { resolveDocsContext } from "../lib/docs-context.js";
import { Command } from "../../lib/command.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";

const logger = createLogger("agents");

// ---------------------------------------------------------------------------
// AI プロンプト構築
// ---------------------------------------------------------------------------

function buildAgentsPromptBuilder(projectContent, docsContent, config, srcRoot, sddContent) {
  const t = translate();
  const rules = t.raw("prompts:agents.outputRules") || [];

  const pb = new PromptBuilder();
  pb.setRole(t("prompts:agents.systemPrompt"));
  pb.setRules("## Output Rules (strict)\n" + rules.map((r) => `- ${r}`).join("\n"));

  if (sddContent) {
    pb.add("## SDD Section (already present — do not duplicate)", sddContent);
  }

  pb.add("## Current PROJECT Section (template-generated)", projectContent);

  if (config.type) {
    const typeStr = Array.isArray(config.type) ? config.type.join(", ") : config.type;
    pb.add("## Project Config", `- type: ${typeStr}`);
  }

  const pkgPath = path.join(srcRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.scripts) {
        pb.add("## package.json scripts", JSON.stringify(pkg.scripts, null, 2));
      }
    } catch (_) { /* skip */ }
  }

  if (docsContent) {
    pb.add("## Generated Documentation", docsContent);
  }

  return pb;
}

// ---------------------------------------------------------------------------
// ディレクティブ解決
// ---------------------------------------------------------------------------

/**
 * AGENTS.md 内の {{data}} ディレクティブを解決する。
 * agents.project ディレクティブの解決結果を返す（AI 精査用）。
 */
function resolveAgentsDirectives(text, resolveFn) {
  let sddContent = null;
  let projectContent = null;

  const result = resolveDataDirectives(
    text,
    (preset, source, method, labels, params) => resolveFn(preset, source, method, {}, labels, params),
    {
      onResolve(d, rendered) {
        if (d.source === "agents" && d.method === "sdd") sddContent = rendered;
        if (d.source === "agents" && d.method === "project") projectContent = rendered;
      },
    },
  );

  return { text: result.text, sddContent, projectContent };
}

/**
 * AI 精査後の PROJECT セクションで、ディレクティブ内部を差し替える。
 */
function replaceProjectContent(text, refined) {
  const directives = parseDirectives(text);
  const lines = text.split("\n");

  for (let i = directives.length - 1; i >= 0; i--) {
    const d = directives[i];
    if (d.type !== "data" || d.source !== "agents" || d.method !== "project") continue;
    if (d.endLine < 0) continue;

    replaceBlockDirective(lines, d, refined);
    break;
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runAgents(ctx, rawArgs) {
  if (!ctx) {
    const cli = parseArgs(rawArgs, {
      flags: ["--dry-run"],
      options: [],
      defaults: { dryRun: false },
    });

    if (cli.help) {
      const tu = translate();
      const h = tu.raw("ui:help.cmdHelp.agents");
      const o = h.options;
      console.log([
        h.usage, "", `  ${h.desc}`, `  ${h.descDetail}`, "", "Options:",
        `  ${o.dryRun}`,
      ].join("\n"));
      return;
    }

    ctx = resolveDocsContext(container, cli);
    ctx.dryRun = cli.dryRun;
  }

  const { root, srcRoot, config, lang, t } = ctx;

  const agentsPath = path.join(srcRoot, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    // Generate from template
    const sddSection = loadSddTemplate(lang || config?.lang || "en");
    const template = [
      `# ${path.basename(srcRoot)}`,
      "",
      '<!-- {{data("agents.sdd")}} -->',
      sddSection,
      "<!-- {{/data}} -->",
      "",
      '<!-- {{data("agents.project")}} -->',
      "<!-- {{/data}} -->",
      "",
    ].join("\n");
    fs.writeFileSync(agentsPath, template, "utf8");
    logger.log(`created ${agentsPath}`);
  }

  // Load analysis
  const analysis = loadFullAnalysis(root);
  if (!analysis) {
    throw new Error(t("messages:agents.analysisNotFound", { path: path.join(sddOutputDir(root), "analysis.json") }));
  }

  // Load generated docs as context (instead of raw analysis.json)
  const docsDir = path.join(root, "docs");
  const chapterFiles = getChapterFiles(docsDir, { type: ctx.type, configChapters: ctx.config?.chapters, projectRoot: root });
  const docsContent = chapterFiles.map((f) => readText(path.join(docsDir, f))).join("\n\n");
  const readmeContent = readText(path.join(srcRoot, "README.md"));
  const combinedDocs = [docsContent, readmeContent].filter(Boolean).join("\n\n---\n\n");

  // Create resolver and resolve {{data}} directives
  const resolvedType = config.type || "base";
  const resolver = await createResolver(resolvedType, root, { configChapters: config.chapters });
  const resolveFn = (preset, source, method, a, labels, params) => resolver.resolve(preset, source, method, analysis, labels, params);

  let content = fs.readFileSync(agentsPath, "utf8");
  const { text: resolved, sddContent, projectContent } = resolveAgentsDirectives(content, resolveFn);
  content = resolved;

  // AI refinement for PROJECT section
  if (projectContent) {
    const agent = container.get("agent");
    if (!agent.resolve("docs.agents")) {
      throw new Error("No default agent configured. Set 'agent.default' in config.json or run 'sdd-forge setup'.");
    }

    logger.log(t("messages:agents.refining"));
    const agentsPb = buildAgentsPromptBuilder(projectContent, combinedDocs, config, srcRoot, sddContent);
    const agentsBuilt = agentsPb.build();

    try {
      const result = await agent.call(agentsBuilt.userPrompt, {
        commandId: "docs.agents",
        systemPrompt: agentsBuilt.systemPrompt,
      });

      let refined = result.trim();

      content = replaceProjectContent(content, refined);
    } catch (err) {
      throw new Error(`AI agent call failed: ${err.message}`);
    }

    logger.log(t("messages:agents.generated"));
  }

  if (ctx.dryRun) {
    logger.log(t("messages:agents.dryRun", { path: agentsPath }));
    console.log(content);
    return;
  }

  fs.writeFileSync(agentsPath, content, "utf8");
  console.log(t("messages:agents.updated", { path: agentsPath }));
}

export { runAgents };

export default class DocsAgentsCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runAgents(ctx.docsCtx, ctx._rawArgs || []);
  }
}

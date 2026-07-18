import fs from "fs";
import path from "path";
import { loadSpecDrivenDevelopmentTemplate } from "./agents-md.js";

export const AGENT_CONFIG_FILE_NAMES = ["AGENTS.md", "CLAUDE.md"];

export const AGENTS_SENTI_DIRECTIVE_RE =
  /<!--\s*\{\{data\("(?:(?:[^"]+)\.)?(?:agents\.senti|agents\.sdd|AGENTS\.sdd)"\)\}\}\s*-->[\s\S]*?<!--\s*\{\{\/data\}\}\s*-->/;

export function buildAgentsSentiBlock(lang, options = {}) {
  const specDrivenDevelopmentContent = loadSpecDrivenDevelopmentTemplate(lang, options);
  const lines = ['<!-- {{data("agents.senti")}} -->'];
  if (specDrivenDevelopmentContent) lines.push(specDrivenDevelopmentContent.trimEnd());
  lines.push("<!-- {{/data}} -->");
  return lines.join("\n");
}

export function buildAgentConfigContent(lang, options = {}) {
  return [
    buildAgentsSentiBlock(lang, options),
    "",
    '<!-- {{data("agents.project")}} -->',
    "<!-- {{/data}} -->",
  ].join("\n");
}

export function replaceAgentsSentiBlock(content, lang, options = {}) {
  if (!AGENTS_SENTI_DIRECTIVE_RE.test(content)) {
    return { found: false, changed: false, content };
  }
  const next = content.replace(AGENTS_SENTI_DIRECTIVE_RE, buildAgentsSentiBlock(lang, options));
  return { found: true, changed: next !== content, content: next };
}

export function refreshAgentSentiFile(filePath, lang, options = {}) {
  if (!fs.existsSync(filePath)) {
    return { file: path.basename(filePath), status: "missing" };
  }
  const before = fs.readFileSync(filePath, "utf8");
  const replaced = replaceAgentsSentiBlock(before, lang, options);
  if (!replaced.found) return { file: path.basename(filePath), status: "missing" };
  if (!replaced.changed) return { file: path.basename(filePath), status: "unchanged" };
  if (!options.dryRun) fs.writeFileSync(filePath, replaced.content, "utf8");
  return { file: path.basename(filePath), status: "updated" };
}

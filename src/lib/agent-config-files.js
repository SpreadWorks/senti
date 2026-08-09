import fs from "fs";
import path from "path";
import { loadSpecDrivenDevelopmentTemplate } from "./agents-md.js";

export const AGENT_CONFIG_FILE_NAMES = ["AGENTS.md", "CLAUDE.md"];

export const AGENTS_FLOW_DIRECTIVE_RE =
  /<!--\s*\{\{data\("agents\.flow"\)\}\}\s*-->[\s\S]*?<!--\s*\{\{\/data\}\}\s*-->/;

export function buildAgentsFlowBlock(lang, options = {}) {
  const specDrivenDevelopmentContent = loadSpecDrivenDevelopmentTemplate(lang, options);
  const lines = ['<!-- {{data("agents.flow")}} -->'];
  if (specDrivenDevelopmentContent) lines.push(specDrivenDevelopmentContent.trimEnd());
  lines.push("<!-- {{/data}} -->");
  return lines.join("\n");
}

export function buildAgentConfigContent(lang, options = {}) {
  return [
    buildAgentsFlowBlock(lang, options),
    "",
    '<!-- {{data("agents.project")}} -->',
    "<!-- {{/data}} -->",
  ].join("\n");
}

export function replaceAgentsFlowBlock(content, lang, options = {}) {
  if (!AGENTS_FLOW_DIRECTIVE_RE.test(content)) {
    return { found: false, changed: false, content };
  }
  const next = content.replace(AGENTS_FLOW_DIRECTIVE_RE, buildAgentsFlowBlock(lang, options));
  return { found: true, changed: next !== content, content: next };
}

export function refreshAgentFlowFile(filePath, lang, options = {}) {
  if (!fs.existsSync(filePath)) {
    return { file: path.basename(filePath), status: "missing" };
  }
  const before = fs.readFileSync(filePath, "utf8");
  const replaced = replaceAgentsFlowBlock(before, lang, options);
  if (!replaced.found) return { file: path.basename(filePath), status: "missing" };
  if (!replaced.changed) return { file: path.basename(filePath), status: "unchanged" };
  if (!options.dryRun) fs.writeFileSync(filePath, replaced.content, "utf8");
  return { file: path.basename(filePath), status: "updated" };
}

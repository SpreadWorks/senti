/**
 * AgentsSource — DataSource for AGENTS.md section generation.
 *
 * Provides Spec-Driven Development template and PROJECT section skeleton as {{data}} directives.
 */

import fs from "fs";
import path from "path";
import { loadSpecDrivenDevelopmentTemplate } from "../lib/agents-md.js";
import { formatUTCTimestamp } from "../lib/cli.js";
import { PRODUCT } from "../lib/product.js";

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Paragraph = container.get("base.Paragraph");
  const loadJsonFile = container.get("config.loadJsonFile");

  class AgentsSource extends DataSource {
  init(ctx) {
    super.init(ctx);
    this._root = ctx.root;
  }

  /** Return Spec-Driven Development section template for the configured language. */
  flow(_analysis, _labels) {
    const lang = this._lang();
    const config = this._loadConfig();
    const presetTypes = config.type || "base";
    const text = loadSpecDrivenDevelopmentTemplate(lang, {
      projectRoot: this._root,
      presetTypes,
    });
    return text ? new Paragraph(text) : null;
  }

  /** Generate PROJECT section skeleton from analysis data. */
  project(analysis, _labels) {
    if (!analysis) return null;

    const config = this._loadConfig();
    const srcRoot = this._root;
    const lines = [];

    lines.push("## Project Context");
    lines.push("");
    lines.push(`- **generated_at:** ${formatUTCTimestamp()}`);

    // Package info
    const pkg = this._loadPkg();
    if (pkg) {
      const parts = [];
      if (pkg.name) parts.push(`\`${pkg.name}\``);
      if (pkg.version) parts.push(`v${pkg.version}`);
      if (parts.length > 0) lines.push(`- **package:** ${parts.join(" ")}`);
      if (pkg.description) lines.push(`- **description:** ${pkg.description}`);
    }

    lines.push("");

    if (config.type) {
      lines.push("### Technology Stack");
      lines.push("");
      const typeStr = Array.isArray(config.type) ? config.type.join(", ") : config.type;
      lines.push(`- type: ${typeStr}`);

      if (analysis.package?.composerDeps?.require) {
        const req = analysis.package.composerDeps.require;
        if (req.php) lines.push(`- PHP: ${req.php}`);
      }

      if (pkg?.engines?.node) lines.push(`- Node.js: ${pkg.engines.node}`);
      lines.push("");
    }

    // Structure summary
    const ctrl = analysis.controllers?.summary;
    const mdl = analysis.models?.summary;
    const cmd = analysis.commands?.summary;
    const rt = analysis.routes?.summary;

    if (ctrl || mdl || cmd || rt) {
      lines.push("### Structure Summary");
      lines.push("");
      lines.push("| category | count | details |");
      lines.push("| --- | --- | --- |");
      if (ctrl) lines.push(`| Controllers | ${ctrl.total} | ${ctrl.totalActions} actions |`);
      if (mdl) lines.push(`| Models | ${mdl.total} | FE: ${mdl.feModels || 0}, Logic: ${mdl.logicModels || 0} |`);
      if (cmd) lines.push(`| Commands | ${cmd.total} | — |`);
      if (rt) lines.push(`| Routes | ${rt.total} | ${(rt.controllers || []).length} controllers |`);
      lines.push("");
    }

    // Database groups
    if (mdl?.dbGroups) {
      const groups = Object.entries(mdl.dbGroups).filter(([, v]) => v.length > 0);
      if (groups.length > 0) {
        lines.push("### Database Groups");
        lines.push("");
        lines.push("| connection | models |");
        lines.push("| --- | --- |");
        for (const [name, models] of groups) {
          lines.push(`| ${name} | ${models.length} |`);
        }
        lines.push("");
      }
    }

    // Available commands (from package.json scripts)
    if (pkg?.scripts && Object.keys(pkg.scripts).length > 0) {
      lines.push("### Available Commands");
      lines.push("");
      lines.push("| command | script |");
      lines.push("| --- | --- |");
      for (const [name, script] of Object.entries(pkg.scripts)) {
        lines.push(`| \`npm run ${name}\` | ${script.replace(/\|/g, "\\|")} |`);
      }
      lines.push("");
    }

    return new Paragraph(lines.join("\n"));
  }

  _lang() {
    const config = this._loadConfig();
    return config.lang;
  }

  _loadConfig() {
    try {
      return loadJsonFile(path.join(this._root, PRODUCT.managedPath("config.json")));
    } catch (_) {
      return {};
    }
  }

  _loadPkg() {
    const pkgPath = path.join(this._root, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch (_) {
      return null;
    }
  }
  }

  return AgentsSource;
}

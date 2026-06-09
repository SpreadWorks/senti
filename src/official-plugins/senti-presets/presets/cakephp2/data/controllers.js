/**
 * ControllersSource — CakePHP 2.x controllers DataSource.
 *
 * Extends webapp ControllersSource with CakePHP-specific parse logic
 * and resolve methods (csv, actions).
 */

import fs from "fs";

const LIFECYCLE_METHODS = new Set([
  "beforeFilter",
  "afterFilter",
  "beforeRender",
  "beforeRedirect",
  "constructClasses",
  "initialize",
  "startup",
  "shutdownProcess",
]);

export default function register(container) {
  const stripBlockComments = container.get("phpParser.stripBlockComments");
  const extractArrayBody = container.get("phpParser.extractArrayBody");
  const extractQuotedStrings = container.get("phpParser.extractQuotedStrings");
  const webapp = container.getPreset("webapp").dataSources;
  const ControllersSource = webapp.controllers;
  const ControllerEntry = ControllersSource.Entry;

  class CakephpControllersSource extends ControllersSource {
    static Entry = ControllerEntry;

    match(relPath) {
      return /Controller\.php$/.test(relPath)
        && relPath.includes("Controller/")
        && !/AppController\.php$/.test(relPath);
    }

    parse(absPath) {
      const entry = new ControllerEntry();
      const raw = fs.readFileSync(absPath, "utf8");
      const src = stripBlockComments(raw);

      const classMatch = src.match(/class\s+(\w+)\s+extends\s+(\w+)/);
      if (!classMatch) return entry;

      entry.className = classMatch[1];
      entry.parentClass = classMatch[2];

      const componentsBody = extractArrayBody(src, "components");
      entry.components = componentsBody
        ? extractQuotedStrings(componentsBody)
        : [];

      const usesBody = extractArrayBody(src, "uses");
      entry.uses = usesBody ? extractQuotedStrings(usesBody) : [];

      const actions = [];
      const fnRe = /public\s+function\s+(\w+)\s*\(/g;
      let fm;
      while ((fm = fnRe.exec(src)) !== null) {
        const name = fm[1];
        if (!LIFECYCLE_METHODS.has(name) && !name.startsWith("_")) {
          actions.push(name);
        }
      }
      entry.actions = actions;

      return entry;
    }

    csv(analysis, labels) {
      const csvMap = this.overrides().controllersCsv || {};
      const entries = Object.entries(csvMap).sort(([a], [b]) => a.localeCompare(b));
      if (entries.length === 0) return null;
      const rows = entries.map(([name, ops]) => [
        name,
        ops.csvImport ? "○" : "—",
        ops.csvExport ? "○" : "—",
        ops.excelExport ? "○" : "—",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    actions(analysis, labels) {
      if (!analysis.config?.entries) return null;
      const configEntries = analysis.config.entries;
      const allMappings = configEntries.flatMap((e) => e.titlesGraphMapping || []);
      const items = allMappings.filter((m) => m.logicClasses.length > 0);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (m) => [
        m.action,
        m.logicClasses.join(", "),
        m.outputType,
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpControllersSource;
}

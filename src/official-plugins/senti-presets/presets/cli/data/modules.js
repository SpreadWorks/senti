/**
 * ModulesSource — CLI common modules scan + resolve.
 *
 * Generic category analyzer for CLI presets (e.g. node-cli).
 * Scans source files and extracts classes/functions.
 */

import fs from "fs";

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const parseFile = container.get("scanner.parseFile");
  const getLangHandler = container.get("lang.getHandler");

  class ModuleEntry extends AnalysisEntry {
    className = null;
    methods = null;
    imports = null;
    exports = null;
    extends = null;
    usedBy = null;

    static summary = {
      totalMethods: { field: "methods", aggregate: "count" },
    };
  }

  class ModulesSource extends Scannable(DataSource) {
    static Entry = ModuleEntry;

    match(relPath) {
      return /\.(js|mjs|cjs)$/.test(relPath);
    }

    parse(absPath) {
      const entry = new ModuleEntry();
      const parsed = parseFile(absPath);
      entry.className = parsed.className;
      entry.methods = parsed.methods;
      entry.extends = parsed.parentClass || null;

      // Extract imports/exports via language handler
      const handler = getLangHandler(absPath);
      if (handler) {
        const content = parsed.content || fs.readFileSync(absPath, "utf8");
        if (handler.extractImports) entry.imports = handler.extractImports(content);
        if (handler.extractExports) entry.exports = handler.extractExports(content);
      }

      return entry;
    }

    /** Module list table. */
    list(analysis, labels) {
      const items = this.mergeDesc(analysis.modules?.entries || [], "modules");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (m) => [
        m.className,
        m.file,
        m.summary || "—",
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return ModulesSource;
}

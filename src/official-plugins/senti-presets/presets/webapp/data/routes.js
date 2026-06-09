/**
 * RoutesSource — webapp common routes scan + resolve.
 *
 * Child presets extend this class to add FW-specific route parsing
 * and resolve methods.
 */

import fs from "fs";

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");

  class WebappDataSource extends Scannable(DataSource) {}

  class RouteEntry extends AnalysisEntry {
    pattern = null;
    controller = null;
    action = null;
    raw = null;

    static summary = {};
  }

  class RoutesSource extends WebappDataSource {
    static Entry = RouteEntry;

    match(relPath) {
      return false;
    }

    parse(absPath) {
      const entry = new RouteEntry();
      const content = fs.readFileSync(absPath, "utf8");

      // PHP route patterns — parse first match only (one entry per file).
      // Child presets override parse() for FW-specific multi-route extraction.
      const routeRegex =
        /(?:Router::connect|Route::(?:get|post|put|delete|any|match))\s*\(\s*['"]([^'"]+)['"]/;
      const m = routeRegex.exec(content);
      if (m) {
        entry.pattern = m[1];
        const ctrlMatch = content
          .slice(m.index, m.index + 500)
          .match(/['"]controller['"]\s*=>\s*['"](\w+)['"]/);
        const actionMatch = content
          .slice(m.index, m.index + 500)
          .match(/['"]action['"]\s*=>\s*['"](\w+)['"]/);
        entry.controller = ctrlMatch ? ctrlMatch[1] : "";
        entry.action = actionMatch ? actionMatch[1] : "";
        entry.raw = content.slice(m.index, content.indexOf("\n", m.index)).trim();
      }
      return entry;
    }

    /** Route list table. */
    list(analysis, labels) {
      const routes = analysis.routes?.entries || [];
      if (routes.length === 0) return null;
      const rows = this.toRows(routes, (r) => [
        r.pattern,
        r.controller,
        r.action,
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return RoutesSource;
}

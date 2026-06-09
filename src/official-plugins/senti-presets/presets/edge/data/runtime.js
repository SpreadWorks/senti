/**
 * EdgeRuntimeSource — Scannable DataSource for edge runtime.
 *
 * Scans wrangler.toml to extract entry points and runtime constraints.
 * Reads analysis.runtime to generate tables.
 */

import fs from "fs";
import path from "path";

const WRANGLER_FILES = new Set(["wrangler.toml", "wrangler.json", "wrangler.jsonc"]);

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const parseTOML = container.get("toml.parse");

  class EdgeRuntimeEntry extends AnalysisEntry {
    entryPoints = null;
    constraints = null;

    static summary = {};
  }

  class EdgeRuntimeSource extends Scannable(DataSource) {
    static Entry = EdgeRuntimeEntry;

    match(relPath) {
      return WRANGLER_FILES.has(path.basename(relPath));
    }

    parse(absPath) {
      const entry = new EdgeRuntimeEntry();
      const raw = fs.readFileSync(absPath, "utf8");
      const fileName = path.basename(absPath);
      const isToml = fileName === "wrangler.toml";

      let cfg;
      try {
        cfg = isToml ? parseTOML(raw) : JSON.parse(raw);
      } catch (_) {
        return entry;
      }

      // Entry points
      const entryPoints = [];
      const mainEntry = cfg.main || (cfg.build && cfg.build.upload && cfg.build.upload.main);
      if (mainEntry) {
        entryPoints.push({ name: mainEntry, trigger: "fetch", file: mainEntry });
      }

      // Routes
      const routes = cfg.routes || cfg.route;
      if (routes) {
        const routeList = Array.isArray(routes) ? routes : [routes];
        for (const r of routeList) {
          const pattern = typeof r === "string" ? r : r.pattern || r;
          entryPoints.push({ name: String(pattern), trigger: "route", file: mainEntry || "" });
        }
      }

      // Constraints
      const constraints = [];
      if (cfg.compatibility_date) {
        constraints.push({ name: "compatibility_date", value: cfg.compatibility_date });
      }
      if (cfg.compatibility_flags) {
        constraints.push({ name: "compatibility_flags", value: cfg.compatibility_flags.join(", ") });
      }
      if (cfg.node_compat !== undefined) {
        constraints.push({ name: "node_compat", value: String(cfg.node_compat) });
      }

      entry.entryPoints = entryPoints;
      entry.constraints = constraints;
      return entry;
    }

    /** Edge function entry points table. */
    entryPoints(analysis, labels) {
      const entries = analysis.runtime?.entries || [];
      const items = entries.flatMap((e) => e.entryPoints || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (e) => [
        e.name || e.route || "—",
        e.trigger || "—",
        e.file || "—",
        e.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Function", "Trigger", "File", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Runtime constraints table. */
    constraints(analysis, labels) {
      const entries = analysis.runtime?.entries || [];
      const items = entries.flatMap((e) => e.constraints || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (c) => [
        c.name || "—",
        c.value || "—",
        c.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Constraint", "Value", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return EdgeRuntimeSource;
}

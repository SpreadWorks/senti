/**
 * WorkersBindingsSource — Scannable DataSource for Cloudflare Workers bindings.
 *
 * Scans wrangler.toml / wrangler.json to extract bindings, env vars,
 * entry points, and runtime constraints.
 * Reads analysis.bindings to generate tables.
 */

import fs from "fs";
import path from "path";

const WRANGLER_FILES = new Set(["wrangler.toml", "wrangler.json", "wrangler.jsonc"]);

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const parseTOML = container.get("toml.parse");

  class BindingsEntry extends AnalysisEntry {
    bindings = null;
    env = null;
    entryPoints = null;
    constraints = null;

    static summary = {};
  }

  class WorkersBindingsSource extends Scannable(DataSource) {
    static Entry = BindingsEntry;

    match(relPath) {
      return WRANGLER_FILES.has(path.basename(relPath));
    }

    parse(absPath) {
      const entry = new BindingsEntry();
      const raw = fs.readFileSync(absPath, "utf8");
      const fileName = path.basename(absPath);
      const isToml = fileName === "wrangler.toml";

      let cfg;
      try {
        if (isToml) {
          cfg = parseTOML(raw);
        } else {
          // wrangler.json / wrangler.jsonc — strip single-line comments for JSONC
          const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
          cfg = JSON.parse(stripped);
        }
      } catch (_) {
        return entry;
      }

      // Bindings
      const bindings = [];
      for (const kv of cfg.kv_namespaces || []) {
        bindings.push({ name: kv.binding, type: "KV Namespace", id: kv.id || "" });
      }
      for (const r2 of cfg.r2_buckets || []) {
        bindings.push({ name: r2.binding, type: "R2 Bucket", id: r2.bucket_name || "" });
      }
      for (const d1 of cfg.d1_databases || []) {
        bindings.push({ name: d1.binding, type: "D1 Database", id: d1.database_id || "" });
      }
      for (const svc of cfg.services || []) {
        bindings.push({ name: svc.binding, type: "Service", id: svc.service || "" });
      }
      for (const dobj of cfg.durable_objects?.bindings || []) {
        bindings.push({ name: dobj.name, type: "Durable Object", id: dobj.class_name || "" });
      }

      // Environment variables (vars section)
      const vars = cfg.vars || {};
      const env = Object.entries(vars).map(([name, value]) => ({
        name,
        type: typeof value,
        value: String(value),
      }));

      // Entry points
      const entryPoints = [];
      const mainEntry = cfg.main || (cfg.build && cfg.build.upload && cfg.build.upload.main);
      if (mainEntry) {
        entryPoints.push({ path: mainEntry, trigger: "fetch", file: mainEntry });
      }
      const routes = cfg.routes || cfg.route;
      if (routes) {
        const routeList = Array.isArray(routes) ? routes : [routes];
        for (const r of routeList) {
          const pattern = typeof r === "string" ? r : r.pattern || r;
          entryPoints.push({ route: String(pattern), trigger: "route", file: mainEntry || "" });
        }
      }
      const triggers = cfg.triggers;
      if (triggers && triggers.crons) {
        for (const cron of triggers.crons) {
          entryPoints.push({ route: cron, trigger: "cron", file: mainEntry || "" });
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

      entry.bindings = bindings;
      entry.env = env;
      entry.entryPoints = entryPoints;
      entry.constraints = constraints;
      return entry;
    }

    /** Bindings list table (KV, R2, D1, etc.). */
    list(analysis, labels) {
      const entries = analysis.bindings?.entries || [];
      const items = entries.flatMap((e) => e.bindings || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (b) => [
        b.name || "—",
        b.type || "—",
        b.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Name", "Type", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Environment variables and secrets table. */
    env(analysis, labels) {
      const entries = analysis.bindings?.entries || [];
      const items = entries.flatMap((e) => e.env || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (e) => [
        e.name || "—",
        e.type || "—",
        e.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Name", "Type", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Worker entry points table. */
    entryPoints(analysis, labels) {
      const entries = analysis.bindings?.entries || [];
      const items = entries.flatMap((e) => e.entryPoints || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (e) => [
        e.route || e.path || "—",
        e.trigger || "—",
        e.file || "—",
        e.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Route", "Trigger", "File", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Runtime constraints table. */
    constraints(analysis, labels) {
      const entries = analysis.bindings?.entries || [];
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

  return WorkersBindingsSource;
}

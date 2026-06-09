/**
 * Directory-level analyzers for Workers preset tests.
 *
 * These helpers are used only by unit tests. They were previously
 * exported from data/*.js modules but have been relocated here so
 * that preset data/ files do not import senti internals
 * (spec 191: preset DI container).
 */

import fs from "fs";
import path from "path";
import { parseTOML } from "../../../docs/lib/toml-parser.js";

const WRANGLER_FILES_LIST = ["wrangler.toml", "wrangler.json", "wrangler.jsonc"];

/**
 * @param {string} projectRoot - project root directory containing wrangler config
 * @returns {Object} parsed bindings data
 */
export function analyzeBindings(projectRoot) {
  let cfg = null;

  for (const fileName of WRANGLER_FILES_LIST) {
    const filePath = path.join(projectRoot, fileName);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf8");
    if (fileName === "wrangler.toml") {
      cfg = parseTOML(raw);
    } else {
      // wrangler.json / wrangler.jsonc — strip single-line comments for JSONC
      const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
      cfg = JSON.parse(stripped);
    }
    break;
  }

  if (!cfg) {
    return {
      bindings: [],
      env: [],
      entryPoints: [],
      constraints: [],
      summary: { totalBindings: 0, totalEnvVars: 0, totalEntryPoints: 0 },
    };
  }

  const bindings = [];

  // KV namespaces
  for (const kv of cfg.kv_namespaces || []) {
    bindings.push({ name: kv.binding, type: "KV Namespace", id: kv.id || "" });
  }

  // R2 buckets
  for (const r2 of cfg.r2_buckets || []) {
    bindings.push({ name: r2.binding, type: "R2 Bucket", id: r2.bucket_name || "" });
  }

  // D1 databases
  for (const d1 of cfg.d1_databases || []) {
    bindings.push({ name: d1.binding, type: "D1 Database", id: d1.database_id || "" });
  }

  // Service bindings
  for (const svc of cfg.services || []) {
    bindings.push({ name: svc.binding, type: "Service", id: svc.service || "" });
  }

  // Durable Objects
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

  // Routes / triggers
  const routes = cfg.routes || cfg.route;
  if (routes) {
    const routeList = Array.isArray(routes) ? routes : [routes];
    for (const r of routeList) {
      const pattern = typeof r === "string" ? r : r.pattern || r;
      entryPoints.push({ route: String(pattern), trigger: "route", file: mainEntry || "" });
    }
  }

  // Scheduled triggers (crons)
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

  return {
    bindings,
    env,
    entryPoints,
    constraints,
    summary: {
      totalBindings: bindings.length,
      totalEnvVars: env.length,
      totalEntryPoints: entryPoints.length,
    },
  };
}

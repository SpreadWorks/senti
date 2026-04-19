/**
 * RoutesSource — Symfony routes DataSource.
 *
 * Extends the webapp parent RoutesSource with Symfony-specific
 * parse logic and resolve methods.
 *
 * Symfony routes come from two sources:
 * - YAML config files (config/routes*.yaml)
 * - PHP #[Route] attributes on controllers
 *
 * parse() handles YAML route files. Attribute routes are extracted
 * by the controllers DataSource.
 *
 * Available methods (called via {{data}} directives):
 *   routes.list("Methods|Path|Controller|Name")
 *   routes.attribute("Methods|Path|Controller|Name")
 *   routes.yaml("Methods|Path|Controller|Name")
 */

import fs from "fs";

/**
 * Simple YAML parser for Symfony route YAML patterns.
 * Uses regex-based extraction (no full YAML parser).
 */
function parseYamlContent(content) {
  const routes = [];
  const lines = content.split("\n");

  let currentRoute = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Top-level route name (no indent, ends with colon)
    const routeNameMatch = line.match(/^(\w[\w._-]*):\s*$/);
    if (routeNameMatch) {
      if (currentRoute && currentRoute.path) routes.push(currentRoute);
      currentRoute = { name: routeNameMatch[1], path: "", controller: "", methods: [], source: "yaml" };
      continue;
    }

    // Inline route: route_name: { path: /xxx, controller: ... }
    const inlineMatch = line.match(/^(\w[\w._-]*):\s*\{(.+)\}\s*$/);
    if (inlineMatch) {
      if (currentRoute && currentRoute.path) routes.push(currentRoute);
      const name = inlineMatch[1];
      const body = inlineMatch[2];
      const pathMatch = body.match(/path:\s*([^\s,}]+)/);
      const ctrlMatch = body.match(/controller:\s*([^\s,}]+)/);
      currentRoute = {
        name,
        path: pathMatch ? pathMatch[1] : "",
        controller: ctrlMatch ? ctrlMatch[1] : "",
        methods: [],
        source: "yaml",
      };
      continue;
    }

    if (!currentRoute) continue;

    // path: /xxx
    const pathMatch = trimmed.match(/^path:\s*(.+)/);
    if (pathMatch) {
      currentRoute.path = pathMatch[1].trim();
      continue;
    }

    // controller: App\Controller\XxxController::method
    const ctrlMatch = trimmed.match(/^controller:\s*(.+)/);
    if (ctrlMatch) {
      currentRoute.controller = ctrlMatch[1].trim();
      continue;
    }

    // methods: GET|POST or methods: [GET, POST]
    const methodsMatch = trimmed.match(/^methods:\s*(.+)/);
    if (methodsMatch) {
      const val = methodsMatch[1].trim();
      if (val.startsWith("[")) {
        currentRoute.methods = val.replace(/[\[\]]/g, "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      } else {
        currentRoute.methods = val.split("|").map((s) => s.trim().toUpperCase()).filter(Boolean);
      }
    }

    // type: annotation/attribute — controller import, not a specific route
    const typeMatch = trimmed.match(/^type:\s*(annotation|attribute)/);
    if (typeMatch) {
      currentRoute = null;
    }
  }

  if (currentRoute && currentRoute.path) routes.push(currentRoute);

  return routes;
}

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const webapp = container.getPreset("webapp").dataSources;
  const RoutesSource = webapp.routes;
  const RouteEntry = RoutesSource.Entry;

  class SymfonyRouteEntry extends RouteEntry {
    name = null;
    methods = null;
    source = null;

    static summary = {};
  }

  class SymfonyRoutesSource extends RoutesSource {
    static Entry = SymfonyRouteEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "config/routes") && /\.(yaml|yml|xml|php)$/.test(relPath);
    }

    parse(absPath) {
      const entry = new SymfonyRouteEntry();
      const content = fs.readFileSync(absPath, "utf8");

      // Parse YAML route definitions from the file
      const routes = parseYamlContent(content);

      // For the entry-per-file model, store the first route's data
      // (multi-route files will produce partial data; the main route
      // inventory comes from the flat routes list below)
      if (routes.length > 0) {
        const first = routes[0];
        entry.pattern = first.path;
        entry.controller = first.controller;
        entry.action = "";
        entry.raw = `${first.name}: ${first.path}`;
        entry.name = first.name;
        entry.methods = first.methods;
        entry.source = "yaml";
      }

      return entry;
    }

    /** All routes table. */
    list(analysis, labels) {
      const routes = analysis.routes?.entries || [];
      if (routes.length === 0) return null;
      const rows = this.toRows(routes, (r) => [
        (r.methods || []).join("|") || "*",
        r.pattern || r.path || "",
        r.controller,
        r.name || "",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Attribute-defined routes table. */
    attribute(analysis, labels) {
      const routes = (analysis.routes?.entries || []).filter(
        (r) => r.source === "attribute",
      );
      if (routes.length === 0) return null;
      const rows = this.toRows(routes, (r) => [
        (r.methods || []).join("|") || "*",
        r.pattern || r.path || "",
        r.controller,
        r.name || "",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** YAML-defined routes table. */
    yaml(analysis, labels) {
      const routes = (analysis.routes?.entries || []).filter(
        (r) => r.source === "yaml",
      );
      if (routes.length === 0) return null;
      const rows = this.toRows(routes, (r) => [
        (r.methods || []).join("|") || "*",
        r.pattern || r.path || "",
        r.controller,
        r.name || "",
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return SymfonyRoutesSource;
}

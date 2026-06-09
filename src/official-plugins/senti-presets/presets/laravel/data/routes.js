/**
 * RoutesSource — Laravel routes DataSource.
 *
 * Extends the webapp parent RoutesSource with Laravel-specific
 * parse logic and resolve methods.
 *
 * Each route file (routes/web.php, routes/api.php) is parsed into a single
 * LaravelRouteEntry whose `routes` array holds all route definitions found
 * in that file. The resolve methods flatten these across entries.
 *
 * Available methods (called via {{data}} directives):
 *   routes.list("Method|URI|Controller|Action")
 *   routes.api("Method|URI|Controller|Action")
 */

import fs from "fs";

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const webapp = container.getPreset("webapp").dataSources;
  const RoutesSource = webapp.routes;
  const RouteEntry = RoutesSource.Entry;

  class LaravelRouteEntry extends RouteEntry {
    /** All routes extracted from a single route file. */
    routes = null;
    /** "web" or "api" */
    routeType = null;
  }

  function parseHandler(handler) {
    // [UserController::class, 'index']
    const arrayMatch = handler.match(
      /\[\s*([\w\\:]+)\s*,\s*['"](\w+)['"]\s*\]/,
    );
    if (arrayMatch) {
      const controller = arrayMatch[1].replace(/::class$/, "").split("\\").pop();
      return { controller, action: arrayMatch[2] };
    }

    // 'UserController@index'
    const strMatch = handler.match(/['"](\w+)@(\w+)['"]/);
    if (strMatch) {
      return { controller: strMatch[1], action: strMatch[2] };
    }

    // Closure or single-action controller
    const classMatch = handler.match(/([\w\\]+)::class/);
    if (classMatch) {
      return { controller: classMatch[1].split("\\").pop(), action: "__invoke" };
    }

    return { controller: "", action: "" };
  }

  function parseStringList(str) {
    const items = [];
    const re = /['"](\w+)['"]/g;
    let match;
    while ((match = re.exec(str)) !== null) items.push(match[1]);
    return items;
  }

  function filterResourceActions(actions, chain) {
    const onlyMatch = chain.match(/->only\s*\(\s*\[([^\]]*)\]\s*\)/);
    if (onlyMatch) {
      const allowed = parseStringList(onlyMatch[1]);
      return actions.filter((a) => allowed.includes(a));
    }
    const exceptMatch = chain.match(/->except\s*\(\s*\[([^\]]*)\]\s*\)/);
    if (exceptMatch) {
      const excluded = parseStringList(exceptMatch[1]);
      return actions.filter((a) => !excluded.includes(a));
    }
    return actions;
  }

  function singularize(name) {
    if (name.endsWith("ies")) return name.slice(0, -3) + "y";
    if (
      name.endsWith("ses") ||
      name.endsWith("xes") ||
      name.endsWith("zes") ||
      name.endsWith("shes") ||
      name.endsWith("ches")
    )
      return name.slice(0, -2);
    if (name.endsWith("s")) return name.slice(0, -1);
    return name;
  }

  function buildResourceUri(resourceName, routeType) {
    const segments = resourceName.split(".");
    const parts = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      parts.push(seg);
      if (i < segments.length - 1) {
        parts.push(`{${singularize(seg)}}`);
      }
    }
    const base = "/" + parts.join("/");
    return routeType === "api" ? `/api${base}` : base;
  }

  function resourceActionUri(baseUri, resourceName, action) {
    const lastSegment = resourceName.split(".").pop();
    const param = singularize(lastSegment);
    const needsParam = ["show", "edit", "update", "destroy"].includes(action);
    const suffix = needsParam ? `/{${param}}` : "";
    const editSuffix = action === "edit" ? "/edit" : "";
    return baseUri + suffix + editSuffix;
  }

  function resourceMethod(action) {
    const map = {
      index: "GET",
      create: "GET",
      store: "POST",
      show: "GET",
      edit: "GET",
      update: "PUT",
      destroy: "DELETE",
    };
    return map[action] || "GET";
  }

  function parseRouteFile(content, routeType) {
    const routes = [];

    // Route::get|post|put|patch|delete|any|options
    const methods = "get|post|put|patch|delete|any|options";
    const routeRegex = new RegExp(
      `Route::(?:${methods})\\s*\\(\\s*['"]([^'"]+)['"]\\s*,\\s*(.+?)\\s*\\)`,
      "g",
    );

    let m;
    while ((m = routeRegex.exec(content)) !== null) {
      const httpMethod = m[0].match(/Route::(\w+)/)[1].toUpperCase();
      const uri = m[1];
      const handler = m[2];
      const parsed = parseHandler(handler);

      routes.push({
        httpMethod: httpMethod === "ANY" ? "*" : httpMethod,
        uri: routeType === "api" ? `/api${uri}` : uri,
        controller: parsed.controller,
        action: parsed.action,
        routeType,
      });
    }

    // Route::resource / Route::apiResource
    const resourceRegex =
      /Route::(?:api)?[Rr]esource\s*\(\s*['"]([^'"]+)['"]\s*,\s*([\w\\:]+)\s*\)([^\n;]*)/g;
    while ((m = resourceRegex.exec(content)) !== null) {
      const resourceName = m[1];
      const controller = m[2].replace(/::class$/, "").split("\\").pop();
      const chain = m[3];
      const isApi = m[0].includes("apiResource");
      const allActions = isApi
        ? ["index", "store", "show", "update", "destroy"]
        : ["index", "create", "store", "show", "edit", "update", "destroy"];
      const actions = filterResourceActions(allActions, chain);

      const baseUri = buildResourceUri(resourceName, routeType);

      for (const action of actions) {
        routes.push({
          httpMethod: resourceMethod(action),
          uri: resourceActionUri(baseUri, resourceName, action),
          controller,
          action,
          routeType,
        });
      }
    }

    return routes;
  }

  /**
   * Flatten per-file route entries into a single array of route objects.
   */
  function flattenRoutes(entries) {
    return entries.flatMap((e) => e.routes || []);
  }

  class LaravelRoutesSource extends RoutesSource {
    static Entry = LaravelRouteEntry;

    match(relPath) {
      return (
        hasPathPrefix(relPath, "routes/") &&
        relPath.endsWith(".php")
      );
    }

    parse(absPath) {
      const entry = new LaravelRouteEntry();
      const content = fs.readFileSync(absPath, "utf8");

      // Determine route type from file name
      entry.routeType = absPath.includes("/api.php") ? "api" : "web";
      entry.routes = parseRouteFile(content, entry.routeType);

      // Set pattern/controller/action from first route for summary compatibility
      if (entry.routes.length > 0) {
        const first = entry.routes[0];
        entry.pattern = first.uri;
        entry.controller = first.controller;
        entry.action = first.action;
      }

      return entry;
    }

    /** All routes table. */
    list(analysis, labels) {
      const allRoutes = flattenRoutes(analysis.routes?.entries || []);
      if (allRoutes.length === 0) return null;
      const rows = this.toRows(allRoutes, (r) => [
        r.httpMethod,
        r.uri,
        r.controller,
        r.action,
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** API routes only. */
    api(analysis, labels) {
      const allRoutes = flattenRoutes(analysis.routes?.entries || []);
      const apiRoutes = allRoutes.filter((r) => r.routeType === "api");
      if (apiRoutes.length === 0) return null;
      const rows = this.toRows(apiRoutes, (r) => [
        r.httpMethod,
        r.uri,
        r.controller,
        r.action,
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return LaravelRoutesSource;
}

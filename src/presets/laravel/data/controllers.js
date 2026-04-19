/**
 * ControllersSource — Laravel controllers DataSource.
 *
 * Extends the webapp parent ControllersSource with Laravel-specific
 * parse logic and resolve methods.
 *
 * Available methods (called via {{data}} directives):
 *   controllers.list("Name|File|Description")
 *   controllers.actions("Controller|Action")
 *   controllers.middleware("Middleware|Controllers")
 */

import fs from "fs";

const SKIP_DI_TYPES = new Set(["Request", "array", "string", "int", "bool"]);

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const webapp = container.getPreset("webapp").dataSources;
  const ControllersSource = webapp.controllers;
  const ControllerEntry = ControllersSource.Entry;

  class LaravelControllerEntry extends ControllerEntry {
    diDeps = null;
    middleware = null;
  }

  /**
   * Parse Laravel controller content string and return raw parse result.
   */
  function parseControllerContent(content) {
    const classMatch = content.match(/class\s+(\w+)\s+extends\s+(\w+)/);
    const className = classMatch ? classMatch[1] : null;
    const parentClass = classMatch ? classMatch[2] : "";

    // Public methods (actions)
    const methodRegex = /public\s+function\s+(\w+)\s*\(/g;
    const actions = [];
    let m;
    while ((m = methodRegex.exec(content)) !== null) {
      if (m[1] !== "__construct" && !m[1].startsWith("_")) {
        actions.push(m[1]);
      }
    }

    // Constructor DI
    const diDeps = [];
    const ctorMatch = content.match(
      /public\s+function\s+__construct\s*\(([^)]*)\)/s,
    );
    if (ctorMatch) {
      const depRegex = /(\w+)\s+\$\w+/g;
      let dm;
      while ((dm = depRegex.exec(ctorMatch[1])) !== null) {
        if (!SKIP_DI_TYPES.has(dm[1])) diDeps.push(dm[1]);
      }
    }

    // middleware() calls
    const middleware = [];
    const mwRegex = /\$this->middleware\(\s*['"]([^'"]+)['"]/g;
    while ((m = mwRegex.exec(content)) !== null) {
      middleware.push(m[1]);
    }

    return { className, parentClass, actions, diDeps, middleware };
  }

  class LaravelControllersSource extends ControllersSource {
    static Entry = LaravelControllerEntry;

    match(relPath) {
      return (
        hasPathPrefix(relPath, "app/Http/Controllers/") &&
        relPath.endsWith(".php") &&
        !relPath.endsWith("/Controller.php")
      );
    }

    parse(absPath) {
      const entry = new LaravelControllerEntry();
      const content = fs.readFileSync(absPath, "utf8");
      const parsed = parseControllerContent(content);

      entry.className = parsed.className;
      entry.parentClass = parsed.parentClass;
      entry.actions = parsed.actions;
      entry.diDeps = parsed.diDeps;
      entry.middleware = parsed.middleware;
      entry.components = [];
      entry.uses = parsed.diDeps;

      return entry;
    }

    /** Controller list table. */
    list(analysis, labels) {
      const ctrls = this.mergeDesc(
        analysis.controllers?.entries || [],
        "controllers",
      );
      if (ctrls.length === 0) return null;
      const rows = this.toRows(ctrls, (c) => [
        c.className,
        c.file,
        c.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Controller actions table. */
    actions(analysis, labels) {
      const ctrls = analysis.controllers?.entries || [];
      if (ctrls.length === 0) return null;
      const rows = [];
      for (const c of ctrls) {
        for (const action of c.actions || []) {
          rows.push([c.className, action]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Middleware usage across controllers. */
    middleware(analysis, labels) {
      const ctrls = analysis.controllers?.entries || [];
      if (ctrls.length === 0) return null;
      const mwMap = new Map();
      for (const c of ctrls) {
        for (const mw of c.middleware || []) {
          if (!mwMap.has(mw)) mwMap.set(mw, []);
          mwMap.get(mw).push(c.className);
        }
      }
      if (mwMap.size === 0) return null;
      const rows = [...mwMap.entries()].map(([mw, controllers]) => [
        mw,
        controllers.join(", "),
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return LaravelControllersSource;
}

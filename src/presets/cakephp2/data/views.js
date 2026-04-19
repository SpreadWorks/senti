/**
 * ViewsSource — CakePHP 2.x views DataSource.
 */

import fs from "fs";

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const stripBlockComments = container.get("phpParser.stripBlockComments");
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const WebappDataSource = container.getPreset("webapp").dataSources["webapp-data-source"];

  class ViewEntry extends AnalysisEntry {
    /** "helper" | "layout" | "element" */
    viewType = null;
    className = null;
    extends = null;
    methods = null;
    dependsOn = null;

    static summary = {};
  }

  class CakephpViewsSource extends WebappDataSource {
    static Entry = ViewEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "app/View/");
    }

    parse(absPath) {
      const entry = new ViewEntry();

      if (/\/View\/Helper\/[^/]+\.php$/.test(absPath)) {
        entry.viewType = "helper";
        const raw = fs.readFileSync(absPath, "utf8");
        const src = stripBlockComments(raw);

        const classMatch = src.match(/class\s+(\w+)\s+extends\s+(\w+)/);
        if (classMatch) {
          entry.className = classMatch[1];
          entry.extends = classMatch[2];
        }

        const methods = [];
        const fnRe = /(?:public\s+)?function\s+(\w+)\s*\(/g;
        let fm;
        while ((fm = fnRe.exec(src)) !== null) {
          if (!fm[1].startsWith("__")) methods.push(fm[1]);
        }
        entry.methods = methods;

        const depHelpers = [];
        const depMatch = src.match(/\$helpers\s*=\s*array\s*\(([^)]+)\)/);
        if (depMatch) {
          const depRe = /['"](\w+)['"]/g;
          let dm;
          while ((dm = depRe.exec(depMatch[1])) !== null) {
            depHelpers.push(dm[1]);
          }
        }
        entry.dependsOn = depHelpers;
      } else if (/\/View\/Layouts\//.test(absPath) && absPath.endsWith(".ctp")) {
        entry.viewType = "layout";
      } else if (/\/View\/Elements\//.test(absPath) && absPath.endsWith(".ctp")) {
        entry.viewType = "element";
      }

      return entry;
    }

    helpers(analysis, labels) {
      const entries = (analysis.views?.entries || []).filter((e) => e.viewType === "helper");
      if (entries.length === 0) return null;
      const items = this.mergeDesc(entries, "helpers");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (h) => [h.className, h.extends, h.summary || "—"]);
      return this.toMarkdownTable(rows, labels);
    }

    layouts(analysis, labels) {
      const entries = (analysis.views?.entries || []).filter((e) => e.viewType === "layout");
      if (entries.length === 0) return null;
      const rows = this.toRows(entries, (e) => [e.file, this.desc("layouts", e.file)]);
      return this.toMarkdownTable(rows, labels);
    }

    elements(analysis, labels) {
      const entries = (analysis.views?.entries || []).filter((e) => e.viewType === "element");
      if (entries.length === 0) return null;
      const rows = this.toRows(entries, (e) => [e.file, this.desc("elements", e.file)]);
      return this.toMarkdownTable(rows, labels);
    }

    components(analysis, labels) {
      const configEntries = analysis.config?.entries;
      if (!configEntries) return null;
      const permComps = configEntries.filter((e) => e.permissionComponent);
      if (permComps.length === 0) return null;
      const pc = permComps[0].permissionComponent;
      const methods = pc.methods || [];
      if (methods.length === 0) return null;
      const rows = [["PermissionComponent", methods.join(", ")]];
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpViewsSource;
}

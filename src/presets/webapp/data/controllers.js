/**
 * ControllersSource — webapp common controllers scan + resolve.
 *
 * Child presets (cakephp2, laravel, symfony) extend this class
 * to add FW-specific scan logic and resolve methods.
 */

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const parseFile = container.get("scanner.parseFile");

  class WebappDataSource extends Scannable(DataSource) {}

  class ControllerEntry extends AnalysisEntry {
    className = null;
    parentClass = null;
    components = null;
    uses = null;
    actions = null;

    static summary = {
      totalActions: { field: "actions", aggregate: "count" },
    };
  }

  class ControllersSource extends WebappDataSource {
    static Entry = ControllerEntry;

    match(relPath) {
      return false;
    }

    parse(absPath) {
      const entry = new ControllerEntry();
      const parsed = parseFile(absPath);
      entry.className = parsed.className;
      entry.parentClass = parsed.parentClass;
      entry.components = parsed.properties.components || [];
      entry.uses = parsed.properties.uses || [];
      entry.actions = parsed.methods.filter((m) => !m.startsWith("_"));
      return entry;
    }

    /** Controller list table. */
    list(analysis, labels) {
      const items = this.mergeDesc(analysis.controllers?.entries || [], "controllers");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (c) => [
        c.className,
        c.file,
        c.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Controller → Model dependency table. */
    deps(analysis, labels) {
      const items = (analysis.controllers?.entries || []).filter((c) => c.uses?.length > 0);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (c) => [
        c.className,
        c.uses.join(", "),
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return ControllersSource;
}

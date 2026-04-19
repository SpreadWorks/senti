/**
 * CommandsSource — webapp common commands scan + resolve.
 *
 * Child presets extend this class to add FW-specific scan logic
 * and resolve methods.
 */

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const parseFile = container.get("scanner.parseFile");

  class WebappDataSource extends Scannable(DataSource) {}

  class CommandEntry extends AnalysisEntry {
    className = null;
    publicMethods = null;
    appUses = null;

    static summary = {};
  }

  class CommandsSource extends WebappDataSource {
    static Entry = CommandEntry;

    match(relPath) {
      return false;
    }

    parse(absPath) {
      const entry = new CommandEntry();
      const parsed = parseFile(absPath);
      entry.className = parsed.className;
      entry.publicMethods = parsed.methods.filter((m) => !m.startsWith("_"));
      entry.appUses = [];
      return entry;
    }

    /** Command list. */
    list(analysis, labels) {
      const items = this.mergeDesc(analysis.commands?.entries || [], "commands");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (s) => [
        s.className,
        s.file,
        s.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CommandsSource;
}

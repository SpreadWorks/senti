/**
 * CommandsSource — enrich-based DataSource for CLI commands.
 *
 * Reads enriched analysis items with role=cli to generate command tables.
 */

export default function register(container) {
  const DataSource = container.get("base.DataSource");

  function cliItems(analysis) {
    const items = analysis.modules?.entries || [];
    return items.filter((m) => m.role === "cli" || m.chapter === "cli_commands" || m.chapter === "commands");
  }

  class CommandsSource extends DataSource {
    /** Command list table. */
    list(analysis, labels) {
      const items = this.mergeDesc(cliItems(analysis), "commands", "className");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (m) => [
        m.className,
        m.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Command", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Global options table. */
    globalOptions(analysis, labels) {
      const opts = analysis.modules?.globalOptions;
      if (!Array.isArray(opts) || opts.length === 0) return null;
      const rows = this.toRows(opts, (o) => [
        o.name,
        o.type || "string",
        o.default ?? "—",
        o.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Option", "Type", "Default", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Exit codes table. */
    exitCodes(analysis, labels) {
      const codes = analysis.modules?.exitCodes;
      if (!Array.isArray(codes) || codes.length === 0) return null;
      const rows = this.toRows(codes, (c) => [
        String(c.code),
        c.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Code", "Meaning"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return CommandsSource;
}

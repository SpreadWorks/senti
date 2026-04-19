/**
 * DatabaseSource — PostgreSQL DataSource.
 *
 * Provides database-related data for PostgreSQL projects.
 *
 * Available methods:
 *   database.info("Item|Value")
 */

export default function register(container) {
  const DataSource = container.get("base.DataSource");

  class DatabaseSource extends DataSource {
    /** Basic PostgreSQL info table. */
    info(analysis, labels) {
      const rows = [["Database", "PostgreSQL"]];
      const hdr = labels.length >= 2 ? labels : ["Item", "Value"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return DatabaseSource;
}

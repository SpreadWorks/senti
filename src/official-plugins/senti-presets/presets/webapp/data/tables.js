/**
 * TablesSource — webapp common tables scan + resolve.
 *
 * Base implementation derives table information from model analysis.
 * Child presets override for FW-specific table analysis (migrations, etc.).
 */

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");

  class WebappDataSource extends Scannable(DataSource) {}

  class TablesSource extends WebappDataSource {
    /** Table list (derived from model analysis). */
    list(analysis, labels) {
      const models = this.mergeDesc(analysis.models?.entries || [], "tables", "tableName");
      if (models.length === 0) return null;
      const seen = new Set();
      const rows = [];
      for (const m of models) {
        if (!m.tableName || seen.has(m.tableName)) continue;
        seen.add(m.tableName);
        rows.push([m.tableName, m.summary || "\u2014"]);
      }
      rows.sort((a, b) => a[0].localeCompare(b[0]));
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Foreign key relationships (derived from model relations). */
    fk(analysis, labels) {
      const models = analysis.models?.entries || [];
      if (models.length === 0) return null;
      const classToTable = Object.fromEntries(models.map((m) => [m.className, m.tableName]));
      const rows = [];
      const seen = new Set();

      for (const model of models) {
        if (!model.relations) continue;
        for (const parent of model.relations.belongsTo || []) {
          const parentTable = classToTable[parent];
          if (!parentTable) continue;
          const key = `${parentTable}->${model.tableName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push([parentTable, model.tableName, "belongsTo"]);
        }
      }

      rows.sort((a, b) => `${a[0]}${a[1]}`.localeCompare(`${b[0]}${b[1]}`));
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }
  }

  return TablesSource;
}

/**
 * ModelsSource — webapp common models scan + resolve.
 *
 * Child presets extend this class to add FW-specific scan logic
 * and resolve methods.
 */

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const parseFile = container.get("scanner.parseFile");
  const camelToSnake = container.get("scanner.camelToSnake");
  const pluralize = container.get("scanner.pluralize");

  class WebappDataSource extends Scannable(DataSource) {}

  class ModelEntry extends AnalysisEntry {
    className = null;
    parentClass = null;
    isLogic = null;
    isFe = null;
    useTable = null;
    useDbConfig = null;
    primaryKey = null;
    displayField = null;
    tableName = null;
    relations = null;
    validateFields = null;
    actsAs = null;

    static summary = {};
  }

  class ModelsSource extends WebappDataSource {
    static Entry = ModelEntry;

    match(relPath) {
      return false;
    }

    parse(absPath) {
      const entry = new ModelEntry();
      const parsed = parseFile(absPath);
      entry.className = parsed.className;
      entry.parentClass = parsed.parentClass;
      entry.isLogic = absPath.includes("Logic");
      entry.isFe = parsed.className.startsWith("Fe");
      entry.useTable = parsed.properties.useTable || null;
      entry.useDbConfig = parsed.properties.useDbConfig || null;
      entry.primaryKey = parsed.properties.primaryKey || null;
      entry.displayField = parsed.properties.displayField || null;
      entry.tableName = entry.useTable || pluralize(camelToSnake(parsed.className));
      entry.relations = parsed.relations;
      entry.validateFields = parsed.properties.validate
        ? (Array.isArray(parsed.properties.validate) ? parsed.properties.validate : [])
        : [];
      entry.actsAs = parsed.properties.actsAs || [];
      return entry;
    }

    /** Model association summary. */
    relations(analysis, labels) {
      const models = analysis.models?.entries || [];
      if (models.length === 0) return null;
      const rows = [];
      for (const model of models) {
        if (!model.relations) continue;
        const targets = [];
        for (const [type, list] of Object.entries(model.relations)) {
          if (Array.isArray(list) && list.length > 0) {
            targets.push(`${type}: ${list.join(", ")}`);
          }
        }
        if (targets.length > 0) {
          rows.push([model.className, targets.join(" / ")]);
        }
      }
      rows.sort((a, b) => a[0].localeCompare(b[0]));
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }
  }

  return ModelsSource;
}

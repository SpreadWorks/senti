/**
 * TablesSource — CakePHP 2.x tables DataSource.
 *
 * Extends webapp TablesSource with CakePHP-specific DB name resolution,
 * FK column naming, and contents/staging sync mapping.
 */

const DB_CONFIG_MAP = {
  default: "cms",
  crankin_db: "crankin",
  contents_db: "contents",
  contents_staging_db: "contents_staging",
  hollywood_db: "hollywood_db",
};

function resolveDbName(useDbConfig) {
  if (!useDbConfig) return "cms";
  return DB_CONFIG_MAP[useDbConfig] || useDbConfig;
}

export default function register(container) {
  const TablesSource = container.getPreset("webapp").dataSources.tables;
  const camelToSnake = container.get("scanner.camelToSnake");

  class CakephpTablesSource extends TablesSource {
    list(analysis, labels) {
      const models = this.mergeDesc(
        (analysis.models?.entries || []).filter((m) => !m.isLogic && !m.isFe),
        "tables", "tableName",
      );
      const seen = new Set();
      const rows = [];
      for (const m of models) {
        if (seen.has(m.tableName)) continue;
        seen.add(m.tableName);
        rows.push([m.tableName, resolveDbName(m.useDbConfig), m.summary || "—"]);
      }
      rows.sort((a, b) => a[0].localeCompare(b[0]));
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    fk(analysis, labels) {
      const models = (analysis.models?.entries || []).filter((m) => !m.isLogic && !m.isFe);
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
          const fkCol = camelToSnake(parent) + "_id";
          rows.push([parentTable, model.tableName, fkCol, "belongsTo"]);
        }

        for (const child of model.relations.hasMany || []) {
          const childTable = classToTable[child];
          if (!childTable) continue;
          const key = `${model.tableName}->${childTable}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const fkCol = camelToSnake(model.className) + "_id";
          rows.push([model.tableName, childTable, fkCol, "hasMany"]);
        }

        for (const target of model.relations.hasOne || []) {
          const targetTable = classToTable[target];
          if (!targetTable) continue;
          const key = `${model.tableName}<->${targetTable}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push([model.tableName, targetTable, "—", "hasOne"]);
        }
      }

      rows.sort((a, b) => `${a[0]}${a[1]}`.localeCompare(`${b[0]}${b[1]}`));
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    sync(analysis, labels) {
      const feModels = (analysis.models?.entries || []).filter((m) => m.isFe);
      if (feModels.length === 0) return null;

      const contentsModels = feModels.filter((m) => m.useDbConfig === "contents_db" && m.useTable);
      const stagingModels = feModels.filter((m) => m.useDbConfig === "contents_staging_db" && m.useTable);

      const tableMap = new Map();
      for (const m of contentsModels) {
        if (!tableMap.has(m.useTable)) tableMap.set(m.useTable, {});
        tableMap.get(m.useTable).contents = m.className;
      }
      for (const m of stagingModels) {
        if (!tableMap.has(m.useTable)) tableMap.set(m.useTable, {});
        tableMap.get(m.useTable).staging = m.className;
      }

      const keys = [...tableMap.keys()].sort();
      if (keys.length === 0) return null;

      const rows = keys.map((table) => {
        const entry = tableMap.get(table);
        return [table, entry.contents || "—", entry.staging || "—"];
      });
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpTablesSource;
}

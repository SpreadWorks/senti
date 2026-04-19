/**
 * TablesSource — Laravel tables (migrations) DataSource.
 *
 * Extends the webapp parent TablesSource with Laravel-specific
 * parse logic and resolve methods.
 *
 * Each migration file is parsed into a MigrationEntry containing the
 * table operations (create/alter) found in that file. The resolve methods
 * accumulate these operations into a unified table view.
 *
 * Available methods (called via {{data}} directives):
 *   tables.list("Name|Columns|Description")
 *   tables.columns("Table|Column|Type|Nullable")
 *   tables.fk("Table|Column|References")
 *   tables.indexes("Table|Type|Columns")
 */

import fs from "fs";

const COLUMN_TYPES = new Set([
  "bigIncrements", "increments", "id",
  "string", "char", "text", "mediumText", "longText",
  "integer", "tinyInteger", "smallInteger", "mediumInteger", "bigInteger",
  "unsignedBigInteger", "unsignedInteger", "unsignedTinyInteger",
  "unsignedSmallInteger", "unsignedMediumInteger",
  "float", "double", "decimal", "unsignedDecimal",
  "boolean",
  "date", "dateTime", "dateTimeTz", "time", "timeTz",
  "timestamp", "timestampTz",
  "year",
  "binary",
  "enum", "set",
  "json", "jsonb",
  "uuid", "ulid",
  "ipAddress", "macAddress",
  "foreignId", "foreignUuid",
  "morphs", "nullableMorphs", "uuidMorphs", "nullableUuidMorphs",
  "rememberToken", "softDeletes", "softDeletesTz",
]);

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const webapp = container.getPreset("webapp").dataSources;
  const TablesSource = webapp.tables;

  class MigrationEntry extends AnalysisEntry {
    /** Table operations extracted from this migration file. */
    tables = null;

    static summary = {};
  }

  function parseBlueprint(body, entry) {
    // Column definitions: $table->type('name')
    const colRegex =
      /\$table->(\w+)\(\s*['"](\w+)['"](?:\s*,\s*([^)]*))?\)/g;

    let m;
    while ((m = colRegex.exec(body)) !== null) {
      const type = m[1];
      const name = m[2];
      if (COLUMN_TYPES.has(type)) {
        const lineEnd = body.indexOf(";", m.index);
        const line = body.slice(m.index, lineEnd > -1 ? lineEnd : undefined);
        const nullable = /->nullable\b/.test(line);
        const hasDefault = line.match(/->default\(\s*(.+?)\s*\)/);

        entry.columns.push({
          name,
          type,
          nullable,
          default: hasDefault ? hasDefault[1] : null,
        });
      }
    }

    // No-arg column methods: $table->id(), $table->timestamps(), etc.
    const noArgRegex =
      /\$table->(id|timestamps|timestampsTz|softDeletes|softDeletesTz|rememberToken)\s*\(\s*\)/g;
    while ((m = noArgRegex.exec(body)) !== null) {
      const type = m[1];
      if (type === "id") {
        entry.columns.push({ name: "id", type: "bigIncrements", nullable: false, default: null });
      } else if (type === "timestamps" || type === "timestampsTz") {
        entry.columns.push({ name: "created_at", type: "timestamp", nullable: true, default: null });
        entry.columns.push({ name: "updated_at", type: "timestamp", nullable: true, default: null });
      } else if (type === "softDeletes" || type === "softDeletesTz") {
        entry.columns.push({ name: "deleted_at", type: "timestamp", nullable: true, default: null });
      } else if (type === "rememberToken") {
        entry.columns.push({ name: "remember_token", type: "string", nullable: true, default: null });
      }
    }

    // Indexes: $table->index('col') / $table->unique('col') / $table->primary('col')
    const indexRegex =
      /\$table->(index|unique|primary)\(\s*(?:\[([^\]]*)\]|['"](\w+)['"])/g;
    while ((m = indexRegex.exec(body)) !== null) {
      const indexType = m[1];
      const cols = m[2]
        ? m[2].match(/['"](\w+)['"]/g)?.map((c) => c.replace(/['"]/g, "")) || []
        : [m[3]];
      entry.indexes.push({ type: indexType, columns: cols });
    }

    // Foreign keys: $table->foreign('col')->references('id')->on('table')
    const fkRegex =
      /\$table->foreign\(\s*['"](\w+)['"]\s*\)->references\(\s*['"](\w+)['"]\s*\)->on\(\s*['"](\w+)['"]\s*\)/g;
    while ((m = fkRegex.exec(body)) !== null) {
      entry.foreignKeys.push({ column: m[1], references: m[2], on: m[3] });
    }

    // foreignId implicit FK: $table->foreignId('user_id')->constrained()
    const foreignIdRegex =
      /\$table->foreignId\(\s*['"](\w+)['"]\s*\)[^;]*->constrained\(\s*(?:['"](\w+)['"])?\s*\)/g;
    while ((m = foreignIdRegex.exec(body)) !== null) {
      const col = m[1];
      const table = m[2] || col.replace(/_id$/, "") + "s";
      entry.foreignKeys.push({ column: col, references: "id", on: table });
    }
  }

  /**
   * Merge table operations from multiple MigrationEntry instances
   * into a unified table list (same table name across files gets merged).
   */
  function mergeTablesFromEntries(entries) {
    const tableMap = new Map();
    for (const entry of entries) {
      for (const tbl of entry.tables || []) {
        if (!tableMap.has(tbl.name)) {
          tableMap.set(tbl.name, {
            name: tbl.name,
            columns: [],
            indexes: [],
            foreignKeys: [],
          });
        }
        const merged = tableMap.get(tbl.name);
        merged.columns.push(...tbl.columns);
        merged.indexes.push(...tbl.indexes);
        merged.foreignKeys.push(...tbl.foreignKeys);
      }
    }
    return [...tableMap.values()];
  }

  class LaravelTablesSource extends TablesSource {
    static Entry = MigrationEntry;

    match(relPath) {
      return (
        hasPathPrefix(relPath, "database/migrations/") &&
        relPath.endsWith(".php")
      );
    }

    parse(absPath) {
      const entry = new MigrationEntry();
      const content = fs.readFileSync(absPath, "utf8");

      const tables = [];

      // Schema::create('table_name', function (Blueprint $table) { ... })
      const createRegex =
        /Schema::create\s*\(\s*['"](\w+)['"]\s*,\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\}\s*\)/g;
      let m;
      while ((m = createRegex.exec(content)) !== null) {
        const tbl = {
          name: m[1],
          columns: [],
          indexes: [],
          foreignKeys: [],
          operation: "create",
        };
        parseBlueprint(m[2], tbl);
        tables.push(tbl);
      }

      // Schema::table('table_name', function ...) — alter
      const tableRegex =
        /Schema::table\s*\(\s*['"](\w+)['"]\s*,\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\}\s*\)/g;
      while ((m = tableRegex.exec(content)) !== null) {
        const tbl = {
          name: m[1],
          columns: [],
          indexes: [],
          foreignKeys: [],
          operation: "alter",
        };
        parseBlueprint(m[2], tbl);
        tables.push(tbl);
      }

      entry.tables = tables;
      return entry;
    }

    /** Table list table. */
    list(analysis, labels) {
      const merged = mergeTablesFromEntries(analysis.tables?.entries || []);
      const tables = this.mergeDesc(merged, "tables", "name");
      if (tables.length === 0) return null;
      const rows = this.toRows(tables, (t) => [
        t.name,
        t.columns.length,
        t.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Table columns detail table. */
    columns(analysis, labels) {
      const tables = mergeTablesFromEntries(analysis.tables?.entries || []);
      if (tables.length === 0) return null;
      const rows = [];
      for (const t of tables) {
        for (const col of t.columns) {
          rows.push([t.name, col.name, col.type, col.nullable ? "YES" : "NO"]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Foreign key relationships table. */
    fk(analysis, labels) {
      const tables = mergeTablesFromEntries(analysis.tables?.entries || []);
      if (tables.length === 0) return null;
      const rows = [];
      for (const t of tables) {
        for (const fk of t.foreignKeys) {
          rows.push([t.name, fk.column, `${fk.on}.${fk.references}`]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Indexes table. */
    indexes(analysis, labels) {
      const tables = mergeTablesFromEntries(analysis.tables?.entries || []);
      if (tables.length === 0) return null;
      const rows = [];
      for (const t of tables) {
        for (const idx of t.indexes) {
          rows.push([t.name, idx.type, idx.columns.join(", ")]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }
  }

  return LaravelTablesSource;
}

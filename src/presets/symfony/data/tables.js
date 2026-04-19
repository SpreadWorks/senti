/**
 * TablesSource — Symfony migrations DataSource.
 *
 * Extends the webapp parent TablesSource with Symfony-specific
 * parse logic and resolve methods.
 *
 * Available methods (called via {{data}} directives):
 *   tables.list("Name|Columns|Description")
 *   tables.columns("Table|Column|Type|Nullable")
 *   tables.fk("Table|Column|References")
 */

import fs from "fs";

function parseCreateTableSql(body, entry) {
  const parts = body.split(",");
  for (const part of parts) {
    const trimmed = part.trim();

    if (/^(?:PRIMARY KEY|CONSTRAINT|INDEX|UNIQUE|FOREIGN KEY)/i.test(trimmed)) {
      const fkMatch = trimmed.match(/FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)/i);
      if (fkMatch) {
        entry.foreignKeys.push({ column: fkMatch[1], references: fkMatch[3], on: fkMatch[2] });
      }
      continue;
    }

    const colMatch = trimmed.match(/^(\w+)\s+(\w+(?:\(\d+(?:,\s*\d+)?\))?)/);
    if (colMatch) {
      const name = colMatch[1];
      const type = colMatch[2].replace(/\(.*\)/, "");
      const nullable = !/NOT NULL/i.test(trimmed);
      const defaultMatch = trimmed.match(/DEFAULT\s+(\S+)/i);
      entry.columns.push({
        name,
        type: type.toUpperCase(),
        nullable,
        default: defaultMatch ? defaultMatch[1] : null,
      });
    }
  }
}

function parseAlterTable(alterBody, entry) {
  const addColMatch = alterBody.match(/ADD\s+(\w+)\s+(\w+(?:\(\d+\))?)/i);
  if (addColMatch) {
    const type = addColMatch[2].replace(/\(.*\)/, "");
    entry.columns.push({
      name: addColMatch[1],
      type: type.toUpperCase(),
      nullable: !/NOT NULL/i.test(alterBody),
      default: null,
    });
  }

  const fkMatch = alterBody.match(/FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)/i);
  if (fkMatch) {
    entry.foreignKeys.push({ column: fkMatch[1], references: fkMatch[3], on: fkMatch[2] });
  }
}

function parseMigration(content, tableMap) {
  // Doctrine Migration SQL: $this->addSql('CREATE TABLE xxx (...)');
  const createTableRegex = /\$this->addSql\s*\(\s*['"]CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;
  let m;
  while ((m = createTableRegex.exec(content)) !== null) {
    const tableName = m[1];
    const body = m[2];
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { name: tableName, columns: [], foreignKeys: [] });
    }
    const entry = tableMap.get(tableName);
    parseCreateTableSql(body, entry);
  }

  // ALTER TABLE
  const alterRegex = /\$this->addSql\s*\(\s*['"]ALTER TABLE\s+(\w+)\s+(.*?)['"]\s*\)/gi;
  while ((m = alterRegex.exec(content)) !== null) {
    const tableName = m[1];
    const alterBody = m[2];
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { name: tableName, columns: [], foreignKeys: [] });
    }
    parseAlterTable(alterBody, tableMap.get(tableName));
  }

  // Doctrine DBAL Schema API: $schema->createTable('xxx');
  const dbalCreateRegex = /\$schema->createTable\s*\(\s*['"](\w+)['"]\s*\)/g;
  while ((m = dbalCreateRegex.exec(content)) !== null) {
    const tableName = m[1];
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { name: tableName, columns: [], foreignKeys: [] });
    }
  }

  // $table->addColumn('name', 'string', ['length' => 255])
  const addColRegex = /->addColumn\s*\(\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*(?:,\s*\[([^\]]*)\])?\)/g;
  while ((m = addColRegex.exec(content)) !== null) {
    const lastTable = [...tableMap.values()].pop();
    if (lastTable) {
      const opts = m[3] || "";
      const nullable = /['"]notnull['"]\s*=>\s*false/.test(opts);
      const lengthMatch = opts.match(/['"]length['"]\s*=>\s*(\d+)/);
      lastTable.columns.push({
        name: m[1],
        type: m[2],
        nullable,
        length: lengthMatch ? parseInt(lengthMatch[1]) : null,
      });
    }
  }
}

/** Collect and merge tables from all migration entries. */
function collectTables(analysis) {
  const entries = analysis.tables?.entries || [];
  if (entries.length === 0) return [];
  const tableMap = new Map();
  for (const entry of entries) {
    for (const t of entry.tables || []) {
      if (!tableMap.has(t.name)) {
        tableMap.set(t.name, { ...t });
      } else {
        // Merge columns and foreign keys from later migrations
        const existing = tableMap.get(t.name);
        existing.columns.push(...t.columns);
        existing.foreignKeys.push(...t.foreignKeys);
      }
    }
  }
  return [...tableMap.values()];
}

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const webapp = container.getPreset("webapp").dataSources;
  const TablesSource = webapp.tables;

  class MigrationEntry extends AnalysisEntry {
    tables = null;

    static summary = {};
  }

  class SymfonyTablesSource extends TablesSource {
    static Entry = MigrationEntry;

    match(relPath) {
      return relPath.endsWith(".php") && hasPathPrefix(relPath, "migrations/");
    }

    parse(absPath) {
      const entry = new MigrationEntry();
      const content = fs.readFileSync(absPath, "utf8");

      const tableMap = new Map();

      parseMigration(content, tableMap);

      entry.tables = [...tableMap.values()];
      return entry;
    }

    /** Table list table. */
    list(analysis, labels) {
      const allTables = collectTables(analysis);
      const items = this.mergeDesc(allTables, "tables", "name");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (t) => [
        t.name,
        t.columns.length,
        t.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Table columns table. */
    columns(analysis, labels) {
      const allTables = collectTables(analysis);
      if (allTables.length === 0) return null;
      const rows = [];
      for (const t of allTables) {
        for (const col of t.columns) {
          rows.push([t.name, col.name, col.type, col.nullable ? "YES" : "NO"]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Foreign keys table. */
    fk(analysis, labels) {
      const allTables = collectTables(analysis);
      if (allTables.length === 0) return null;
      const rows = [];
      for (const t of allTables) {
        for (const fk of t.foreignKeys) {
          rows.push([t.name, fk.column, `${fk.on}.${fk.references}`]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }
  }

  return SymfonyTablesSource;
}

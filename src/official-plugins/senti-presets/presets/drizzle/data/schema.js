/**
 * DrizzleSchemaSource — Scannable DataSource for Drizzle ORM schema.
 *
 * Scans Drizzle schema TypeScript files and drizzle.config.* to extract
 * table definitions, columns, and relations via regex.
 *
 * Available methods:
 *   schema.tables("Table|Columns|Description")
 *   schema.relations("From|To|Type|Foreign Key")
 *   schema.files("File|Tables|Description")
 */

import fs from "fs";

/** Match: export const users = pgTable("users", { ... }) */
const TABLE_RE = /export\s+const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\s*\(\s*["'](\w+)["']/g;

/** Match column definitions: id: serial("id").primaryKey() */
const COLUMN_RE = /(\w+)\s*:\s*(\w+)\s*\(/g;

/** Match relations: export const usersRelations = relations(users, ...) */
const RELATION_RE = /export\s+const\s+(\w+)\s*=\s*relations\s*\(\s*(\w+)/g;

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");

  class DrizzleSchemaEntry extends AnalysisEntry {
    tables = null;
    relations = null;

    static summary = {};
  }

  class DrizzleSchemaSource extends Scannable(DataSource) {
    static Entry = DrizzleSchemaEntry;

    match(relPath) {
      return /(?:schema\.ts|schema\/.*\.ts|drizzle\.config\.\w+)$/.test(relPath);
    }

    parse(absPath) {
      const entry = new DrizzleSchemaEntry();
      const content = fs.readFileSync(absPath, "utf8");
      const tables = [];
      const relations = [];

      // Extract table definitions
      for (const m of content.matchAll(TABLE_RE)) {
        const varName = m[1];
        const tableName = m[2];

        // Extract columns from the table block
        const tableStart = m.index + m[0].length;
        const blockStart = content.indexOf("{", tableStart);
        if (blockStart === -1) {
          tables.push({ name: tableName, varName, columns: [] });
          continue;
        }

        let depth = 1;
        let pos = blockStart + 1;
        while (pos < content.length && depth > 0) {
          if (content[pos] === "{") depth++;
          else if (content[pos] === "}") depth--;
          pos++;
        }
        const block = content.slice(blockStart + 1, pos - 1);

        const columns = [];
        for (const cm of block.matchAll(COLUMN_RE)) {
          columns.push(cm[1]);
        }

        tables.push({ name: tableName, varName, columns });
      }

      // Extract relations
      for (const m of content.matchAll(RELATION_RE)) {
        const relName = m[1];
        const fromTable = m[2];
        relations.push({ from: fromTable, name: relName });
      }

      entry.tables = tables;
      entry.relations = relations;
      return entry;
    }

    /** Drizzle schema tables list. */
    tables(analysis, labels) {
      const entries = analysis.schema?.entries || [];
      const items = entries.flatMap((e) => e.tables || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (t) => [
        t.name || "—",
        Array.isArray(t.columns) ? t.columns.join(", ") : (t.columns || "—"),
        t.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Table", "Columns", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Drizzle relations list. */
    relations(analysis, labels) {
      const entries = analysis.schema?.entries || [];
      const items = entries.flatMap((e) => e.relations || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (r) => [
        r.from || "—",
        r.to || "—",
        r.type || "—",
        r.foreignKey || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["From", "To", "Type", "Foreign Key"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Schema definition files list. */
    files(analysis, labels) {
      const items = analysis.schema?.entries || [];
      if (items.length === 0) return null;
      const rows = this.toRows(items, (f) => [
        f.file || "—",
        (f.tables || []).map((t) => t.name).join(", ") || "—",
        f.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["File", "Tables", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return DrizzleSchemaSource;
}

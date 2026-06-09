/**
 * Directory-level analyzers for Drizzle preset tests.
 *
 * These helpers are used only by unit tests. They were previously
 * exported from data/*.js modules but have been relocated here so
 * that preset data/ files do not import senti internals
 * (spec 191: preset DI container).
 */

import fs from "fs";
import path from "path";

/** Match: export const users = pgTable("users", { ... }) */
const TABLE_RE = /export\s+const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\s*\(\s*["'](\w+)["']/g;

/** Match column definitions: id: serial("id").primaryKey() */
const COLUMN_RE = /(\w+)\s*:\s*(\w+)\s*\(/g;

/** Match relations: export const usersRelations = relations(users, ...) */
const RELATION_RE = /export\s+const\s+(\w+)\s*=\s*relations\s*\(\s*(\w+)/g;

/**
 * @param {string} sourceRoot - project root
 * @returns {{ tables: Object[], relations: Object[], files: Object[], summary: { totalTables: number, totalRelations: number } }}
 */
export function analyzeSchema(sourceRoot) {
  const schemaFiles = collectSchemaFiles(sourceRoot);

  const tables = [];
  const relations = [];
  const fileEntries = [];

  for (const { absPath, relPath } of schemaFiles) {
    const content = fs.readFileSync(absPath, "utf8");
    const fileTables = [];

    // Extract table definitions
    for (const m of content.matchAll(TABLE_RE)) {
      const varName = m[1];
      const tableName = m[2];
      fileTables.push(tableName);

      // Extract columns from the table block
      const tableStart = m.index + m[0].length;
      const blockStart = content.indexOf("{", tableStart);
      if (blockStart === -1) continue;

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

    fileEntries.push({ relPath, tables: fileTables.join(", ") || "\u2014" });
  }

  return {
    tables,
    relations,
    files: fileEntries,
    summary: { totalTables: tables.length, totalRelations: relations.length },
  };
}

/**
 * Collect schema-related files from the project.
 * Looks for: schema.ts, schema/*.ts, drizzle.config.*
 */
function collectSchemaFiles(sourceRoot) {
  const results = [];

  walkDir(sourceRoot, "", (absPath, relPath) => {
    if (/(?:schema\.ts|schema\/.*\.ts|drizzle\.config\.\w+)$/.test(relPath)) {
      results.push({ absPath, relPath });
    }
  });

  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function walkDir(baseDir, relPrefix, callback) {
  let entries;
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const nextRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      walkDir(path.join(baseDir, entry.name), nextRel, callback);
    } else if (entry.isFile()) {
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      callback(path.join(baseDir, entry.name), relPath);
    }
  }
}

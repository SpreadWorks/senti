/**
 * EntitiesSource — Symfony Doctrine entities DataSource.
 *
 * Symfony-only category using Scannable(DataSource) directly.
 *
 * Available methods (called via {{data}} directives):
 *   entities.relations("Entity|Associations")
 *   entities.columns("Entity|Column|Type|Nullable|Key")
 */

import fs from "fs";
import path from "path";

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const camelToSnake = container.get("scanner.camelToSnake");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const webapp = container.getPreset("webapp").dataSources;
  const WebappDataSource = webapp["webapp-data-source"];

  class EntityEntry extends AnalysisEntry {
    className = null;
    tableName = null;
    repositoryClass = null;
    columns = null;
    relations = null;

    static summary = {};
  }

  function extractColumns(content) {
    const columns = [];
    const lines = content.split("\n");
    const attrBuffer = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Accumulate #[ORM\...] attribute lines
      if (/^\s*#\[ORM\\/.test(line)) {
        attrBuffer.push(trimmed);
        continue;
      }

      // Property declaration
      const propMatch = trimmed.match(/^(?:private|protected|public)\s+(\??\w+)\s+\$(\w+)/);
      if (propMatch) {
        const attrBlock = attrBuffer.join("\n");
        const phpType = propMatch[1];

        const hasColumn = /#\[ORM\\Column/.test(attrBlock);
        const hasId = /#\[ORM\\Id\b/.test(attrBlock);

        if (hasColumn || hasId) {
          const typeMatch = attrBlock.match(/#\[ORM\\Column\s*\([^)]*type:\s*['"](\w+)['"]/);
          const type = typeMatch ? typeMatch[1] : phpType.replace(/^\?/, "") || "string";

          const lengthMatch = attrBlock.match(/#\[ORM\\Column\s*\([^)]*length:\s*(\d+)/);
          const length = lengthMatch ? parseInt(lengthMatch[1]) : null;

          const nullable = /#\[ORM\\Column\s*\([^)]*nullable:\s*true/.test(attrBlock) || phpType.startsWith("?");

          columns.push({ name: propMatch[2], type, length, nullable, id: hasId });
        }

        attrBuffer.length = 0;
        continue;
      }

      // Non-attribute, non-property line — reset buffer
      if (trimmed && !trimmed.startsWith("#[")) {
        attrBuffer.length = 0;
      }
    }

    return columns;
  }

  function extractRelations(content) {
    const relations = {};
    const relTypes = ["OneToMany", "ManyToOne", "OneToOne", "ManyToMany"];

    for (const relType of relTypes) {
      const regex = new RegExp(
        `#\\[ORM\\\\${relType}\\s*\\(([^)]*?)\\)\\][\\s\\S]*?(?:private|protected|public)\\s+\\??\\w+\\s+\\$(\\w+)`,
        "g",
      );
      let m;
      while ((m = regex.exec(content)) !== null) {
        const attrContent = m[1];
        const propName = m[2];

        const targetMatch = attrContent.match(/targetEntity:\s*([\w\\]+?)(?:::class)?(?:[,\s)]|$)/);
        const target = targetMatch ? targetMatch[1].split("\\").pop() : "";

        if (!relations[relType]) relations[relType] = [];
        relations[relType].push({ property: propName, target });
      }
    }

    return relations;
  }

  function parseEntityContent(content) {
    if (!/#\[ORM\\Entity/.test(content) && !/#\[ORM\\Table/.test(content)) {
      return null;
    }

    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : null;

    const tableMatch = content.match(/#\[ORM\\Table\s*\(\s*name:\s*['"](\w+)['"]/);
    const tableName = tableMatch ? tableMatch[1] : camelToSnake(className);

    const repoMatch = content.match(/#\[ORM\\Entity\s*\(\s*repositoryClass:\s*([\w\\]+)(?:::class)?/);
    const repositoryClass = repoMatch ? repoMatch[1].split("\\").pop() : "";

    return {
      className,
      tableName,
      repositoryClass,
      columns: extractColumns(content),
      relations: extractRelations(content),
    };
  }

  class EntitiesSource extends WebappDataSource {
    static Entry = EntityEntry;

    match(relPath) {
      return relPath.endsWith(".php") && hasPathPrefix(relPath, "src/Entity/");
    }

    parse(absPath) {
      const entry = new EntityEntry();
      const content = fs.readFileSync(absPath, "utf8");
      const parsed = parseEntityContent(content);
      if (!parsed) return entry;

      entry.className = parsed.className ?? path.basename(absPath, ".php");
      entry.tableName = parsed.tableName;
      entry.repositoryClass = parsed.repositoryClass;
      entry.columns = parsed.columns;
      entry.relations = parsed.relations;

      return entry;
    }

    /** Entity relations table (grouped by relation type). */
    relations(analysis, labels) {
      const entities = analysis.entities?.entries || [];
      if (entities.length === 0) return null;
      const rows = [];
      for (const entity of entities) {
        if (!entity.relations) continue;
        const targets = [];
        for (const [type, list] of Object.entries(entity.relations)) {
          if (Array.isArray(list) && list.length > 0) {
            targets.push(`${type}: ${list.map((r) => r.target).join(", ")}`);
          }
        }
        if (targets.length > 0) {
          rows.push([entity.className, targets.join(" / ")]);
        }
      }
      if (rows.length === 0) return null;
      rows.sort((a, b) => a[0].localeCompare(b[0]));
      return this.toMarkdownTable(rows, labels);
    }

    /** Entity columns table. */
    columns(analysis, labels) {
      const entities = analysis.entities?.entries || [];
      if (entities.length === 0) return null;
      const rows = [];
      for (const entity of entities) {
        for (const col of entity.columns || []) {
          rows.push([
            entity.className,
            col.name,
            col.type,
            col.nullable ? "YES" : "NO",
            col.id ? "PK" : "",
          ]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }
  }

  return EntitiesSource;
}

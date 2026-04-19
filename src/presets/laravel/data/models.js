/**
 * ModelsSource — Laravel Eloquent models DataSource.
 *
 * Extends the webapp parent ModelsSource with Laravel-specific
 * parse logic and resolve methods.
 *
 * Available methods (called via {{data}} directives):
 *   models.relations("Model|Associations")
 *   models.scopes("Model|Scope")
 *   models.casts("Model|Attribute|Cast Type")
 */

import fs from "fs";

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const camelToSnake = container.get("scanner.camelToSnake");
  const pluralize = container.get("scanner.pluralize");
  const webapp = container.getPreset("webapp").dataSources;
  const ModelsSource = webapp.models;
  const ModelEntry = ModelsSource.Entry;

  class LaravelModelEntry extends ModelEntry {
    fillable = null;
    guarded = null;
    casts = null;
    hidden = null;
    scopes = null;
    accessors = null;
  }

  function extractArrayProp(content, propName) {
    const regex = new RegExp(
      `protected\\s+\\$${propName}\\s*=\\s*\\[([^\\]]*?)\\]`,
      "s",
    );
    const match = content.match(regex);
    if (!match) return [];
    const items = [];
    const itemRegex = /['"]([^'"]+)['"]/g;
    let m;
    while ((m = itemRegex.exec(match[1])) !== null) {
      items.push(m[1]);
    }
    return items;
  }

  function extractAssocProp(content, propName) {
    const regex = new RegExp(
      `protected\\s+\\$${propName}\\s*=\\s*\\[([^\\]]*?)\\]`,
      "s",
    );
    const match = content.match(regex);
    if (!match) return {};
    const result = {};
    const pairRegex = /['"]([^'"]+)['"]\s*=>\s*['"]?([^'",\]\s]+)['"]?/g;
    let m;
    while ((m = pairRegex.exec(match[1])) !== null) {
      result[m[1]] = m[2];
    }
    return result;
  }

  function extractRelations(content) {
    const relations = {};
    const relTypes = [
      "hasOne",
      "hasMany",
      "belongsTo",
      "belongsToMany",
      "morphTo",
      "morphMany",
      "morphOne",
      "morphToMany",
    ];

    for (const relType of relTypes) {
      const regex = new RegExp(
        `public\\s+function\\s+(\\w+)\\s*\\([^)]*\\)\\s*(?::\\s*\\w+)?\\s*\\{[^}]*\\$this->${relType}\\(\\s*([\\w\\\\:]+)`,
        "g",
      );
      let m;
      while ((m = regex.exec(content)) !== null) {
        if (!relations[relType]) relations[relType] = [];
        const target = m[2].replace(/::class$/, "").split("\\").pop();
        relations[relType].push({ method: m[1], model: target });
      }
    }

    return relations;
  }

  function parseModelContent(content) {
    // Only process Eloquent models
    if (!/extends\s+Model\b/.test(content) && !/use\s+HasFactory\b/.test(content)) {
      return null;
    }

    const classMatch = content.match(/class\s+(\w+)\s+extends\s+(\w+)/);
    const className = classMatch ? classMatch[1] : null;
    const parentClass = classMatch ? classMatch[2] : "";

    const tableMatch = content.match(
      /protected\s+\$table\s*=\s*['"]([^'"]+)['"]/,
    );
    const tableName = tableMatch
      ? tableMatch[1]
      : className
        ? pluralize(camelToSnake(className))
        : null;

    const fillable = extractArrayProp(content, "fillable");
    const guarded = extractArrayProp(content, "guarded");
    const casts = extractAssocProp(content, "casts");
    const hidden = extractArrayProp(content, "hidden");
    const relations = extractRelations(content);

    // Scopes
    const scopes = [];
    const scopeRegex = /public\s+function\s+scope(\w+)\s*\(/g;
    let m;
    while ((m = scopeRegex.exec(content)) !== null) {
      scopes.push(m[1]);
    }

    // Accessors (Laravel 9+ Attribute style + legacy getXxxAttribute)
    const accessors = [];
    const oldAccRegex = /public\s+function\s+get(\w+)Attribute\s*\(/g;
    while ((m = oldAccRegex.exec(content)) !== null) {
      accessors.push(m[1]);
    }
    const newAccRegex =
      /protected\s+function\s+(\w+)\s*\(\)\s*:\s*Attribute\b/g;
    while ((m = newAccRegex.exec(content)) !== null) {
      accessors.push(m[1]);
    }

    return { className, parentClass, tableName, fillable, guarded, casts, hidden, relations, scopes, accessors };
  }

  class LaravelModelsSource extends ModelsSource {
    static Entry = LaravelModelEntry;

    match(relPath) {
      return (
        hasPathPrefix(relPath, "app/Models/") &&
        relPath.endsWith(".php")
      );
    }

    parse(absPath) {
      const entry = new LaravelModelEntry();
      const content = fs.readFileSync(absPath, "utf8");
      const parsed = parseModelContent(content);
      if (!parsed) return entry;

      entry.className = parsed.className;
      entry.parentClass = parsed.parentClass;
      entry.tableName = parsed.tableName;
      entry.fillable = parsed.fillable;
      entry.guarded = parsed.guarded;
      entry.casts = parsed.casts;
      entry.hidden = parsed.hidden;
      entry.relations = parsed.relations;
      entry.scopes = parsed.scopes;
      entry.accessors = parsed.accessors;

      return entry;
    }

    /** Model relations table. */
    relations(analysis, labels) {
      const models = analysis.models?.entries || [];
      if (models.length === 0) return null;
      const rows = [];
      for (const model of models) {
        if (!model.relations) continue;
        const targets = [];
        for (const [type, list] of Object.entries(model.relations)) {
          if (Array.isArray(list) && list.length > 0) {
            targets.push(`${type}: ${list.map((r) => r.model).join(", ")}`);
          }
        }
        if (targets.length > 0) {
          rows.push([model.className, targets.join(" / ")]);
        }
      }
      if (rows.length === 0) return null;
      rows.sort((a, b) => a[0].localeCompare(b[0]));
      return this.toMarkdownTable(rows, labels);
    }

    /** Model scopes table. */
    scopes(analysis, labels) {
      const models = analysis.models?.entries || [];
      if (models.length === 0) return null;
      const rows = [];
      for (const model of models) {
        for (const scope of model.scopes || []) {
          rows.push([model.className, scope]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Model attribute casts table. */
    casts(analysis, labels) {
      const models = analysis.models?.entries || [];
      if (models.length === 0) return null;
      const rows = [];
      for (const model of models) {
        for (const [attr, type] of Object.entries(model.casts || {})) {
          rows.push([model.className, attr, type]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }
  }

  return LaravelModelsSource;
}

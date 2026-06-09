/**
 * ModelsSource — CakePHP 2.x models DataSource.
 *
 * Extends webapp ModelsSource with CakePHP-specific parse logic
 * and resolve methods (logic, er, logicMethods).
 */

import fs from "fs";

const RELATION_TYPES = [
  "belongsTo",
  "hasMany",
  "hasOne",
  "hasAndBelongsToMany",
];

export default function register(container) {
  const stripBlockComments = container.get("phpParser.stripBlockComments");
  const extractArrayBody = container.get("phpParser.extractArrayBody");
  const extractTopLevelKeys = container.get("phpParser.extractTopLevelKeys");
  const extractQuotedStrings = container.get("phpParser.extractQuotedStrings");
  const camelToSnake = container.get("scanner.camelToSnake");
  const pluralize = container.get("scanner.pluralize");
  const webapp = container.getPreset("webapp").dataSources;
  const ModelsSource = webapp.models;
  const ModelEntry = ModelsSource.Entry;

  function extractStringProperty(src, propertyName) {
    const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(?:var|public|protected|private)\\s+\\$${escaped}\\s*=\\s*['"]([^'"]+)['"]`,
    );
    const m = re.exec(src);
    return m ? m[1] : null;
  }

  function parseModelContent(src) {
    const classMatch = src.match(/class\s+(\w+)\s+extends\s+(\w+)/);
    if (!classMatch) return null;

    const className = classMatch[1];
    const parentClass = classMatch[2];

    const useTable = extractStringProperty(src, "useTable");
    const useDbConfig = extractStringProperty(src, "useDbConfig");
    const primaryKey = extractStringProperty(src, "primaryKey");
    const displayField = extractStringProperty(src, "displayField");

    const relations = {};
    for (const relType of RELATION_TYPES) {
      const body = extractArrayBody(src, relType);
      if (body) {
        relations[relType] = extractTopLevelKeys(body);
      }
    }

    const validateBody = extractArrayBody(src, "validate");
    const validateFields = validateBody
      ? extractTopLevelKeys(validateBody)
      : [];

    const actsAsBody = extractArrayBody(src, "actsAs");
    const actsAs = actsAsBody ? extractQuotedStrings(actsAsBody) : [];

    const tableName = useTable || pluralize(camelToSnake(className));

    return {
      className,
      parentClass,
      useTable: useTable || null,
      useDbConfig: useDbConfig || null,
      primaryKey: primaryKey || null,
      displayField: displayField || null,
      tableName,
      relations,
      validateFields,
      actsAs,
    };
  }

  class CakephpModelsSource extends ModelsSource {
    static Entry = ModelEntry;

    match(relPath) {
      return /\.php$/.test(relPath)
        && relPath.includes("Model/")
        && !/AppModel\.php$/.test(relPath);
    }

    parse(absPath) {
      const entry = new ModelEntry();
      const raw = fs.readFileSync(absPath, "utf8");
      const src = stripBlockComments(raw);
      const parsed = parseModelContent(src);
      if (!parsed) return entry;

      entry.className = parsed.className;
      entry.parentClass = parsed.parentClass;
      entry.useTable = parsed.useTable;
      entry.useDbConfig = parsed.useDbConfig;
      entry.primaryKey = parsed.primaryKey;
      entry.displayField = parsed.displayField;
      entry.tableName = parsed.tableName;
      entry.relations = parsed.relations;
      entry.validateFields = parsed.validateFields;
      entry.actsAs = parsed.actsAs;
      entry.isLogic = absPath.includes("/Logic/");
      entry.isFe = parsed.className.startsWith("Fe");

      return entry;
    }

    logic(analysis, labels) {
      const items = this.mergeDesc(
        (analysis.models?.entries || [])
          .filter((m) => m.isLogic)
          .sort((a, b) => a.className.localeCompare(b.className)),
        "logicClasses",
      );
      if (items.length === 0) return null;
      const rows = this.toRows(items, (m) => [
        m.className,
        m.file,
        m.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    relations(analysis, labels) {
      const models = (analysis.models?.entries || []).filter((m) => !m.isLogic && !m.isFe);
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

    er(analysis, labels) {
      const models = (analysis.models?.entries || []).filter((m) => !m.isLogic && !m.isFe);
      const rows = [];
      const seen = new Set();

      for (const model of models) {
        if (!model.relations) continue;

        for (const parent of model.relations.belongsTo || []) {
          const pm = models.find((m) => m.className === parent);
          if (!pm) continue;
          const key = `${pm.tableName}--${model.tableName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push([pm.tableName, model.tableName, "belongsTo"]);
        }

        for (const child of model.relations.hasMany || []) {
          const cm = models.find((m) => m.className === child);
          if (!cm) continue;
          const key = `${model.tableName}--${cm.tableName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push([model.tableName, cm.tableName, "hasMany"]);
        }

        for (const target of model.relations.hasOne || []) {
          const tm = models.find((m) => m.className === target);
          if (!tm) continue;
          const key = `${model.tableName}--${tm.tableName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push([model.tableName, tm.tableName, "hasOne"]);
        }
      }

      if (rows.length === 0) return null;
      const hdr = labels.length >= 3 ? labels : ["Parent", "Child", "Relation"];
      return this.toMarkdownTable(rows, hdr);
    }

    logicMethods(analysis, labels) {
      const configEntries = analysis.config?.entries;
      if (!configEntries) return null;
      const items = configEntries.flatMap((e) => e.logicClasses || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (lc) => {
        const methods = lc.methods
          .filter((m) => m.visibility === "public")
          .map((m) => m.name + "()")
          .join(", ");
        return [lc.className, lc.extends, methods || "\u2014"];
      });
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpModelsSource;
}

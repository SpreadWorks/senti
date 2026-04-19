/**
 * Directory-level analyzers for Laravel preset tests.
 *
 * These helpers are used only by unit tests. They were previously
 * exported from data/*.js modules but have been relocated here so
 * that preset data/ files do not import sdd-forge internals
 * (spec 191: preset DI container).
 */

import fs from "fs";
import path from "path";
import { findFiles, camelToSnake, pluralize } from "../../../docs/lib/scanner.js";
import { parseComposer, parseEnvFile } from "../../lib/composer-utils.js";

// ---------------------------------------------------------------------------
// analyzeControllers (from data/controllers.js)
// ---------------------------------------------------------------------------

const SKIP_DI_TYPES = new Set(["Request", "array", "string", "int", "bool"]);

function parseControllerContent(content) {
  const classMatch = content.match(/class\s+(\w+)\s+extends\s+(\w+)/);
  const className = classMatch ? classMatch[1] : null;
  const parentClass = classMatch ? classMatch[2] : "";

  const methodRegex = /public\s+function\s+(\w+)\s*\(/g;
  const actions = [];
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    if (m[1] !== "__construct" && !m[1].startsWith("_")) {
      actions.push(m[1]);
    }
  }

  const diDeps = [];
  const ctorMatch = content.match(
    /public\s+function\s+__construct\s*\(([^)]*)\)/s,
  );
  if (ctorMatch) {
    const depRegex = /(\w+)\s+\$\w+/g;
    let dm;
    while ((dm = depRegex.exec(ctorMatch[1])) !== null) {
      if (!SKIP_DI_TYPES.has(dm[1])) diDeps.push(dm[1]);
    }
  }

  const middleware = [];
  const mwRegex = /\$this->middleware\(\s*['"]([^'"]+)['"]/g;
  while ((m = mwRegex.exec(content)) !== null) {
    middleware.push(m[1]);
  }

  return { className, parentClass, actions, diDeps, middleware };
}

export function analyzeControllers(sourceRoot) {
  const baseDir = path.join(sourceRoot, "app", "Http", "Controllers");
  if (!fs.existsSync(baseDir)) return { controllers: [], summary: { total: 0, totalActions: 0 } };

  const files = findFiles(baseDir, "*.php", ["Controller.php"], true);
  const controllers = files.map((f) => {
    const content = fs.readFileSync(f.absPath, "utf8");
    const parsed = parseControllerContent(content);
    return {
      file: path.join("app/Http/Controllers", f.relPath),
      className: parsed.className ?? path.basename(f.absPath, ".php"),
      parentClass: parsed.parentClass,
      actions: parsed.actions,
      diDeps: parsed.diDeps,
      middleware: parsed.middleware,
      lines: f.lines, hash: f.hash, mtime: f.mtime,
    };
  });

  const totalActions = controllers.reduce((s, c) => s + c.actions.length, 0);
  return { controllers, summary: { total: controllers.length, totalActions } };
}

// ---------------------------------------------------------------------------
// analyzeModels (from data/models.js)
// ---------------------------------------------------------------------------

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

  const scopes = [];
  const scopeRegex = /public\s+function\s+scope(\w+)\s*\(/g;
  let m;
  while ((m = scopeRegex.exec(content)) !== null) {
    scopes.push(m[1]);
  }

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

export function analyzeModels(sourceRoot) {
  let baseDir = path.join(sourceRoot, "app", "Models");
  if (!fs.existsSync(baseDir)) {
    baseDir = path.join(sourceRoot, "app");
  }
  if (!fs.existsSync(baseDir)) return { models: [], summary: { total: 0 } };

  const files = findFiles(baseDir, "*.php", [], true);
  const models = [];
  for (const f of files) {
    const content = fs.readFileSync(f.absPath, "utf8");
    const parsed = parseModelContent(content);
    if (!parsed) continue;

    const isInModelsDir = baseDir.endsWith(path.join("app", "Models"));
    const filePrefix = isInModelsDir ? "app/Models" : "app";

    models.push({
      file: path.join(filePrefix, f.relPath),
      className: parsed.className ?? path.basename(f.absPath, ".php"),
      parentClass: parsed.parentClass,
      tableName: parsed.tableName,
      fillable: parsed.fillable,
      guarded: parsed.guarded,
      casts: parsed.casts,
      hidden: parsed.hidden,
      relations: parsed.relations,
      scopes: parsed.scopes,
      accessors: parsed.accessors,
      lines: f.lines, hash: f.hash, mtime: f.mtime,
    });
  }

  return { models, summary: { total: models.length } };
}

// ---------------------------------------------------------------------------
// analyzeRoutes (from data/routes.js)
// ---------------------------------------------------------------------------

function parseHandler(handler) {
  const arrayMatch = handler.match(
    /\[\s*([\w\\:]+)\s*,\s*['"](\w+)['"]\s*\]/,
  );
  if (arrayMatch) {
    const controller = arrayMatch[1].replace(/::class$/, "").split("\\").pop();
    return { controller, action: arrayMatch[2] };
  }

  const strMatch = handler.match(/['"](\w+)@(\w+)['"]/);
  if (strMatch) {
    return { controller: strMatch[1], action: strMatch[2] };
  }

  const classMatch = handler.match(/([\w\\]+)::class/);
  if (classMatch) {
    return { controller: classMatch[1].split("\\").pop(), action: "__invoke" };
  }

  return { controller: "", action: "" };
}

function parseStringList(str) {
  const items = [];
  const re = /['"](\w+)['"]/g;
  let match;
  while ((match = re.exec(str)) !== null) items.push(match[1]);
  return items;
}

function filterResourceActions(actions, chain) {
  const onlyMatch = chain.match(/->only\s*\(\s*\[([^\]]*)\]\s*\)/);
  if (onlyMatch) {
    const allowed = parseStringList(onlyMatch[1]);
    return actions.filter((a) => allowed.includes(a));
  }
  const exceptMatch = chain.match(/->except\s*\(\s*\[([^\]]*)\]\s*\)/);
  if (exceptMatch) {
    const excluded = parseStringList(exceptMatch[1]);
    return actions.filter((a) => !excluded.includes(a));
  }
  return actions;
}

function singularize(name) {
  if (name.endsWith("ies")) return name.slice(0, -3) + "y";
  if (
    name.endsWith("ses") ||
    name.endsWith("xes") ||
    name.endsWith("zes") ||
    name.endsWith("shes") ||
    name.endsWith("ches")
  )
    return name.slice(0, -2);
  if (name.endsWith("s")) return name.slice(0, -1);
  return name;
}

function buildResourceUri(resourceName, routeType) {
  const segments = resourceName.split(".");
  const parts = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    parts.push(seg);
    if (i < segments.length - 1) {
      parts.push(`{${singularize(seg)}}`);
    }
  }
  const base = "/" + parts.join("/");
  return routeType === "api" ? `/api${base}` : base;
}

function resourceActionUri(baseUri, resourceName, action) {
  const lastSegment = resourceName.split(".").pop();
  const param = singularize(lastSegment);
  const needsParam = ["show", "edit", "update", "destroy"].includes(action);
  const suffix = needsParam ? `/{${param}}` : "";
  const editSuffix = action === "edit" ? "/edit" : "";
  return baseUri + suffix + editSuffix;
}

function resourceMethod(action) {
  const map = {
    index: "GET",
    create: "GET",
    store: "POST",
    show: "GET",
    edit: "GET",
    update: "PUT",
    destroy: "DELETE",
  };
  return map[action] || "GET";
}

function parseRouteFile(content, routeType) {
  const routes = [];

  const methods = "get|post|put|patch|delete|any|options";
  const routeRegex = new RegExp(
    `Route::(?:${methods})\\s*\\(\\s*['"]([^'"]+)['"]\\s*,\\s*(.+?)\\s*\\)`,
    "g",
  );

  let m;
  while ((m = routeRegex.exec(content)) !== null) {
    const httpMethod = m[0].match(/Route::(\w+)/)[1].toUpperCase();
    const uri = m[1];
    const handler = m[2];
    const parsed = parseHandler(handler);

    routes.push({
      httpMethod: httpMethod === "ANY" ? "*" : httpMethod,
      uri: routeType === "api" ? `/api${uri}` : uri,
      controller: parsed.controller,
      action: parsed.action,
      routeType,
    });
  }

  const resourceRegex =
    /Route::(?:api)?[Rr]esource\s*\(\s*['"]([^'"]+)['"]\s*,\s*([\w\\:]+)\s*\)([^\n;]*)/g;
  while ((m = resourceRegex.exec(content)) !== null) {
    const resourceName = m[1];
    const controller = m[2].replace(/::class$/, "").split("\\").pop();
    const chain = m[3];
    const isApi = m[0].includes("apiResource");
    const allActions = isApi
      ? ["index", "store", "show", "update", "destroy"]
      : ["index", "create", "store", "show", "edit", "update", "destroy"];
    const actions = filterResourceActions(allActions, chain);

    const baseUri = buildResourceUri(resourceName, routeType);

    for (const action of actions) {
      routes.push({
        httpMethod: resourceMethod(action),
        uri: resourceActionUri(baseUri, resourceName, action),
        controller,
        action,
        routeType,
      });
    }
  }

  return routes;
}

export function analyzeRoutes(sourceRoot) {
  const routeFiles = [
    { file: "routes/web.php", routeType: "web" },
    { file: "routes/api.php", routeType: "api" },
  ];

  const routes = [];

  for (const { file, routeType } of routeFiles) {
    const filePath = path.join(sourceRoot, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    routes.push(...parseRouteFile(content, routeType));
  }

  const apiRoutes = routes.filter((r) => r.routeType === "api").length;
  const webRoutes = routes.filter((r) => r.routeType === "web").length;

  return { routes, summary: { total: routes.length, apiRoutes, webRoutes } };
}

// ---------------------------------------------------------------------------
// analyzeMigrations (from data/tables.js)
// ---------------------------------------------------------------------------

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

function parseBlueprint(body, entry) {
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

  const indexRegex =
    /\$table->(index|unique|primary)\(\s*(?:\[([^\]]*)\]|['"](\w+)['"])/g;
  while ((m = indexRegex.exec(body)) !== null) {
    const indexType = m[1];
    const cols = m[2]
      ? m[2].match(/['"](\w+)['"]/g)?.map((c) => c.replace(/['"]/g, "")) || []
      : [m[3]];
    entry.indexes.push({ type: indexType, columns: cols });
  }

  const fkRegex =
    /\$table->foreign\(\s*['"](\w+)['"]\s*\)->references\(\s*['"](\w+)['"]\s*\)->on\(\s*['"](\w+)['"]\s*\)/g;
  while ((m = fkRegex.exec(body)) !== null) {
    entry.foreignKeys.push({ column: m[1], references: m[2], on: m[3] });
  }

  const foreignIdRegex =
    /\$table->foreignId\(\s*['"](\w+)['"]\s*\)[^;]*->constrained\(\s*(?:['"](\w+)['"])?\s*\)/g;
  while ((m = foreignIdRegex.exec(body)) !== null) {
    const col = m[1];
    const table = m[2] || col.replace(/_id$/, "") + "s";
    entry.foreignKeys.push({ column: col, references: "id", on: table });
  }
}

function parseMigrationScan(content, fileName, tableMap) {
  const createRegex = /Schema::create\s*\(\s*['"](\w+)['"]\s*,\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = createRegex.exec(content)) !== null) {
    const tableName = m[1];
    const body = m[2];
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { name: tableName, columns: [], indexes: [], foreignKeys: [], migrationFiles: [] });
    }
    const entry = tableMap.get(tableName);
    entry.migrationFiles.push(fileName);
    parseBlueprint(body, entry);
  }

  const tableRegex = /Schema::table\s*\(\s*['"](\w+)['"]\s*,\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\}\s*\)/g;
  while ((m = tableRegex.exec(content)) !== null) {
    const tableName = m[1];
    const body = m[2];
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { name: tableName, columns: [], indexes: [], foreignKeys: [], migrationFiles: [] });
    }
    const entry = tableMap.get(tableName);
    entry.migrationFiles.push(fileName);
    parseBlueprint(body, entry);
  }
}

export function analyzeMigrations(sourceRoot) {
  const migrationsDir = path.join(sourceRoot, "database", "migrations");
  if (!fs.existsSync(migrationsDir)) return { tables: [], summary: { total: 0, totalColumns: 0 } };

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".php"))
    .sort();

  const tableMap = new Map();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    parseMigrationScan(content, file, tableMap);
  }

  const tables = [...tableMap.values()];
  const totalColumns = tables.reduce((s, t) => s + t.columns.length, 0);

  return { tables, summary: { total: tables.length, totalColumns } };
}

// ---------------------------------------------------------------------------
// analyzeConfig (from data/config.js)
// ---------------------------------------------------------------------------

function parseAliasScan(str) {
  const aliases = {};
  const re = /['"](\w+)['"]\s*=>\s*([\w\\]+)(?:::class)?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    aliases[m[1]] = m[2].split("\\").pop();
  }
  return aliases;
}

function extractClassNamesScan(str) {
  const names = [];
  const re = /([\w\\]+)(?:::class)?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const name = m[1].split("\\").pop();
    if (name && name[0] === name[0].toUpperCase() && name !== "class") {
      names.push(name);
    }
  }
  return names;
}

function parseKernelMw(content) {
  const result = { global: [], groups: {}, aliases: {} };

  const globalMatch = content.match(/\$middleware\s*=\s*\[([\s\S]*?)\];/);
  if (globalMatch) {
    result.global = extractClassNamesScan(globalMatch[1]);
  }

  const groupsMatch = content.match(/\$middlewareGroups\s*=\s*\[([\s\S]*?)\];/);
  if (groupsMatch) {
    const groupRegex = /['"](\w+)['"]\s*=>\s*\[([\s\S]*?)\]/g;
    let gm;
    while ((gm = groupRegex.exec(groupsMatch[1])) !== null) {
      result.groups[gm[1]] = extractClassNamesScan(gm[2]);
    }
  }

  const aliasMatch = content.match(/\$(?:middlewareAliases|routeMiddleware)\s*=\s*\[([\s\S]*?)\];/);
  if (aliasMatch) {
    result.aliases = parseAliasScan(aliasMatch[1]);
  }

  return result;
}

function parseBootstrapMw(content) {
  const result = { global: [], groups: {}, aliases: {} };

  const appendRegex = /->(?:append|prepend)\s*\(\s*([\w\\]+)(?:::class)?\s*\)/g;
  let m;
  while ((m = appendRegex.exec(content)) !== null) {
    result.global.push(m[1].split("\\").pop());
  }

  const aliasMatch = content.match(/->alias\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (aliasMatch) {
    result.aliases = parseAliasScan(aliasMatch[1]);
  }

  const groupRegex = /->group\s*\(\s*['"](\w+)['"]\s*,\s*\[([\s\S]*?)\]\s*\)/g;
  while ((m = groupRegex.exec(content)) !== null) {
    result.groups[m[1]] = extractClassNamesScan(m[2]);
  }

  return result;
}

export function analyzeConfig(sourceRoot) {
  const extras = {};

  extras.composerDeps = parseComposer(sourceRoot);
  extras.envKeys = parseEnvFile(sourceRoot, [".env.example"]);

  const configDir = path.join(sourceRoot, "config");
  extras.configFiles = [];
  if (fs.existsSync(configDir)) {
    extras.configFiles = fs.readdirSync(configDir)
      .filter((f) => f.endsWith(".php"))
      .sort()
      .map((f) => {
        const content = fs.readFileSync(path.join(configDir, f), "utf8");
        const topKeys = [];
        const keyRegex = /['"](\w+)['"]\s*=>/g;
        let m;
        const returnPos = content.indexOf("return [");
        if (returnPos >= 0) {
          const body = content.slice(returnPos, returnPos + 2000);
          while ((m = keyRegex.exec(body)) !== null) {
            if (!topKeys.includes(m[1])) topKeys.push(m[1]);
            if (topKeys.length >= 20) break;
          }
        }
        return { file: f, keys: topKeys };
      });
  }

  const provDir = path.join(sourceRoot, "app", "Providers");
  extras.providers = [];
  if (fs.existsSync(provDir)) {
    extras.providers = fs.readdirSync(provDir)
      .filter((f) => f.endsWith(".php"))
      .sort()
      .map((f) => {
        const content = fs.readFileSync(path.join(provDir, f), "utf8");
        const classMatch = content.match(/class\s+(\w+)/);
        const className = classMatch ? classMatch[1] : f.replace(".php", "");
        const hasRegister = /public\s+function\s+register\s*\(/.test(content);
        const hasBoot = /public\s+function\s+boot\s*\(/.test(content);
        return { file: path.join("app/Providers", f), className, hasRegister, hasBoot };
      });
  }

  extras.middlewareRegistration = { global: [], groups: {}, aliases: {} };

  const kernelPath = path.join(sourceRoot, "app", "Http", "Kernel.php");
  if (fs.existsSync(kernelPath)) {
    const content = fs.readFileSync(kernelPath, "utf8");
    Object.assign(extras.middlewareRegistration, parseKernelMw(content));
  }

  const bootstrapPath = path.join(sourceRoot, "bootstrap", "app.php");
  if (fs.existsSync(bootstrapPath)) {
    const content = fs.readFileSync(bootstrapPath, "utf8");
    const bsMw = parseBootstrapMw(content);
    extras.middlewareRegistration.global.push(...bsMw.global);
    for (const [key, value] of Object.entries(bsMw.groups)) {
      extras.middlewareRegistration.groups[key] = (extras.middlewareRegistration.groups[key] || []).concat(value);
    }
    Object.assign(extras.middlewareRegistration.aliases, bsMw.aliases);
  }

  return extras;
}

/**
 * Directory-level analyzers for Symfony preset tests.
 *
 * These helpers are used only by unit tests. They were previously
 * exported from data/*.js modules but have been relocated here so
 * that preset data/ files do not import sdd-forge internals
 * (spec 191: preset DI container).
 */

import fs from "fs";
import path from "path";
import { findFiles } from "../../../docs/lib/scanner.js";
import { camelToSnake } from "../../../docs/lib/php-array-parser.js";
import { parseComposer, parseEnvFile } from "../../lib/composer-utils.js";

// ---------------------------------------------------------------------------
// Controllers analyzer
// ---------------------------------------------------------------------------

const METHOD_RE = /public\s+function\s+(\w+)\s*\(/g;
const ATTR_LINE_RE = /^\s*#\[/;
const SKIP_DI_TYPES = new Set(["Request", "array", "string", "int", "bool", "float"]);

function findMethodsWithAttributes(content) {
  const lines = content.split("\n");
  const lineOffsets = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  function offsetToLine(pos) {
    let lo = 0;
    let hi = lineOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineOffsets[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  const results = [];
  let m;
  while ((m = METHOD_RE.exec(content)) !== null) {
    const methodName = m[1];
    const methodLineIdx = offsetToLine(m.index);
    const attrLines = [];
    for (let i = methodLineIdx - 1; i >= 0; i--) {
      const line = lines[i];
      const trimmed = line.trim();
      if (ATTR_LINE_RE.test(line)) {
        attrLines.unshift(line);
        continue;
      }
      if (trimmed === "") break;
      break;
    }
    results.push({ methodName, attrBlock: attrLines.join("\n") });
  }
  return results;
}

function parseControllerContent(content) {
  const classMatch = content.match(/class\s+(\w+)\s+(?:extends\s+(\w+))?/);
  const className = classMatch ? classMatch[1] : null;
  const parentClass = classMatch && classMatch[2] ? classMatch[2] : "";

  const classRouteMatch = content.match(/#\[Route\s*\(\s*['"]([^'"]*)['"]/);
  const classRoutePrefix = classRouteMatch ? classRouteMatch[1] : "";

  const actions = [];
  const methodMatches = findMethodsWithAttributes(content);
  for (const { methodName, attrBlock } of methodMatches) {
    if (methodName === "__construct" || methodName.startsWith("_")) continue;

    const routes = [];
    const routeAttrRegex = /#\[Route\s*\(\s*['"]([^'"]*)['"]\s*(?:,\s*(?:name:\s*['"]([^'"]*)['"]\s*)?(?:,?\s*methods:\s*\[([^\]]*)\])?)?\s*\)/g;
    let rm;
    while ((rm = routeAttrRegex.exec(attrBlock)) !== null) {
      const routePath = rm[1];
      const routeName = rm[2] || "";
      const methods = rm[3]
        ? rm[3].match(/['"](\w+)['"]/g)?.map((s) => s.replace(/['"]/g, "")) || ["GET"]
        : ["GET"];
      routes.push({ path: classRoutePrefix + routePath, name: routeName, methods });
    }

    actions.push({ name: methodName, routes });
  }

  const diDeps = [];
  const ctorMatch = content.match(/public\s+function\s+__construct\s*\(([^)]*)\)/s);
  if (ctorMatch) {
    const depRegex = /(?:private|protected|public)?\s*(?:readonly\s+)?(\w+)\s+\$\w+/g;
    let dm;
    while ((dm = depRegex.exec(ctorMatch[1])) !== null) {
      if (!SKIP_DI_TYPES.has(dm[1])) {
        diDeps.push(dm[1]);
      }
    }
  }

  return { className, parentClass, classRoutePrefix, actions, diDeps };
}

export function analyzeControllers(sourceRoot) {
  const baseDir = path.join(sourceRoot, "src", "Controller");
  if (!fs.existsSync(baseDir)) return { controllers: [], summary: { total: 0, totalActions: 0 } };

  const files = findFiles(baseDir, "*.php", [".gitkeep"], true);
  const controllers = files.map((f) => {
    const content = fs.readFileSync(f.absPath, "utf8");
    const parsed = parseControllerContent(content);
    return {
      file: path.join("src/Controller", f.relPath),
      className: parsed.className ?? path.basename(f.absPath, ".php"),
      parentClass: parsed.parentClass,
      actions: parsed.actions,
      diDeps: parsed.diDeps,
      classRoutePrefix: parsed.classRoutePrefix,
      lines: f.lines, hash: f.hash, mtime: f.mtime,
    };
  });

  const totalActions = controllers.reduce((s, c) => s + c.actions.length, 0);
  return { controllers, summary: { total: controllers.length, totalActions } };
}

// ---------------------------------------------------------------------------
// Entities analyzer
// ---------------------------------------------------------------------------

function extractColumns(content) {
  const columns = [];
  const lines = content.split("\n");
  const attrBuffer = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\s*#\[ORM\\/.test(line)) {
      attrBuffer.push(trimmed);
      continue;
    }

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

export function analyzeEntities(sourceRoot) {
  const baseDir = path.join(sourceRoot, "src", "Entity");
  if (!fs.existsSync(baseDir)) return { entities: [], summary: { total: 0 } };

  const files = findFiles(baseDir, "*.php", [], true);
  const entities = [];
  for (const f of files) {
    const content = fs.readFileSync(f.absPath, "utf8");
    const parsed = parseEntityContent(content);
    if (!parsed) continue;

    entities.push({
      file: path.join("src/Entity", f.relPath),
      className: parsed.className ?? path.basename(f.absPath, ".php"),
      tableName: parsed.tableName,
      repositoryClass: parsed.repositoryClass,
      columns: parsed.columns,
      relations: parsed.relations,
      lines: f.lines, hash: f.hash, mtime: f.mtime,
    });
  }

  return { entities, summary: { total: entities.length } };
}

// ---------------------------------------------------------------------------
// Routes analyzer
// ---------------------------------------------------------------------------

function parseYamlContent(content) {
  const routes = [];
  const lines = content.split("\n");

  let currentRoute = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const routeNameMatch = line.match(/^(\w[\w._-]*):\s*$/);
    if (routeNameMatch) {
      if (currentRoute && currentRoute.path) routes.push(currentRoute);
      currentRoute = { name: routeNameMatch[1], path: "", controller: "", methods: [], source: "yaml" };
      continue;
    }

    const inlineMatch = line.match(/^(\w[\w._-]*):\s*\{(.+)\}\s*$/);
    if (inlineMatch) {
      if (currentRoute && currentRoute.path) routes.push(currentRoute);
      const name = inlineMatch[1];
      const body = inlineMatch[2];
      const pathMatch = body.match(/path:\s*([^\s,}]+)/);
      const ctrlMatch = body.match(/controller:\s*([^\s,}]+)/);
      currentRoute = {
        name,
        path: pathMatch ? pathMatch[1] : "",
        controller: ctrlMatch ? ctrlMatch[1] : "",
        methods: [],
        source: "yaml",
      };
      continue;
    }

    if (!currentRoute) continue;

    const pathMatch = trimmed.match(/^path:\s*(.+)/);
    if (pathMatch) {
      currentRoute.path = pathMatch[1].trim();
      continue;
    }

    const ctrlMatch = trimmed.match(/^controller:\s*(.+)/);
    if (ctrlMatch) {
      currentRoute.controller = ctrlMatch[1].trim();
      continue;
    }

    const methodsMatch = trimmed.match(/^methods:\s*(.+)/);
    if (methodsMatch) {
      const val = methodsMatch[1].trim();
      if (val.startsWith("[")) {
        currentRoute.methods = val.replace(/[\[\]]/g, "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      } else {
        currentRoute.methods = val.split("|").map((s) => s.trim().toUpperCase()).filter(Boolean);
      }
    }

    const typeMatch = trimmed.match(/^type:\s*(annotation|attribute)/);
    if (typeMatch) {
      currentRoute = null;
    }
  }

  if (currentRoute && currentRoute.path) routes.push(currentRoute);

  return routes;
}

const SCAN_METHOD_RE = /public\s+function\s+(\w+)\s*\(/g;
const SCAN_ATTR_LINE_RE = /^\s*#\[/;

function findMethodsWithAttributesScan(content) {
  const lines = content.split("\n");
  const lineOffsets = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  function offsetToLine(pos) {
    let lo = 0;
    let hi = lineOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineOffsets[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  const results = [];
  let m;
  while ((m = SCAN_METHOD_RE.exec(content)) !== null) {
    const methodName = m[1];
    const methodLineIdx = offsetToLine(m.index);
    const attrLines = [];
    for (let i = methodLineIdx - 1; i >= 0; i--) {
      const line = lines[i];
      const trimmed = line.trim();
      if (SCAN_ATTR_LINE_RE.test(line)) {
        attrLines.unshift(line);
        continue;
      }
      if (trimmed === "") break;
      break;
    }
    results.push({ methodName, attrBlock: attrLines.join("\n") });
  }
  return results;
}

export function analyzeRoutes(sourceRoot) {
  const routes = [];

  const yamlRoutes = parseScanYamlRoutes(sourceRoot);
  routes.push(...yamlRoutes);

  const attrRoutes = parseScanAttributeRoutes(sourceRoot);
  routes.push(...attrRoutes);

  return {
    routes,
    summary: {
      total: routes.length,
      yamlRoutes: yamlRoutes.length,
      attributeRoutes: attrRoutes.length,
    },
  };
}

function parseScanYamlRoutes(sourceRoot) {
  const routes = [];
  const routeFiles = [];

  const mainRoute = path.join(sourceRoot, "config", "routes.yaml");
  if (fs.existsSync(mainRoute)) routeFiles.push(mainRoute);

  const routesDir = path.join(sourceRoot, "config", "routes");
  if (fs.existsSync(routesDir)) {
    for (const f of fs.readdirSync(routesDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml")).sort()) {
      routeFiles.push(path.join(routesDir, f));
    }
  }

  for (const filePath of routeFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    routes.push(...parseYamlContent(content));
  }

  return routes;
}

function parseScanAttributeRoutes(sourceRoot) {
  const controllerDir = path.join(sourceRoot, "src", "Controller");
  if (!fs.existsSync(controllerDir)) return [];

  const files = findFiles(controllerDir, "*.php", [], true);
  const routes = [];
  for (const f of files) {
    const content = fs.readFileSync(f.absPath, "utf8");
    if (/#\[Route/.test(content)) {
      routes.push(...extractScanAttributeRoutes(content));
    }
  }
  return routes;
}

function extractScanAttributeRoutes(content) {
  const routes = [];

  const classRouteMatch = content.match(/#\[Route\s*\(\s*['"]([^'"]*)['"]/);
  const classPrefix = classRouteMatch ? classRouteMatch[1] : "";

  const classMatch = content.match(/class\s+(\w+)/);
  const controllerName = classMatch ? classMatch[1] : "";

  const methodMatches = findMethodsWithAttributesScan(content);
  for (const { methodName, attrBlock } of methodMatches) {
    if (methodName === "__construct" || methodName.startsWith("_")) continue;

    const routeAttrRegex = /#\[Route\s*\(\s*['"]([^'"]*)['"]\s*(?:,\s*(?:name:\s*['"]([^'"]*)['"]\s*)?(?:,?\s*methods:\s*\[([^\]]*)\])?)?\s*\)/g;
    let rm;
    while ((rm = routeAttrRegex.exec(attrBlock)) !== null) {
      const routePath = rm[1];
      const routeName = rm[2] || "";
      const methods = rm[3]
        ? rm[3].match(/['"](\w+)['"]/g)?.map((s) => s.replace(/['"]/g, "").toUpperCase()) || ["GET"]
        : ["GET"];

      routes.push({
        name: routeName,
        path: classPrefix + routePath,
        controller: controllerName ? `${controllerName}::${methodName}` : methodName,
        methods,
        source: "attribute",
      });
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Migrations analyzer
// ---------------------------------------------------------------------------

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

  const alterRegex = /\$this->addSql\s*\(\s*['"]ALTER TABLE\s+(\w+)\s+(.*?)['"]\s*\)/gi;
  while ((m = alterRegex.exec(content)) !== null) {
    const tableName = m[1];
    const alterBody = m[2];
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { name: tableName, columns: [], foreignKeys: [] });
    }
    parseAlterTable(alterBody, tableMap.get(tableName));
  }

  const dbalCreateRegex = /\$schema->createTable\s*\(\s*['"](\w+)['"]\s*\)/g;
  while ((m = dbalCreateRegex.exec(content)) !== null) {
    const tableName = m[1];
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, { name: tableName, columns: [], foreignKeys: [] });
    }
  }

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

export function analyzeMigrations(sourceRoot) {
  const migrationsDir = path.join(sourceRoot, "migrations");
  if (!fs.existsSync(migrationsDir)) return { tables: [], summary: { total: 0, totalColumns: 0 } };

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".php"))
    .sort();

  const tableMap = new Map();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    parseMigration(content, tableMap);
  }

  const tables = [...tableMap.values()];
  const totalColumns = tables.reduce((s, t) => s + t.columns.length, 0);

  return { tables, summary: { total: tables.length, totalColumns } };
}

// ---------------------------------------------------------------------------
// Config analyzer
// ---------------------------------------------------------------------------

function parseBundlesContent(content) {
  const bundles = [];
  const bundleRegex = /([\w\\]+)::class\s*=>/g;
  let m;
  while ((m = bundleRegex.exec(content)) !== null) {
    const fullName = m[1];
    const shortName = fullName.split("\\").pop();
    bundles.push({ fullName, shortName });
  }
  return bundles;
}

export function analyzeConfig(sourceRoot) {
  const extras = {};

  extras.composerDeps = parseComposer(sourceRoot);

  extras.envKeys = parseEnvFile(sourceRoot, [".env", ".env.example"]);

  const configDir = path.join(sourceRoot, "config", "packages");
  extras.configFiles = [];
  if (fs.existsSync(configDir)) {
    extras.configFiles = fs.readdirSync(configDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort()
      .map((f) => {
        const content = fs.readFileSync(path.join(configDir, f), "utf8");
        const topKeys = [];
        for (const line of content.split("\n")) {
          const keyMatch = line.match(/^(\w[\w_-]*):/);
          if (keyMatch && !topKeys.includes(keyMatch[1])) {
            topKeys.push(keyMatch[1]);
            if (topKeys.length >= 20) break;
          }
        }
        return { file: f, keys: topKeys };
      });
  }

  const servicesPath = path.join(sourceRoot, "config", "services.yaml");
  if (fs.existsSync(servicesPath)) {
    const content = fs.readFileSync(servicesPath, "utf8");
    extras.services = {
      autowire: /autowire:\s*true/.test(content),
      autoconfigure: /autoconfigure:\s*true/.test(content),
    };
  } else {
    extras.services = { autowire: false, autoconfigure: false };
  }

  const kernelPath = path.join(sourceRoot, "src", "Kernel.php");
  extras.kernel = null;
  if (fs.existsSync(kernelPath)) {
    const content = fs.readFileSync(kernelPath, "utf8");
    const classMatch = content.match(/class\s+(\w+)\s+extends\s+(\w+)/);
    extras.kernel = {
      className: classMatch ? classMatch[1] : "Kernel",
      parentClass: classMatch ? classMatch[2] : "",
    };
  }

  const bundlesPath = path.join(sourceRoot, "config", "bundles.php");
  extras.bundles = [];
  if (fs.existsSync(bundlesPath)) {
    const content = fs.readFileSync(bundlesPath, "utf8");
    extras.bundles = parseBundlesContent(content);
  }

  return extras;
}

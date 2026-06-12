import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath, pathToFileURL } from "url";
import { repoRoot } from "./cli.js";
import { loadRawConfig, sentiConfigPath, sentiDir } from "./config.js";
import { Envelope } from "./flow-envelope.js";
import { runCmd, assertOk } from "./process.js";

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const KNOWN_PLUGIN_PACKAGE_PATHS = Object.freeze([
  "plugin.json",
  "commands/",
  "skills/",
  "presets/",
  "hooks/",
  "lib/",
  "config.schema.json",
  "config.defaults.json",
]);
const MAX_ENABLED_PLUGIN_PACKAGES = 100;
const MAX_PLUGIN_HOOK_FILES = 200;
const MAX_PLUGIN_COPY_FILES = 2000;
const MAX_PLUGIN_PATH_DEPTH = 20;
const MAX_PLUGIN_JSON_BYTES = 1024 * 1024;
const MAX_PLUGIN_RELATIVE_PATH_BYTES = 300;
const FLOW_COMMANDS = new Set(["prepare", "gate", "review", "test-execute", "test-result-review", "retro", "final-regression", "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"]);
const FLOW_COMMAND_HOOKS = new Set(["pre", "post", "onError", "finally"]);
const CORE_COMMANDS = new Set(["docs", "flow", "check", "metrics", "spec", "hook", "setup", "upgrade", "presets", "plugin", "help"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function ensurePluginConfig(config) {
  if (!config.plugin || typeof config.plugin !== "object") config.plugin = {};
  if (!Array.isArray(config.plugin.sources)) config.plugin.sources = [];
  if (!Array.isArray(config.plugin.packages)) config.plugin.packages = [];
  if (!config.plugin.config || typeof config.plugin.config !== "object") config.plugin.config = {};
  return config.plugin;
}

export function readProjectConfig(root = repoRoot()) {
  const config = loadRawConfig(root);
  ensurePluginConfig(config);
  return config;
}

function readStoredProjectConfig(root = repoRoot()) {
  const config = readJson(sentiConfigPath(root));
  ensurePluginConfig(config);
  return config;
}

export function writeProjectConfig(root, config) {
  writeJson(sentiConfigPath(root), config);
}

export function maskPluginSource(source) {
  return String(source).replace(/(https?:\/\/[^:\s/@]+:)[^@\s/]+(@)/g, "$1***$2");
}

function sourceLocation(source) {
  return source.path || source.url || source.source;
}

function normalizeRel(rel, label = "path") {
  if (typeof rel !== "string" || rel.trim() === "") {
    throw new Error(`unsafe ${label}: must be a non-empty string`);
  }
  const value = rel.replace(/\\/g, "/");
  if (path.isAbsolute(value) || value === "." || value === ".." || value.startsWith("../") || value.includes("/../") || value.endsWith("/..")) {
    throw new Error(`unsafe ${label}: parent traversal or absolute path is not allowed`);
  }
  const parts = value.split("/");
  if (parts.includes(".git")) throw new Error(`unsafe ${label}: .git content is not allowed`);
  if (parts.includes("node_modules")) throw new Error(`unsafe ${label}: node_modules content is not allowed`);
  if (parts.length > MAX_PLUGIN_PATH_DEPTH) throw new Error(`unsafe ${label}: path depth exceeds ${MAX_PLUGIN_PATH_DEPTH}`);
  if (Buffer.byteLength(value) > MAX_PLUGIN_RELATIVE_PATH_BYTES) throw new Error(`unsafe ${label}: relative path exceeds ${MAX_PLUGIN_RELATIVE_PATH_BYTES} bytes`);
  return value;
}

function isUnderPath(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function importSpecifiers(source) {
  const patterns = [
    /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^"']*?\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const out = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) out.push(match[1]);
  }
  return out;
}

function resolveImportPath(specifier, moduleDir) {
  if (specifier.startsWith("node:")) return null;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(specifier)) {
    if (!specifier.startsWith("file:")) return null;
    return fileURLToPath(specifier);
  }
  if (path.isAbsolute(specifier)) return specifier;
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return path.resolve(moduleDir, specifier);
  }
  return null;
}

function assertNoCoreInternalImports(root, pluginId, pluginRoot, rel) {
  const modulePath = path.join(pluginRoot, normalizeRel(rel, "hook module"));
  const source = fs.readFileSync(modulePath, "utf8");
  const moduleDir = path.dirname(modulePath);
  const coreRoots = [
    path.resolve(root, "src"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  ];
  for (const specifier of importSpecifiers(source)) {
    const resolved = resolveImportPath(specifier, moduleDir);
    if (!resolved) continue;
    const absolute = path.resolve(resolved);
    if (coreRoots.some((coreRoot) => isUnderPath(absolute, coreRoot)) && !isUnderPath(absolute, pluginRoot)) {
      throw new Error(`plugin hook ${pluginId}/${rel} imports core internal path: ${specifier}`);
    }
  }
}

function assertId(id, label = "id") {
  if (!ID_RE.test(String(id || ""))) throw new Error(`unsafe ${label}: invalid id "${id}"`);
}

function isUnderFileAllowlist(rel, files) {
  const normalized = normalizeRel(rel, "contribution path");
  return files.some((entry) => {
    const file = normalizeRel(entry, "files entry");
    if (file.endsWith("/")) return normalized === file.slice(0, -1) || normalized.startsWith(file);
    return normalized === file || normalized.startsWith(`${file}/`);
  });
}

function walkFiles(root, rel = "") {
  const current = path.join(root, rel);
  const stat = fs.lstatSync(current);
  if (stat.isSymbolicLink()) throw new Error(`unsafe package: symlink not allowed: ${rel || "."}`);
  if (stat.isDirectory()) {
    const out = [];
    for (const entry of fs.readdirSync(current)) {
      const childRel = rel ? `${rel}/${entry}` : entry;
      normalizeRel(childRel, "package path");
      out.push(...walkFiles(root, childRel));
    }
    return out;
  }
  if (!stat.isFile()) return [];
  normalizeRel(rel, "package path");
  if (/\.json$/i.test(rel) && stat.size > MAX_PLUGIN_JSON_BYTES) {
    throw new Error(`unsafe package metadata: JSON file exceeds ${MAX_PLUGIN_JSON_BYTES} bytes: ${rel}`);
  }
  return [rel];
}

function validatePackageJson(root) {
  const packagePath = path.join(root, "package.json");
  if (!fs.existsSync(packagePath)) return;
  const pkg = readJson(packagePath);
  for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    if (pkg[key] && Object.keys(pkg[key]).length > 0) throw new Error(`unsafe package.json: ${key} are not allowed`);
  }
  if (pkg.scripts && Object.keys(pkg.scripts).length > 0) throw new Error("unsafe package.json: scripts are not allowed");
}

export class PluginManifest {
  constructor(root, raw, providerId = raw?.name) {
    this.root = root;
    this.providerId = providerId;
    this.name = raw?.name;
    this.type = raw?.type || "mixed";
    this.files = Array.isArray(raw?.files) && raw.files.length > 0 ? raw.files : KNOWN_PLUGIN_PACKAGE_PATHS;
    this.contributions = raw?.contributions || {};
    this.raw = raw;
    this.validate();
  }

  validate() {
    assertId(this.name, "plugin name");
    for (const file of this.files) {
      normalizeRel(file, "files entry");
      if (file === ".") throw new Error("unsafe files entry: copying repository root would include .git content");
    }
    const commands = this.contributions.commands || [];
    if (!Array.isArray(commands)) throw new Error("plugin commands contribution must be an array");
    for (const command of commands) {
      assertId(command.name, "command name");
      if (CORE_COMMANDS.has(command.name)) throw new Error(`plugin command override rejected: ${command.name} is a core command`);
      if (!isUnderFileAllowlist(command.path, this.files)) throw new Error(`contribution path outside files allowlist: ${command.path}`);
    }
    const presets = this.contributions.presets || [];
    if (!Array.isArray(presets)) throw new Error("plugin presets contribution must be an array");
    for (const preset of presets) {
      assertId(preset.key, "preset key");
      if (!isUnderFileAllowlist(preset.path, this.files)) throw new Error(`contribution path outside files allowlist: ${preset.path}`);
    }
    const dataSources = this.contributions.dataSources || [];
    if (!Array.isArray(dataSources)) throw new Error("plugin dataSources contribution must be an array");
    for (const dataSource of dataSources) {
      if (typeof dataSource.name !== "string" || !dataSource.name.includes("/")) throw new Error(`invalid dataSource name: ${dataSource.name}`);
      if (!isUnderFileAllowlist(dataSource.path, this.files)) throw new Error(`contribution path outside files allowlist: ${dataSource.path}`);
    }
    const skills = this.contributions.skills || [];
    if (!Array.isArray(skills)) throw new Error("plugin skills contribution must be an array");
    for (const skill of skills) {
      assertId(String(skill.name).replace(/^senti\./, ""), "skill name");
      if (!isUnderFileAllowlist(skill.path, this.files)) throw new Error(`contribution path outside files allowlist: ${skill.path}`);
    }
    const config = this.contributions.config;
    if (config) {
      if (config.schema && !isUnderFileAllowlist(config.schema, this.files)) throw new Error(`contribution path outside files allowlist: ${config.schema}`);
      if (config.defaults && !isUnderFileAllowlist(config.defaults, this.files)) throw new Error(`contribution path outside files allowlist: ${config.defaults}`);
    }
  }

  static fromRoot(root, providerId) {
    return new PluginManifest(root, readJson(path.join(root, "plugin.json")), providerId);
  }

  presetEntries() {
    return (this.contributions.presets || []).map((entry) => {
      const manifestPath = path.join(this.root, entry.path, "preset.json");
      const presetManifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : {};
      return {
        key: entry.key,
        dir: path.join(this.root, entry.path),
        parent: entry.parent || presetManifest.parent || null,
        label: presetManifest.label || entry.key,
        aliases: presetManifest.aliases || [],
        scan: presetManifest.scan || {},
        chapters: presetManifest.chapters || [],
        providerId: this.providerId,
      };
    });
  }

  dataSourceEntries() {
    const entries = [];
    for (const entry of this.contributions.dataSources || []) {
      const [presetKey, sourceName] = entry.name.split("/", 2);
      entries.push({ ...entry, presetKey, sourceName, providerId: this.providerId, absolutePath: path.join(this.root, entry.path) });
    }
    for (const preset of this.presetEntries()) {
      const dataDir = path.join(preset.dir, "data");
      if (!fs.existsSync(dataDir)) continue;
      for (const file of fs.readdirSync(dataDir)) {
        if (!file.endsWith(".js")) continue;
        const sourceName = path.basename(file, ".js");
        const name = `${preset.key}/${sourceName}`;
        if (entries.some((entry) => entry.name === name)) continue;
        entries.push({
          name,
          presetKey: preset.key,
          sourceName,
          path: path.relative(this.root, path.join(dataDir, file)).split(path.sep).join("/"),
          category: sourceName,
          methods: null,
          providerId: this.providerId,
          absolutePath: path.join(dataDir, file),
        });
      }
    }
    return entries;
  }

  commandEntries() {
    return (this.contributions.commands || []).map((entry) => ({
      ...entry,
      providerId: this.providerId,
      absolutePath: path.join(this.root, entry.path),
    }));
  }
}

export class PluginRegistry {
  constructor(root, manifests) {
    this.root = root;
    this.manifests = manifests;
    this.presets = new Map();
    this.dataSources = new Map();
    this.commands = new Map();
    for (const manifest of manifests) {
      for (const preset of manifest.presetEntries()) this.presets.set(preset.key, preset);
      for (const dataSource of manifest.dataSourceEntries()) this.dataSources.set(dataSource.name, dataSource);
      for (const command of manifest.commandEntries()) this.commands.set(command.name, command);
    }
  }

  resolvePreset(key) {
    return this.presets.get(key) || null;
  }

  resolveDataSource(name) {
    return this.dataSources.get(name) || null;
  }

  resolveCommand(name) {
    return this.commands.get(name) || null;
  }

  validatePresetChain(key, opts = {}) {
    const maxDepth = opts.maxDepth || 20;
    const visited = new Set();
    let current = this.resolvePreset(key);
    let depth = 0;
    while (current) {
      if (visited.has(current.key)) throw new Error(`preset parent cycle detected: ${current.key}`);
      visited.add(current.key);
      depth += 1;
      if (depth > maxDepth) throw new Error(`preset parent chain exceeds depth ${maxDepth}`);
      current = current.parent ? this.resolvePreset(current.parent) : null;
    }
  }

  validateDataDirective(name, method) {
    const entry = this.resolveDataSource(name);
    if (!entry) throw new Error(`unknown data source: ${name}`);
    if (entry.methods && !entry.methods.includes(method)) throw new Error(`unknown data source method: ${name}.${method}`);
  }

  prevalidateTemplateDirective(text) {
    const match = String(text).match(/\{\{data\("([^".]+\/[^".]+)\.([^"]+)"\)\}\}/);
    if (!match) return { ok: true };
    try {
      this.validateDataDirective(match[1], match[2]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export function loadPluginRegistry(root = repoRoot()) {
  let config;
  try {
    config = readProjectConfig(root);
  } catch (_) {
    return new PluginRegistry(root, []);
  }
  const manifests = [];
  for (const pkg of config.plugin.packages) {
    if (pkg.enabled === false) continue;
    const pluginRoot = path.join(sentiDir(root), "plugins", pkg.id);
    const manifestPath = path.join(pluginRoot, "plugin.json");
    if (!fs.existsSync(manifestPath)) continue;
    manifests.push(PluginManifest.fromRoot(pluginRoot, pkg.id));
  }
  return new PluginRegistry(root, manifests);
}

export function loadPluginConfigDefaults(root = repoRoot()) {
  const registry = loadPluginRegistry(root);
  const schemas = [];
  const defaults = [];
  for (const manifest of registry.manifests) {
    const config = manifest.contributions.config;
    if (!config) continue;
    if (config.schema) schemas.push(readJson(path.join(manifest.root, config.schema)));
    if (config.defaults) defaults.push(readJson(path.join(manifest.root, config.defaults)));
  }
  return { schemas, defaults };
}

export function discoverCorePresets() {
  const { PRESETS_DIR } = globalThis.__sentiPresetModule || {};
  if (!PRESETS_DIR) return [];
  return [];
}

function pluginSourcesDir(root) {
  return path.join(sentiDir(root), "plugin-sources");
}

function installedPluginsDir(root) {
  return path.join(sentiDir(root), "plugins");
}

export function isGitUrl(source) {
  return /^(https?:\/\/|git@|ssh:\/\/|file:\/\/)/.test(source);
}

function runGit(cwd, args, context) {
  const result = runCmd("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  assertOk(result, context);
  return result.stdout.trim();
}

function localRepoHead(source) {
  const root = path.resolve(source);
  if (!fs.existsSync(root)) throw new Error(`plugin source not found: ${source}`);
  if (!fs.existsSync(path.join(root, ".git"))) {
    PluginManifest.fromRoot(root);
    validateSourceTree(root);
    return { root, commit: hashPackageTree(root), materialized: true };
  }
  runGit(root, ["rev-parse", "--is-inside-work-tree"], "plugin source must be a Git worktree");
  const status = runGit(root, ["status", "--porcelain"], "failed to inspect plugin source status");
  if (status.trim() !== "") throw new Error("dirty local plugin source rejected: commit or clean uncommitted changes first");
  const commit = runGit(root, ["rev-parse", "HEAD"], "plugin source must have HEAD");
  return { root, commit, materialized: false };
}

function checkedOutSourceRoot(root, source) {
  const location = sourceLocation(source);
  if (!isGitUrl(location)) return path.resolve(root, location);
  return path.join(pluginSourcesDir(root), source.id);
}

function syncGitUrlSource(root, source) {
  const dest = checkedOutSourceRoot(root, source);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(path.join(dest, ".git"))) {
    const result = runCmd("git", ["clone", sourceLocation(source), dest], { maxBuffer: 10 * 1024 * 1024 });
    if (!result.ok) throw new Error(`failed to clone ${maskPluginSource(sourceLocation(source))}: ${maskPluginSource(result.stderr || result.stdout)}`);
  } else {
    const result = runCmd("git", ["fetch", "--all", "--tags"], { cwd: dest, maxBuffer: 10 * 1024 * 1024 });
    if (!result.ok) throw new Error(`failed to update ${maskPluginSource(sourceLocation(source))}: ${maskPluginSource(result.stderr || result.stdout)}`);
  }
  if (source.ref) runGit(dest, ["checkout", source.ref], "failed to checkout plugin ref");
  const commit = runGit(dest, ["rev-parse", "HEAD"], "plugin source must have HEAD");
  return { root: dest, commit, materialized: false };
}

function resolveSource(root, source) {
  if (source.type === "npm") throw new Error(`unsupported plugin source type: npm (${source.id})`);
  const location = sourceLocation(source);
  return isGitUrl(location) ? syncGitUrlSource(root, source) : localRepoHead(path.resolve(root, location));
}

function nextSourceId(config, source) {
  const base = path.basename(String(source).replace(/\.git$/, "")) || "plugin-source";
  const safeBase = base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "plugin-source";
  const existing = new Set(config.plugin.sources.map((entry) => entry.id));
  let id = safeBase;
  let n = 2;
  while (existing.has(id)) id = `${safeBase}-${n++}`;
  return id;
}

export function addPluginRepo(root, source, ref) {
  const config = readProjectConfig(root);
  const id = nextSourceId(config, source);
  const entry = isGitUrl(source) ? { id, type: "git", url: source } : { id, type: "local", path: source };
  if (ref) entry.ref = ref;
  const resolved = resolveSource(root, entry);
  readJson(path.join(resolved.root, "plugin.json"));
  config.plugin.sources.push(entry);
  writeProjectConfig(root, config);
  return { id, source: maskPluginSource(source), commit: resolved.commit };
}

export function updatePluginRepos(root) {
  const config = readProjectConfig(root);
  const results = [];
  for (const source of config.plugin.sources) {
    const resolved = resolveSource(root, source);
    results.push({ id: source.id, source: maskPluginSource(sourceLocation(source)), commit: resolved.commit });
  }
  return results;
}

export function findPluginCandidates(root) {
  const config = readProjectConfig(root);
  const results = [];
  for (const source of config.plugin.sources) {
    const resolved = resolveSource(root, source);
    const manifest = PluginManifest.fromRoot(resolved.root);
    results.push({ id: manifest.name, type: manifest.type, source: source.id, sourceLocation: maskPluginSource(sourceLocation(source)), commit: resolved.commit });
  }
  return results;
}

function materializeCommit(sourceRoot, commit, root) {
  const tmp = fs.mkdtempSync(path.join(sentiDir(root), "tmp-plugin-"));
  const archivePath = path.join(tmp, "package.tar");
  const archive = runCmd("git", ["archive", "--format=tar", "-o", archivePath, commit], { cwd: sourceRoot, maxBuffer: 50 * 1024 * 1024 });
  if (!archive.ok) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`failed to archive plugin package: ${archive.stderr || archive.stdout}`);
  }
  const packageRoot = path.join(tmp, "package");
  fs.mkdirSync(packageRoot, { recursive: true });
  const tar = runCmd("tar", ["-xf", archivePath, "-C", packageRoot], { maxBuffer: 50 * 1024 * 1024 });
  if (!tar.ok) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`failed to extract plugin package: ${tar.stderr || tar.stdout}`);
  }
  return { tmp, packageRoot };
}

function hashPackageTree(sourceRoot) {
  const hash = crypto.createHash("sha1");
  for (const entry of existingKnownPluginPaths(sourceRoot).sort()) {
    for (const file of walkFiles(sourceRoot, normalizeRel(entry, "files entry")).sort()) {
      hash.update(file);
      hash.update("\0");
      hash.update(fs.readFileSync(path.join(sourceRoot, file)));
      hash.update("\0");
    }
  }
  return hash.digest("hex");
}

function existingKnownPluginPaths(sourceRoot) {
  return KNOWN_PLUGIN_PACKAGE_PATHS.filter((entry) => fs.existsSync(path.join(sourceRoot, entry.replace(/\/$/, ""))));
}

function copyAllowlistedFiles(sourceRoot, destRoot, files) {
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });
  let copied = 0;
  for (const entry of files) {
    const rel = normalizeRel(entry, "files entry");
    const src = path.join(sourceRoot, rel);
    if (!fs.existsSync(src)) throw new Error(`unsafe files entry missing: ${rel}`);
    for (const file of walkFiles(sourceRoot, rel)) {
      copied += 1;
      if (copied > MAX_PLUGIN_COPY_FILES) throw new Error(`unsafe package: copied file count exceeds ${MAX_PLUGIN_COPY_FILES}`);
      const dest = path.join(destRoot, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, file), dest);
    }
  }
}

function validateSourceTree(sourceRoot) {
  validatePackageJson(sourceRoot);
  for (const entry of existingKnownPluginPaths(sourceRoot)) walkFiles(sourceRoot, normalizeRel(entry, "files entry"));
}

function installFromSource(root, source, sourceRoot, commit, { updateExisting = false, sourceMaterialized = false } = {}) {
  validateSourceTree(sourceRoot);
  const materialized = sourceMaterialized ? null : materializeCommit(sourceRoot, commit, root);
  const packageRoot = materialized?.packageRoot || sourceRoot;
  const manifest = PluginManifest.fromRoot(packageRoot);
  validateSourceTree(packageRoot);
  const dest = path.join(installedPluginsDir(root), manifest.name);
  copyAllowlistedFiles(packageRoot, dest, existingKnownPluginPaths(packageRoot));
  if (materialized) fs.rmSync(materialized.tmp, { recursive: true, force: true });
  const installedManifest = PluginManifest.fromRoot(dest, manifest.name);
  const config = readStoredProjectConfig(root);
  const plugin = ensurePluginConfig(config);
  const publicSources = new Set(plugin.sources.map((entry) => entry.id));
  const existing = plugin.packages.find((pkg) => pkg.id === manifest.name);
  const entry = { id: manifest.name, source: source.id, commit };
  if (source.ref) entry.ref = source.ref;
  if (existing) {
    if (!updateExisting && existing.enabled === false) entry.enabled = false;
    Object.assign(existing, entry);
  } else if (publicSources.has(source.id)) {
    plugin.packages.push(entry);
  } else {
    return installedManifest;
  }
  writeProjectConfig(root, config);
  return installedManifest;
}

export function installPlugin(root, id) {
  const config = readProjectConfig(root);
  for (const source of config.plugin.sources) {
    const resolved = resolveSource(root, source);
    const manifest = PluginManifest.fromRoot(resolved.root);
    if (manifest.name === id) {
      installFromSource(root, source, resolved.root, resolved.commit, { sourceMaterialized: resolved.materialized });
      return { id, source: source.id, commit: resolved.commit };
    }
  }
  throw new Error(`plugin not found: ${id}`);
}

export function syncInstalledPlugins(root, { update = false } = {}) {
  const config = readProjectConfig(root);
  const sources = new Map(config.plugin.sources.map((source) => [source.id, source]));
  const results = [];
  for (const pkg of config.plugin.packages) {
    if (pkg.enabled === false) continue;
    const source = sources.get(pkg.source);
    if (!source) throw new Error(`plugin source not found for package ${pkg.id}: ${pkg.source}`);
    const resolved = update || source.type === "local"
      ? resolveSource(root, source)
      : { root: checkedOutSourceRoot(root, source), commit: pkg.commit, materialized: false };
    if (!fs.existsSync(path.join(resolved.root, "plugin.json"))) Object.assign(resolved, resolveSource(root, source));
    const commit = update ? resolved.commit : pkg.commit;
    if (!SHA_RE.test(commit)) throw new Error(`plugin package ${pkg.id} must have a pinned commit`);
    installFromSource(root, source, resolved.root, commit, { updateExisting: update, sourceMaterialized: resolved.materialized });
    results.push({ id: pkg.id, source: source.id, commit });
  }
  return results;
}

export function listInstalledPlugins(root) {
  const config = readProjectConfig(root);
  const registry = loadPluginRegistry(root);
  return config.plugin.packages.map((pkg) => ({
    id: pkg.id,
    source: pkg.source,
    commit: pkg.commit,
    status: pkg.enabled === false ? "disabled" : "enabled",
    valid: Boolean(registry.manifests.find((manifest) => manifest.providerId === pkg.id)),
  }));
}

export function setPluginEnabled(root, id, enabled) {
  const config = readStoredProjectConfig(root);
  const entry = config.plugin.packages.find((pkg) => pkg.id === id);
  if (!entry) {
    const merged = readProjectConfig(root);
    if (merged.plugin.packages.find((pkg) => pkg.id === id)) {
      throw new Error(`plugin package ${id} is provided by .senti/config.local.json; edit the local overlay to enable or disable it`);
    }
    throw new Error(`plugin not installed: ${id}`);
  }
  if (enabled) delete entry.enabled;
  else entry.enabled = false;
  writeProjectConfig(root, config);
  return entry;
}

export async function resolvePluginPackageSources(root = repoRoot()) {
  const config = readProjectConfig(root);
  const sources = new Map(config.plugin.sources.map((source) => [source.id, source]));
  return config.plugin.packages.map((pkg) => {
    const source = sources.get(pkg.source);
    if (!source) throw new Error(`plugin package ${pkg.id} references unknown source ${pkg.source}`);
    return { ...pkg, source, sourceLocation: sourceLocation(source) };
  });
}

export class FlowCommandHook {}

function buildPluginApi() {
  return {
    Envelope: {
      ok: (type = "plugin", key = "plugin", data = {}) => Envelope.ok(type, key, data).toJSON(),
      fail: (type = "plugin", key = "plugin", code = "PLUGIN_FAILED", messages = "plugin failed", data = null) => Envelope.fail(type, key, code, messages, data).toJSON(),
    },
    FlowCommandHook,
  };
}

function validateHookClass(HookClass, label) {
  if (typeof HookClass !== "function" || !HookClass.name) throw new Error(`plugin hook ${label} must return a named hook class`);
  if (!(HookClass.prototype instanceof FlowCommandHook)) throw new Error(`plugin hook ${label} must extend FlowCommandHook`);
  if (!FLOW_COMMANDS.has(HookClass.command)) throw new Error(`plugin hook ${label} has unknown command: ${HookClass.command}`);
  if (!FLOW_COMMAND_HOOKS.has(HookClass.hook)) throw new Error(`plugin hook ${label} has unknown hook: ${HookClass.hook}`);
  if (HookClass.command === "prepare" && HookClass.hook === "pre") throw new Error("plugin hook prepare.pre is not supported");
  if (!Number.isInteger(Number(HookClass.priority || 0))) throw new Error(`plugin hook ${label} priority must be an integer`);
}

export async function discoverFlowCommandHooks(root = repoRoot()) {
  const config = readProjectConfig(root);
  const enabledPackages = config.plugin.packages.filter((pkg) => pkg.enabled !== false);
  if (enabledPackages.length > MAX_ENABLED_PLUGIN_PACKAGES) throw new Error(`enabled plugin packages exceed ${MAX_ENABLED_PLUGIN_PACKAGES}`);
  const plans = [];
  for (const pkg of enabledPackages) {
    const pluginRoot = path.join(sentiDir(root), "plugins", pkg.id);
    const hooksDir = path.join(pluginRoot, "hooks");
    if (!fs.existsSync(hooksDir)) continue;
    const files = fs.readdirSync(hooksDir).filter((file) => file.endsWith(".js")).sort();
    if (files.length > MAX_PLUGIN_HOOK_FILES) throw new Error(`plugin ${pkg.id} hook files exceed ${MAX_PLUGIN_HOOK_FILES}`);
    for (const file of files) {
      const rel = normalizeRel(`hooks/${file}`, "hook module");
      assertNoCoreInternalImports(root, pkg.id, pluginRoot, rel);
      const mod = await import(pathToFileURL(path.join(pluginRoot, rel)).href);
      if (typeof mod.default !== "function" || mod.default.name !== "register") throw new Error(`plugin hook ${pkg.id}/${rel} must export named default function register(api)`);
      const HookClass = mod.default(buildPluginApi());
      if (Array.isArray(HookClass)) throw new Error(`plugin hook ${pkg.id}/${rel} must return one hook class per file`);
      validateHookClass(HookClass, `${pkg.id}/${rel}`);
      plans.push({
        apiVersion: 1,
        pluginId: pkg.id,
        module: rel,
        className: HookClass.name,
        command: HookClass.command,
        hook: HookClass.hook,
        priority: Number(HookClass.priority || 0),
      });
    }
  }
  return plans.sort((a, b) => a.priority - b.priority || a.pluginId.localeCompare(b.pluginId) || a.module.localeCompare(b.module));
}

export function writeFlowCommandHookSnapshot(flowPath, plans) {
  const state = readJson(flowPath);
  state.plugins = state.plugins && typeof state.plugins === "object" ? state.plugins : {};
  state.plugins.flowCommandHooks = plans.map((plan) => ({ ...plan }));
  writeJson(flowPath, state);
}

export function loadFlowCommandHookSnapshot(flowPath) {
  const state = readJson(flowPath);
  return Array.isArray(state.plugins?.flowCommandHooks) ? state.plugins.flowCommandHooks : [];
}

function pluginConfigFor(root, pluginId) {
  try {
    return readProjectConfig(root).plugin.config?.[pluginId] || {};
  } catch (_) {
    return {};
  }
}

function artifactRoot(root, pluginId, flow = {}, { requireSpec = false } = {}) {
  if (flow?.spec) {
    const specPath = normalizeRel(flow.spec, "flow spec path");
    return path.join(root, path.dirname(specPath), "plugin-artifacts", pluginId);
  }
  if (requireSpec) {
    throw new Error(`plugin hook artifact context requires flow.spec for ${pluginId}`);
  }
  return path.join(sentiDir(root), "plugin-artifacts", pluginId);
}

function artifactHelpers(root, pluginId, flow = {}, options = {}) {
  const dir = artifactRoot(root, pluginId, flow, options);
  return {
    async readJson(rel, fallback = null) {
      const file = path.join(dir, normalizeRel(rel, "artifact path"));
      if (!fs.existsSync(file)) return fallback;
      return readJson(file);
    },
    async writeJson(rel, value) {
      writeJson(path.join(dir, normalizeRel(rel, "artifact path")), value);
    },
    async writeText(rel, value) {
      const file = path.join(dir, normalizeRel(rel, "artifact path"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, String(value), "utf8");
    },
  };
}

function buildPluginContext({ root, pluginId, pluginRoot, commandPath, flow = {}, result = {}, requireSpecArtifacts = false }) {
  const rootConfig = readProjectConfig(root);
  const pluginConfig = pluginConfigFor(root, pluginId);
  const agent = globalThis.__sentiPluginAgent || {
    resolve() {
      return false;
    },
    async call() {
      throw new Error("plugin agent context is not configured for this invocation");
    },
  };
  return {
    project: { root },
    plugin: { id: pluginId, root: pluginRoot, commandPath },
    config: pluginConfig,
    rootConfig: { lang: rootConfig.lang || "en" },
    agent,
    flow,
    result,
    artifacts: artifactHelpers(root, pluginId, flow, { requireSpec: requireSpecArtifacts }),
    envelope: buildPluginApi().Envelope,
  };
}

function isEnvelopeLike(value) {
  return value && typeof value === "object" && typeof value.ok === "boolean" && Array.isArray(value.errors);
}

export async function dispatchPluginCommand(root, commandName, args) {
  const registry = loadPluginRegistry(root);
  const command = registry.resolveCommand(commandName);
  if (!command) return false;
  try {
    const mod = await import(pathToFileURL(command.absolutePath).href);
    if (typeof mod.default !== "function") throw new Error(`plugin command ${commandName} must export default register(api)`);
    const registered = mod.default(buildPluginApi());
    if (!registered || typeof registered.main !== "function") throw new Error(`plugin command ${commandName} register(api) must return { main }`);
    const pluginRoot = path.dirname(path.dirname(command.absolutePath));
    const result = await registered.main(args, buildPluginContext({ root, pluginId: command.providerId, pluginRoot, commandPath: command.absolutePath }));
    if (!isEnvelopeLike(result)) throw new Error(`plugin command ${commandName} must return an Envelope-compatible object`);
    return { ...result, exitCode: result.ok ? 0 : (result.exitCode || 1) };
  } catch (err) {
    return { ok: false, type: "plugin", key: commandName, data: null, exitCode: 1, errors: [{ level: "fatal", code: err.code || "PLUGIN_COMMAND_FAILED", messages: [err.message] }] };
  }
}

function snapshotPluginRoot(root, plan) {
  const config = readProjectConfig(root);
  const pkg = config.plugin.packages.find((entry) => entry.id === plan.pluginId);
  if (!pkg) throw new Error(`snapshot plugin missing: ${plan.pluginId}; restore the plugin package or re-prepare the flow`);
  if (pkg.enabled === false) throw new Error(`snapshot plugin disabled: ${plan.pluginId}; re-enable the plugin package or re-prepare the flow`);
  const pluginRoot = path.join(sentiDir(root), "plugins", plan.pluginId);
  if (!fs.existsSync(pluginRoot)) throw new Error(`snapshot plugin removed: ${plan.pluginId}; restore the plugin package or re-prepare the flow`);
  return pluginRoot;
}

function assertSnapshotMetadata(plan, HookClass) {
  const comparisons = [
    ["className", plan.className, HookClass.name],
    ["command", plan.command, HookClass.command],
    ["hook", plan.hook, HookClass.hook],
    ["priority", Number(plan.priority || 0), Number(HookClass.priority || 0)],
  ];
  for (const [field, expected, actual] of comparisons) {
    if (expected !== actual) {
      throw new Error(`plugin hook metadata mismatch for ${plan.pluginId}/${plan.module}: expected ${field} ${expected}, got ${actual}`);
    }
  }
}

async function loadHookClass(root, plan) {
  const pluginRoot = snapshotPluginRoot(root, plan);
  const rel = normalizeRel(plan.module, "hook module");
  const modulePath = path.join(pluginRoot, rel);
  if (!fs.existsSync(modulePath)) {
    throw new Error(`snapshot hook module missing: ${plan.pluginId}/${rel}; restore the module or re-prepare the flow`);
  }
  assertNoCoreInternalImports(root, plan.pluginId, pluginRoot, rel);
  const mod = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
  if (typeof mod.default !== "function" || mod.default.name !== "register") {
    throw new Error(`plugin hook ${plan.pluginId}/${rel} must export named default function register(api)`);
  }
  const HookClass = mod.default(buildPluginApi());
  validateHookClass(HookClass, `${plan.pluginId}/${plan.module}`);
  assertSnapshotMetadata({ ...plan, module: rel }, HookClass);
  return { HookClass, pluginRoot };
}

export async function runFlowCommandHooks(root, snapshot, { command, hook, flow = {}, result = {} } = {}) {
  const warnings = [];
  const issueLogEntries = [];
  const hookData = [];
  const followUps = [];
  for (const plan of snapshot.filter((entry) => entry.command === command && entry.hook === hook).sort((a, b) => a.priority - b.priority)) {
    const { HookClass, pluginRoot } = await loadHookClass(root, plan);
    const context = buildPluginContext({ root, pluginId: plan.pluginId, pluginRoot, flow, result, requireSpecArtifacts: true });
    try {
      const instance = new HookClass();
      const hookResult = await instance.run(context);
      if (hookResult?.ok === false) throw new Error(hookResult.errors?.[0]?.messages?.join(" ") || "plugin hook returned ok:false");
      if (hookResult?.data) {
        hookData.push({ pluginId: plan.pluginId, command, hook, data: hookResult.data });
        if (Array.isArray(hookResult.data.warnings)) {
          warnings.push(...hookResult.data.warnings.map((warning) => ({ pluginId: plan.pluginId, command, hook, ...warning })));
        }
        if (Array.isArray(hookResult.data.followUps)) {
          followUps.push(...hookResult.data.followUps.map((text) => ({ pluginId: plan.pluginId, command, hook, text })));
        }
      }
    } catch (err) {
      const warning = { code: "PLUGIN_HOOK_FAILED", pluginId: plan.pluginId, command, hook, message: err.message };
      warnings.push(warning);
      issueLogEntries.push({ pluginId: plan.pluginId, reason: `plugin hook ${command}.${hook} failed: ${err.message}`, payload: warning });
    }
  }
  return { ok: true, warnings, issueLogEntries, hookData, followUps };
}

export async function runFlowCommandWithPluginLifecycle(root, snapshot, { command, main, flow = {} } = {}) {
  const pre = await runFlowCommandHooks(root, snapshot, { command, hook: "pre", flow, result: {} });
  const result = await main();
  const post = await runFlowCommandHooks(root, snapshot, { command, hook: "post", flow, result });
  return {
    ok: result?.ok !== false,
    data: {
      ...(result?.data || {}),
      pluginHooks: [...pre.hookData, ...post.hookData],
      followUps: [...pre.followUps, ...post.followUps],
    },
    warnings: [...pre.warnings, ...post.warnings],
    issueLogEntries: [...pre.issueLogEntries, ...post.issueLogEntries],
  };
}

export function ensureOfficialPackage(root, { id, sourceRoot, ref }) {
  const config = readProjectConfig(root);
  const plugin = ensurePluginConfig(config);
  let source = plugin.sources.find((entry) => sourceLocation(entry) === sourceRoot || entry.id === id || entry.id === `official-${id}`);
  if (!source) {
    source = { id: `official-${id}`, type: "local", path: sourceRoot };
    if (ref) source.ref = ref;
    plugin.sources.push(source);
  }
  writeProjectConfig(root, config);
  const resolved = resolveSource(root, source);
  const sourceManifest = PluginManifest.fromRoot(resolved.root);
  if (sourceManifest.name !== id) throw new Error(`official package mismatch: expected ${id}, got ${sourceManifest.name}`);
  const existing = plugin.packages.find((pkg) => pkg.id === id);
  if (!existing || existing.commit !== resolved.commit) {
    installFromSource(root, source, resolved.root, resolved.commit, { updateExisting: true, sourceMaterialized: resolved.materialized });
  }
}

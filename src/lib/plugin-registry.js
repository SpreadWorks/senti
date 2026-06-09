import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { PKG_DIR, repoRoot } from "./cli.js";
import { sentiConfigPath, sentiDir } from "./config.js";
import { runCmd, assertOk } from "./process.js";

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const CORE_COMMANDS = new Set([
  "docs",
  "flow",
  "check",
  "metrics",
  "spec",
  "hook",
  "setup",
  "upgrade",
  "presets",
  "plugin",
  "help",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function ensurePluginConfig(config) {
  if (!config.plugin || typeof config.plugin !== "object") config.plugin = {};
  if (!Array.isArray(config.plugin.repos)) config.plugin.repos = [];
  if (!Array.isArray(config.plugin.packages)) config.plugin.packages = [];
  return config.plugin;
}

export function readProjectConfig(root = repoRoot()) {
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

function normalizeRel(rel, label = "path") {
  if (typeof rel !== "string" || rel.trim() === "") {
    throw new Error(`unsafe ${label}: must be a non-empty string`);
  }
  const value = rel.replace(/\\/g, "/");
  if (path.isAbsolute(value) || value === "." || value === ".." || value.startsWith("../") || value.includes("/../") || value.endsWith("/..")) {
    throw new Error(`unsafe ${label}: parent traversal or absolute path is not allowed`);
  }
  if (value.split("/").includes(".git")) {
    throw new Error(`unsafe ${label}: .git content is not allowed`);
  }
  return value;
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
      if (childRel.split("/").includes(".git")) throw new Error("unsafe package: .git content is not allowed");
      out.push(...walkFiles(root, childRel));
    }
    return out;
  }
  if (!stat.isFile()) return [];
  return [rel];
}

function validatePackageJson(root) {
  const packagePath = path.join(root, "package.json");
  if (!fs.existsSync(packagePath)) return;
  const pkg = readJson(packagePath);
  for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    if (pkg[key] && Object.keys(pkg[key]).length > 0) throw new Error(`unsafe package.json: ${key} are not allowed`);
  }
  if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
    throw new Error("unsafe package.json: scripts are not allowed");
  }
}

export class PluginManifest {
  constructor(root, raw, providerId = raw?.name) {
    this.root = root;
    this.providerId = providerId;
    this.name = raw?.name;
    this.type = raw?.type || "mixed";
    this.files = raw?.files || [];
    this.contributions = raw?.contributions || {};
    this.raw = raw;
    this.validate();
  }

  validate() {
    assertId(this.name, "plugin name");
    if (!Array.isArray(this.files) || this.files.length === 0) {
      throw new Error("unsafe plugin.json: files must be a non-empty array");
    }
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
      if (typeof dataSource.name !== "string" || !dataSource.name.includes("/")) {
        throw new Error(`invalid dataSource name: ${dataSource.name}`);
      }
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
      entries.push({
        ...entry,
        presetKey,
        sourceName,
        providerId: this.providerId,
        absolutePath: path.join(this.root, entry.path),
      });
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

function pluginReposDir(root) {
  return path.join(sentiDir(root), "plugin-repos");
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
  if (!fs.existsSync(root)) throw new Error(`plugin repo not found: ${source}`);
  runGit(root, ["rev-parse", "--is-inside-work-tree"], "plugin source must be a Git worktree");
  const status = runGit(root, ["status", "--porcelain"], "failed to inspect plugin source status");
  if (status.trim() !== "") throw new Error("dirty local plugin source rejected: commit or clean uncommitted changes first");
  const commit = runGit(root, ["rev-parse", "HEAD"], "plugin source must have HEAD");
  return { root, commit };
}

function checkedOutRepoRoot(root, repo) {
  if (!isGitUrl(repo.source)) return path.resolve(root, repo.source);
  return path.join(pluginReposDir(root), repo.id);
}

function syncGitUrlRepo(root, repo) {
  const dest = checkedOutRepoRoot(root, repo);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(path.join(dest, ".git"))) {
    const result = runCmd("git", ["clone", repo.source, dest], { maxBuffer: 10 * 1024 * 1024 });
    if (!result.ok) throw new Error(`failed to clone ${maskPluginSource(repo.source)}: ${maskPluginSource(result.stderr || result.stdout)}`);
  } else {
    const result = runCmd("git", ["fetch", "--all", "--tags"], { cwd: dest, maxBuffer: 10 * 1024 * 1024 });
    if (!result.ok) throw new Error(`failed to update ${maskPluginSource(repo.source)}: ${maskPluginSource(result.stderr || result.stdout)}`);
  }
  if (repo.ref) runGit(dest, ["checkout", repo.ref], "failed to checkout plugin ref");
  const commit = runGit(dest, ["rev-parse", "HEAD"], "plugin source must have HEAD");
  return { root: dest, commit };
}

function resolveRepo(root, repo) {
  return isGitUrl(repo.source) ? syncGitUrlRepo(root, repo) : localRepoHead(path.resolve(root, repo.source));
}

function packageEntriesFromRepo(root, repo) {
  const source = resolveRepo(root, repo);
  const manifest = PluginManifest.fromRoot(source.root);
  return [{ repo, sourceRoot: source.root, commit: source.commit, manifest }];
}

function nextRepoId(config, source) {
  const base = path.basename(String(source).replace(/\.git$/, "")) || "plugin-repo";
  const safeBase = base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "plugin-repo";
  const existing = new Set(config.plugin.repos.map((repo) => repo.id));
  let id = safeBase;
  let n = 2;
  while (existing.has(id)) id = `${safeBase}-${n++}`;
  return id;
}

export function addPluginRepo(root, source, ref) {
  const config = readProjectConfig(root);
  const id = nextRepoId(config, source);
  const repo = { id, source };
  if (ref) repo.ref = ref;
  const resolved = isGitUrl(source) ? syncGitUrlRepo(root, repo) : localRepoHead(path.resolve(root, source));
  readJson(path.join(resolved.root, "plugin.json"));
  config.plugin.repos.push(repo);
  writeProjectConfig(root, config);
  return { id, source: maskPluginSource(source), commit: resolved.commit };
}

export function updatePluginRepos(root) {
  const config = readProjectConfig(root);
  const results = [];
  for (const repo of config.plugin.repos) {
    const source = resolveRepo(root, repo);
    results.push({ id: repo.id, source: maskPluginSource(repo.source), commit: source.commit });
  }
  return results;
}

export function findPluginCandidates(root) {
  const config = readProjectConfig(root);
  const results = [];
  for (const repo of config.plugin.repos) {
    for (const candidate of packageEntriesFromRepo(root, repo)) {
      results.push({
        id: candidate.manifest.name,
        type: candidate.manifest.type,
        repo: repo.id,
        source: maskPluginSource(repo.source),
        commit: candidate.commit,
      });
    }
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

function copyAllowlistedFiles(sourceRoot, destRoot, files) {
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });
  for (const entry of files) {
    const rel = normalizeRel(entry, "files entry");
    const src = path.join(sourceRoot, rel);
    if (!fs.existsSync(src)) throw new Error(`unsafe files entry missing: ${rel}`);
    for (const file of walkFiles(sourceRoot, rel)) {
      const dest = path.join(destRoot, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, file), dest);
    }
  }
}

function validateSourceTree(sourceRoot, manifest) {
  validatePackageJson(sourceRoot);
  for (const entry of manifest.files) {
    walkFiles(sourceRoot, normalizeRel(entry, "files entry"));
  }
}

function installFromSource(root, repo, sourceRoot, commit, { updateExisting = false } = {}) {
  const materialized = materializeCommit(sourceRoot, commit, root);
  const packageRoot = materialized.packageRoot;
  const manifest = PluginManifest.fromRoot(packageRoot);
  validateSourceTree(packageRoot, manifest);
  const dest = path.join(installedPluginsDir(root), manifest.name);
  copyAllowlistedFiles(packageRoot, dest, manifest.files);
  fs.rmSync(materialized.tmp, { recursive: true, force: true });
  const installedManifest = PluginManifest.fromRoot(dest, manifest.name);
  const config = readProjectConfig(root);
  const plugin = ensurePluginConfig(config);
  const existing = plugin.packages.find((pkg) => pkg.id === manifest.name);
  const entry = {
    id: manifest.name,
    repo: repo.id,
    commit,
  };
  if (repo.ref) entry.ref = repo.ref;
  if (existing) {
    if (!updateExisting && existing.enabled === false) entry.enabled = false;
    Object.assign(existing, entry);
  } else {
    plugin.packages.push(entry);
  }
  writeProjectConfig(root, config);
  return installedManifest;
}

export function installPlugin(root, id) {
  const config = readProjectConfig(root);
  for (const repo of config.plugin.repos) {
    const source = resolveRepo(root, repo);
    const manifest = PluginManifest.fromRoot(source.root);
    if (manifest.name === id) {
      installFromSource(root, repo, source.root, source.commit);
      return { id, repo: repo.id, commit: source.commit };
    }
  }
  throw new Error(`plugin not found: ${id}`);
}

export function syncInstalledPlugins(root, { update = false } = {}) {
  const config = readProjectConfig(root);
  const repos = new Map(config.plugin.repos.map((repo) => [repo.id, repo]));
  const results = [];
  for (const pkg of config.plugin.packages) {
    if (pkg.enabled === false) continue;
    const repo = repos.get(pkg.repo);
    if (!repo) throw new Error(`plugin repo not found for package ${pkg.id}: ${pkg.repo}`);
    const source = update ? resolveRepo(root, repo) : { root: checkedOutRepoRoot(root, repo), commit: pkg.commit };
    if (!fs.existsSync(path.join(source.root, "plugin.json"))) {
      const resolved = resolveRepo(root, repo);
      source.root = resolved.root;
    }
    const commit = update ? source.commit : pkg.commit;
    if (!SHA_RE.test(commit)) throw new Error(`plugin package ${pkg.id} must have a pinned commit`);
    installFromSource(root, repo, source.root, commit, { updateExisting: update });
    results.push({ id: pkg.id, repo: repo.id, commit });
  }
  return results;
}

export function listInstalledPlugins(root) {
  const config = readProjectConfig(root);
  const registry = loadPluginRegistry(root);
  return config.plugin.packages.map((pkg) => ({
    id: pkg.id,
    repo: pkg.repo,
    commit: pkg.commit,
    status: pkg.enabled === false ? "disabled" : "enabled",
    valid: Boolean(registry.manifests.find((manifest) => manifest.providerId === pkg.id)),
  }));
}

export function setPluginEnabled(root, id, enabled) {
  const config = readProjectConfig(root);
  const entry = config.plugin.packages.find((pkg) => pkg.id === id);
  if (!entry) throw new Error(`plugin not installed: ${id}`);
  if (enabled) delete entry.enabled;
  else entry.enabled = false;
  writeProjectConfig(root, config);
  return entry;
}

export async function dispatchPluginCommand(root, commandName, args) {
  const registry = loadPluginRegistry(root);
  const command = registry.resolveCommand(commandName);
  if (!command) return false;
  process.argv = [process.argv[0], command.absolutePath, ...args];
  const mod = await import(pathToFileURL(command.absolutePath).href);
  if (typeof mod.main === "function") {
    await mod.main(args, {
      projectRoot: root,
      sourceRoot: process.env.SENTI_SOURCE_ROOT || PKG_DIR,
      packageRoot: PKG_DIR,
      commandPath: command.absolutePath,
    });
  }
  return true;
}

export function ensureOfficialPackage(root, { id, sourceRoot, ref, type }) {
  const config = readProjectConfig(root);
  const plugin = ensurePluginConfig(config);
  let repo = plugin.repos.find((entry) => entry.source === sourceRoot || entry.id === id || entry.id === `official-${id}`);
  if (!repo) {
    repo = { id: type === "workflow" ? "official-workflow" : "official-presets", source: sourceRoot };
    if (ref) repo.ref = ref;
    plugin.repos.push(repo);
  }
  if (!plugin.packages.some((pkg) => pkg.id === id)) {
    writeProjectConfig(root, config);
    const source = resolveRepo(root, repo);
    const sourceManifest = PluginManifest.fromRoot(source.root);
    if (sourceManifest.name !== id) throw new Error(`official package mismatch: expected ${id}, got ${sourceManifest.name}`);
    installFromSource(root, repo, source.root, source.commit);
    return;
  }
  writeProjectConfig(root, config);
}

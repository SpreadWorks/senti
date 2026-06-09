/**
 * senti/lib/presets.js
 *
 * Auto-discovers presets from src/presets/{key}/preset.json.
 * All consumers derive their preset data from this single source.
 *
 * Preset hierarchy uses `parent` field for single-inheritance chains.
 * Multiple presets can be combined via type arrays in config.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createLogger } from "./progress.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger("presets");
export const PRESETS_DIR = path.resolve(__dirname, "..", "presets");

/**
 * Discover all presets by scanning src/presets/{key}/preset.json.
 * Each preset gets: { key, dir, parent, label, aliases, scan, chapters }.
 */
function discoverPresets() {
  if (!fs.existsSync(PRESETS_DIR)) return [];

  return fs.readdirSync(PRESETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifestPath = path.join(PRESETS_DIR, d.name, "preset.json");
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      return {
        key: d.name,
        dir: path.join(PRESETS_DIR, d.name),
        parent: manifest.parent || null,
        label: manifest.label,
        aliases: manifest.aliases || [],
        scan: manifest.scan || {},
        chapters: manifest.chapters || [],
      };
    })
    .filter(Boolean);
}

export const PRESETS = discoverPresets();

/**
 * Build a project-local preset object from .senti/presets/<key>/.
 * Returns null if the directory does not exist.
 *
 * When preset.json is absent:
 * - If a built-in preset with the same key exists, inherit its settings (parent, scan,
 *   chapters) but use the project dir for DataSource loading.
 * - Otherwise, return a bare preset (no parent).
 *
 * @param {string} key
 * @param {string} root - project root (parent of .senti/)
 * @returns {Object|null}
 */
function resolveProjectPreset(key, root) {
  const projectDir = path.join(root, ".senti", "presets", key);
  if (!fs.existsSync(projectDir)) return null;

  const manifestPath = path.join(projectDir, "preset.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return {
      key,
      dir: projectDir,
      parent: manifest.parent || null,
      label: manifest.label || key,
      aliases: manifest.aliases || [],
      scan: manifest.scan || {},
      chapters: manifest.chapters || [],
    };
  }

  // preset.json omitted — inherit built-in settings if available
  const builtin = PRESETS.find((p) => p.key === key);
  if (builtin) {
    return { ...builtin, dir: projectDir };
  }

  // Bare preset: no parent, DataSource-only
  return { key, dir: projectDir, parent: null, label: key, aliases: [], scan: {}, chapters: [] };
}

/**
 * Resolve the full parent chain for a preset, from root (base) to the given leaf.
 *
 * When `projectRoot` is provided, `.senti/presets/<leafKey>/` is checked first.
 * If found, it takes precedence over the built-in preset of the same name.
 * Parent chain resolution always uses built-in presets (project presets are leaf-only).
 *
 * @param {string} leafKey - Preset key (e.g. "cakephp2", "node-cli", "webapp")
 * @param {string} [projectRoot] - Project root directory for .senti/presets/ lookup
 * @returns {Object[]} Array of preset objects, ordered root → leaf (e.g. [base, webapp, php-webapp, cakephp2])
 * @throws {Error} If preset not found or circular reference detected
 */
export function resolveChain(leafKey, projectRoot) {
  const preset = (projectRoot && resolveProjectPreset(leafKey, projectRoot))
    || PRESETS.find((p) => p.key === leafKey);
  if (!preset) {
    throw new Error(`Preset not found: ${leafKey}`);
  }

  const chain = [preset];
  const visited = new Set([leafKey]);
  let current = preset;

  while (current.parent) {
    if (visited.has(current.parent)) {
      throw new Error(`Circular parent reference detected: ${current.key} → ${current.parent}`);
    }
    const parentPreset = PRESETS.find((p) => p.key === current.parent);
    if (!parentPreset) {
      throw new Error(`Parent preset not found: ${current.parent} (referenced by ${current.key})`);
    }
    visited.add(current.parent);
    chain.unshift(parentPreset);
    current = parentPreset;
  }

  return chain;
}

/**
 * Resolve multiple type entries into independent chains.
 * Handles parent-child dedup: if both parent and child are in the list,
 * only the child's chain is kept (parent is already included).
 *
 * @param {string|string[]} types - Single preset name or array of preset names
 * @param {string} [projectRoot] - Project root directory for .senti/presets/ lookup
 * @returns {Object[][]} Array of chains, each chain is root → leaf ordered
 */
export function resolveMultiChains(types, projectRoot) {
  const typeList = Array.isArray(types) ? types : [types];

  // Deduplicate identical entries first
  const unique = [...new Set(typeList)];

  // Resolve each type into its full chain
  const chains = unique.map((t) => resolveChain(t, projectRoot));

  // Dedup: if one chain's leaf is an ancestor of another chain, keep only the longer one
  const result = [];
  for (let i = 0; i < chains.length; i++) {
    const leafKey = chains[i][chains[i].length - 1].key;
    let isSubset = false;

    for (let j = 0; j < chains.length; j++) {
      if (i === j) continue;
      if (chains[j].some((p) => p.key === leafKey) && chains[j].length > chains[i].length) {
        isSubset = true;
        break;
      }
    }

    if (!isSubset) {
      result.push(chains[i]);
    }
  }

  return result;
}

/**
 * Resolve the parent chain for a preset, with fallback for unknown presets.
 * Unlike resolveChain(), this never throws.
 *
 * @param {string} presetKey - Preset key (e.g. "cakephp2", "node-cli")
 * @param {string} [projectRoot] - Project root directory for .senti/presets/ lookup
 * @returns {Object[]} Array of preset objects, ordered root → leaf
 */
export function resolveChainSafe(presetKey, projectRoot) {
  try {
    return resolveChain(presetKey, projectRoot);
  } catch (err) {
    logger.verbose(`resolveChain failed for "${presetKey}": ${err.message}`);
    if (projectRoot) {
      const local = resolveProjectPreset(presetKey, projectRoot);
      if (local) return [local];
    }
    const preset = PRESETS.find((p) => p.key === presetKey);
    if (preset) return [preset];
    const base = PRESETS.find((p) => p.key === "base");
    return base ? [base] : [];
  }
}

/**
 * Structural template files that are not listed in `chapters` by design —
 * layout scaffolding and agent/readme sources. Excluded from reverse-direction
 * warnings in validatePresetChain().
 */
const SPECIAL_TEMPLATES = new Set(["README.md", "AGENTS.senti.md", "layout.md"]);

/**
 * Upper bounds for validatePresetChain iteration (bounded-resource-usage).
 * validatePresetChain runs once at CLI startup (upgrade / setup / docs build)
 * on a finite, user-declared set — it is not a request hot path. The
 * synchronous fs.existsSync / fs.readdirSync calls it performs are bounded by
 * (MAX_CHAPTERS × MAX_LANGUAGES × MAX_CHAIN_DEPTH) per type and rejected when
 * exceeded.
 */
const MAX_CHAPTERS_PER_PRESET = 200;
const MAX_LANGUAGES = 20;
const MAX_CHAIN_DEPTH = 16;

/**
 * Resolve the effective chapter list (file names) for a set of preset types.
 * Mirrors the priority used by template-merger.resolveChaptersOrder():
 *   configChapters (when non-empty) > union of leaf chapters across type chains.
 */
function resolveEffectiveChapters(typeList, projectRoot, configChapters) {
  if (configChapters?.length) {
    return configChapters
      .filter((c) => typeof c === "string" || !c.exclude)
      .map((c) => (typeof c === "string" ? c : c.chapter));
  }
  const seen = new Set();
  const result = [];
  for (const key of typeList) {
    const chain = resolveChainSafe(key, projectRoot);
    let chainChapters = [];
    for (const preset of chain) {
      if (preset.chapters?.length) chainChapters = preset.chapters;
    }
    for (const ch of chainChapters) {
      const name = typeof ch === "string" ? ch : ch.chapter;
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
  }
  return result;
}

/**
 * Return the list of template directories to search for the given (types, lang),
 * ordered by precedence (project-local first, then union of chain leaf → root
 * across all types) — matching template-merger.resolveTemplates(), which
 * searches across all type chains for each chapter. Validator PASS ≡ build
 * can resolve the chapter via some chain.
 */
function templateSearchDirs(typeList, projectRoot, lang) {
  const dirs = [];
  const seen = new Set();
  const push = (d) => {
    if (!seen.has(d)) {
      seen.add(d);
      dirs.push(d);
    }
  };
  if (projectRoot) {
    // init.js uses `<root>/.senti/templates/<lang>/docs` as the project-local
    // dir — mirror that path so validator PASS implies build can resolve.
    push(path.join(projectRoot, ".senti", "templates", lang, "docs"));
  }
  for (const typeKey of typeList) {
    const chain = resolveChainSafe(typeKey, projectRoot);
    if (chain.length > MAX_CHAIN_DEPTH) {
      throw new Error(`validatePresetChain: chain depth exceeds MAX_CHAIN_DEPTH (${chain.length} > ${MAX_CHAIN_DEPTH}) for type=${typeKey}`);
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      push(path.join(chain[i].dir, "templates", lang));
    }
  }
  return dirs;
}

/**
 * Validate that every chapter declared by the effective chapter list resolves
 * to a `.md` template file in the preset chain or the project-local templates
 * directory, for each configured language.
 *
 * Throws `Error` with a structured message (missing pairs + searched paths)
 * when any (chapter, language) pair cannot be resolved. Returns silently on
 * success.
 *
 * Reverse direction (template present but not in chapters) emits a warning to
 * stderr without failing — chapters may intentionally exclude a template.
 *
 * @param {string|string[]} types - Preset key(s) to validate.
 * @param {string|undefined} projectRoot - Project root for .senti/ lookups.
 * @param {object} options
 * @param {string[]} options.languages - Languages to validate (from config.docs.languages).
 * @param {Array} [options.configChapters] - Override chapters (from config.chapters).
 */
export function validatePresetChain(types, projectRoot, { languages, configChapters } = {}) {
  if (!languages?.length) return;
  if (languages.length > MAX_LANGUAGES) {
    throw new Error(`validatePresetChain: languages count exceeds MAX_LANGUAGES (${languages.length} > ${MAX_LANGUAGES})`);
  }

  const typeList = Array.isArray(types) ? types : [types];
  const effectiveChapters = resolveEffectiveChapters(typeList, projectRoot, configChapters);
  if (effectiveChapters.length > MAX_CHAPTERS_PER_PRESET) {
    throw new Error(`validatePresetChain: chapter count exceeds MAX_CHAPTERS_PER_PRESET (${effectiveChapters.length} > ${MAX_CHAPTERS_PER_PRESET})`);
  }

  // CLI startup path (not a request hot path): one-shot existsSync iteration
  // bounded by MAX_CHAPTERS × MAX_LANGUAGES × (types × MAX_CHAIN_DEPTH).
  const missing = [];
  const searchedPaths = new Set();

  for (const chapter of effectiveChapters) {
    for (const lang of languages) {
      const dirs = templateSearchDirs(typeList, projectRoot, lang);
      dirs.forEach((d) => searchedPaths.add(d));
      const found = dirs.some((d) => fs.existsSync(path.join(d, chapter)));
      if (!found) missing.push({ chapter, lang });
    }
  }

  if (missing.length > 0) {
    const lines = [
      `preset chapter-template validation failed (${missing.length} missing)`,
    ];
    for (const m of missing) {
      lines.push(`  - chapter=${m.chapter} lang=${m.lang}`);
    }
    lines.push("searched:");
    for (const p of searchedPaths) {
      lines.push(`  - ${p}`);
    }
    throw new Error(lines.join("\n"));
  }

  // Reverse direction: warn on project-local templates present but not in
  // effective chapters. Chain templates are intentionally shared and may be
  // excluded by a leaf preset's chapter override — those are not noise-worthy.
  if (!projectRoot) return;
  const effectiveSet = new Set(effectiveChapters);
  const reported = new Set();
  for (const lang of languages) {
    const dir = path.join(projectRoot, ".senti", "templates", lang, "docs");
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      if (SPECIAL_TEMPLATES.has(file)) continue;
      if (effectiveSet.has(file)) continue;
      const k = `${lang}:${file}`;
      if (reported.has(k)) continue;
      reported.add(k);
      process.stderr.write(
        `[preset] WARN: project-local template ${path.join(dir, file)} not listed in chapters (lang=${lang}).\n`,
      );
    }
  }
}

/**
 * Look up a preset by its leaf key (e.g. "cakephp2", "laravel").
 *
 * @param {string} leaf
 */
export function presetByLeaf(leaf) {
  return PRESETS.find((p) => p.key === leaf);
}

/**
 * Return presets whose parent is the given key.
 *
 * @param {string} parentKey - Parent preset key (e.g. "webapp", "cli")
 */
export function presetsForArch(parentKey) {
  return PRESETS.filter((p) => p.parent === parentKey);
}

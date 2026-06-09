/**
 * senti/lib/i18n.js
 *
 * Internationalization module.
 *
 * High-level API:
 *   import { translate } from "../lib/i18n.js";
 *   const t = translate();
 *   console.log(t("ui:setup.title"));
 *   console.log(t("ui:setup.greet", { name: "Spec-Driven Development" }));
 *
 * Low-level API (for contexts without config, e.g. setup):
 *   import { createI18n } from "../lib/i18n.js";
 *   const t = createI18n("ja", { localeDirs: [dir] });
 *   console.log(t("greeting"));
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_LANG, sentiDir, loadConfig } from "./config.js";
import { repoRoot } from "./cli.js";
import { PRESETS_DIR } from "./presets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOCALE_DIR = path.resolve(__dirname, "..", "locale");

const DOMAINS = ["ui", "messages", "prompts"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-separated key from a nested object.
 */
function getNestedValue(obj, key) {
  const parts = key.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Replace {{placeholder}} tokens in a string with values from params.
 */
function interpolate(template, params) {
  if (!params || typeof template !== "string") return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

/**
 * Deep merge two objects. Override values take precedence.
 * Arrays and primitives are replaced (not merged).
 */
export function deepMerge(base, override) {
  if (!override) return base;
  if (!base) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key]) &&
      typeof override[key] === "object" && override[key] !== null && !Array.isArray(override[key])
    ) {
      result[key] = deepMerge(result[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load a JSON message file for the given locale and domain from a single directory.
 */
function loadMessagesFromDir(lang, domain, localeDir) {
  const filePath = path.join(localeDir, lang, `${domain}.json`);
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Load and merge messages from multiple locale directories (in order, later wins).
 */
function loadMergedMessages(lang, domain, localeDirs) {
  let merged = {};
  for (const dir of localeDirs) {
    merged = deepMerge(merged, loadMessagesFromDir(lang, domain, dir));
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Low-level factory (for contexts without config)
// ---------------------------------------------------------------------------

/**
 * Create an i18n translation function for the given locale.
 * This is the low-level primitive. Prefer translate() for normal usage.
 *
 * @param {string} lang - Locale code (e.g. "ja", "en")
 * @param {Object} [options]
 * @param {string}   [options.domain="ui"]        - Message domain to load
 * @param {string[]} [options.localeDirs]          - Locale directories (merged in order)
 * @param {string}   [options.localeDir]           - Single locale directory (legacy)
 * @param {string}   [options.fallbackLang="en"]   - Fallback locale if key not found
 * @returns {function(string, Object?): string}
 */
export function createI18n(lang, options = {}) {
  const domain = options.domain || "ui";
  const fallbackLang = options.fallbackLang || DEFAULT_LANG;

  let localeDirs;
  if (options.localeDirs) {
    localeDirs = options.localeDirs;
  } else if (options.localeDir) {
    localeDirs = [options.localeDir];
  } else {
    localeDirs = [DEFAULT_LOCALE_DIR];
  }

  const messages = loadMergedMessages(lang, domain, localeDirs);
  const fallbackMessages = lang !== fallbackLang
    ? loadMergedMessages(fallbackLang, domain, localeDirs)
    : {};

  function t(key, params) {
    let value = getNestedValue(messages, key);
    if (value === undefined) {
      value = getNestedValue(fallbackMessages, key);
    }
    if (value === undefined) return key;
    return interpolate(value, params);
  }

  t.raw = function raw(key) {
    let value = getNestedValue(messages, key);
    if (value === undefined) {
      value = getNestedValue(fallbackMessages, key);
    }
    return value;
  };

  t.lang = lang;

  return t;
}

// ---------------------------------------------------------------------------
// High-level API
// ---------------------------------------------------------------------------

/**
 * Extract preset key from config type.
 * "cli/node-cli" → "node-cli", "base" → "base"
 */
function extractPresetKey(type) {
  const t = Array.isArray(type) ? type[0] : type;
  if (!t) return null;
  const idx = t.lastIndexOf("/");
  return idx >= 0 ? t.slice(idx + 1) : t;
}

/**
 * Build locale directory list for the 3-layer merge.
 */
function buildLocaleDirs(root, presetKey) {
  const dirs = [DEFAULT_LOCALE_DIR];

  if (presetKey) {
    const presetLocale = path.join(PRESETS_DIR, presetKey, "locale");
    if (fs.existsSync(presetLocale)) {
      dirs.push(presetLocale);
    }
  }

  if (root) {
    const projectLocale = path.join(sentiDir(root), "locale");
    if (fs.existsSync(projectLocale)) {
      dirs.push(projectLocale);
    }
  }

  return dirs;
}

/**
 * Parse a namespaced key "domain:dotted.key" into { domain, key }.
 * Throws if colon is missing.
 */
function parseNamespacedKey(nsKey) {
  const idx = nsKey.indexOf(":");
  if (idx < 0) {
    throw new Error(`translate: key must be "domain:key" format, got "${nsKey}"`);
  }
  return { domain: nsKey.slice(0, idx), key: nsKey.slice(idx + 1) };
}

/**
 * Create a project-aware translation function.
 * Loads all domains (ui, messages, prompts) with 3-layer merge.
 *
 * Usage:
 *   const t = translate();
 *   t("ui:setup.title")
 *   t("messages:gate.pass")
 *   t("prompts:text.role")
 *
 * @returns {function(string, Object?): string}
 */
export function translate() {
  const root = repoRoot();
  let lang, presetKey;
  try {
    const config = loadConfig(root);
    lang = config.lang || DEFAULT_LANG;
    presetKey = extractPresetKey(config.type);
  } catch (_) {
    lang = DEFAULT_LANG;
    presetKey = null;
  }

  const localeDirs = buildLocaleDirs(root, presetKey);
  const fallbackLang = DEFAULT_LANG;

  // Load all domains
  const domainMessages = {};
  const domainFallback = {};
  for (const domain of DOMAINS) {
    domainMessages[domain] = loadMergedMessages(lang, domain, localeDirs);
    if (lang !== fallbackLang) {
      domainFallback[domain] = loadMergedMessages(fallbackLang, domain, localeDirs);
    } else {
      domainFallback[domain] = {};
    }
  }

  function t(nsKey, params) {
    const { domain, key } = parseNamespacedKey(nsKey);
    const msgs = domainMessages[domain] || {};
    const fb = domainFallback[domain] || {};

    let value = getNestedValue(msgs, key);
    if (value === undefined) {
      value = getNestedValue(fb, key);
    }
    if (value === undefined) return nsKey;
    return interpolate(value, params);
  }

  t.raw = function raw(nsKey) {
    const { domain, key } = parseNamespacedKey(nsKey);
    const msgs = domainMessages[domain] || {};
    const fb = domainFallback[domain] || {};

    let value = getNestedValue(msgs, key);
    if (value === undefined) {
      value = getNestedValue(fb, key);
    }
    return value;
  };

  t.lang = lang;

  return t;
}

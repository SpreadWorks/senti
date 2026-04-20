/**
 * sdd-forge/lib/config.js
 *
 * JSON / package.json 読み込みユーティリティ + SDD 設定管理。
 */

import fs from "fs";
import path from "path";
import { ProviderRegistry } from "./provider.js";
import { validateSchema } from "./schema-validate.js";

/** Default concurrency for parallel file processing. */
export const DEFAULT_CONCURRENCY = 5;

/** Default fallback language when config is unavailable or lang is unset. */
export const DEFAULT_LANG = "en";

/**
 * Resolve concurrency from config, falling back to DEFAULT_CONCURRENCY.
 *
 * @param {Object} cfg - SDD config object
 * @returns {number}
 */
export function resolveConcurrency(cfg) {
  return Number(cfg.concurrency || 0) || DEFAULT_CONCURRENCY;
}

/**
 * JSON ファイルを読み込む。存在しなければ throw する。
 *
 * @param {string} filePath - 読み込む JSON ファイルの絶対パス
 * @returns {Object} パース済みオブジェクト
 */
export function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    const err = new Error(`Missing file: ${filePath}`);
    err.code = "ERR_MISSING_FILE";
    throw err;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * package.json の任意フィールドを読み込む。
 * 存在しないかパースに失敗した場合は undefined を返す。
 *
 * @param {string} root  - リポジトリルート
 * @param {string} field - 取得するフィールド名
 * @returns {*} フィールドの値、または undefined
 */
export function loadPackageField(root, field) {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg[field];
  } catch (_) {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// .sdd-forge パスヘルパー
// ---------------------------------------------------------------------------

const SDD_DIR_NAME = ".sdd-forge";

export function sddDir(root) {
  return path.join(root, SDD_DIR_NAME);
}

export function sddConfigPath(root) {
  return path.join(root, SDD_DIR_NAME, "config.json");
}

export function sddOutputDir(root) {
  return path.join(root, SDD_DIR_NAME, "output");
}

/**
 * Resolve agent work directory.
 *
 * Priority:
 *   1) SDD_FORGE_WORK_DIR environment variable
 *   2) config.agent.workDir
 *   3) ".tmp" (default)
 *
 * @param {string} root - Repository root
 * @param {Object} [cfg] - SDD config object
 * @returns {string} Absolute path to work directory
 */
export function resolveWorkDir(root, cfg) {
  const envWorkDir = process.env.SDD_FORGE_WORK_DIR;
  const dir = envWorkDir || cfg?.agent?.workDir || ".tmp";
  return path.resolve(root, dir);
}

/**
 * .sdd-forge/config.json から lang を読み込む。
 * ファイルが存在しないかパースに失敗した場合は "en" を返す。
 * ヘルプ表示など、バリデーション前に言語が必要な場面で使用する。
 *
 * @param {string} root - リポジトリルート
 * @returns {string}
 */
export function loadLang(root) {
  try {
    const raw = JSON.parse(fs.readFileSync(sddConfigPath(root), "utf8"));
    return raw.lang || DEFAULT_LANG;
  } catch (_) {
    return DEFAULT_LANG;
  }
}

// ---------------------------------------------------------------------------
// Config schema (JSON Schema subset — private, not exported)
// ---------------------------------------------------------------------------

const CONFIG_SCHEMA = {
  type: "object",
  required: ["lang", "type", "docs"],
  additionalProperties: false,
  properties: {
    name: { type: "string" },

    // Deprecated fields (旧フォーマット)
    output: { deprecated: true },

    lang: { type: "string", minLength: 1 },

    type: {
      oneOf: [
        { type: "string", minLength: 1 },
        { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
      ],
    },

    concurrency: { type: "number", minimum: 1 },

    docs: {
      type: "object",
      required: ["languages", "defaultLanguage"],
      properties: {
        languages: { type: "array", items: { type: "string" }, minItems: 1 },
        defaultLanguage: { type: "string", minLength: 1 },
        mode: { type: "string", enum: ["translate", "generate"] },
        style: {
          type: "object",
          properties: {
            purpose: { type: "string", minLength: 1 },
            tone: { type: "string", enum: ["polite", "formal", "casual"] },
            customInstruction: { type: "string" },
          },
        },
        exclude: { type: "array", items: { type: "string" } },
      },
    },

    chapters: {
      type: "array",
      items: {
        type: "object",
        required: ["chapter"],
        properties: {
          chapter: { type: "string" },
          desc: { type: "string" },
          exclude: { type: "boolean" },
        },
      },
    },

    agent: {
      type: "object",
      properties: {
        workDir: { type: "string" },
        timeout: { type: "number", minimum: 1 },
        retryCount: { type: "number", minimum: 1 },
        batchTokenLimit: { type: "number", minimum: 1000 },
        stdinFallbackThreshold: { type: "number", minimum: 1 },
        providers: {
          type: "object",
          additionalProperties: {
            type: "object",
            required: ["command", "args"],
            properties: {
              command: { type: "string", minLength: 1 },
              args: { type: "array" },
              systemPromptFlag: { type: "string" },
            },
          },
        },
        profiles: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        useProfile: { type: "string" },
      },
    },

    scan: {
      type: "object",
      required: ["include"],
      properties: {
        include: { type: "array", items: { type: "string" }, minItems: 1 },
        exclude: { type: "array", items: { type: "string" } },
      },
    },

    flow: {
      type: "object",
      properties: {
        merge: { type: "string", enum: ["squash", "ff-only", "merge"] },
        push: {
          type: "object",
          properties: {
            remote: { type: "string" },
          },
        },
        commands: {
          type: "object",
          properties: {
            context: {
              type: "object",
              properties: {
                search: {
                  type: "object",
                  properties: {
                    mode: { type: "string", enum: ["ngram", "ai"] },
                  },
                },
              },
            },
          },
        },
      },
    },

    commands: {
      type: "object",
      properties: {
        gh: { type: "string", enum: ["enable", "disable"] },
        test: {
          type: "object",
          required: ["task", "parent"],
          properties: {
            task: { type: "string", minLength: 1 },
            parent: { type: "string", minLength: 1 },
          },
        },
      },
    },

    experimental: {
      type: "object",
      properties: {
        workflow: {
          type: "object",
          properties: {
            enable: { type: "boolean" },
            languages: {
              type: "object",
              properties: {
                source: { type: "string" },
                publish: { type: "string" },
              },
            },
          },
        },
      },
    },

    logs: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        dir: { type: "string" },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

/**
 * Validate a config object against the schema.
 * Throws on any validation failure.
 *
 * @param {*} raw - Parsed config object
 * @returns {import("./types.js").SddConfig} Validated config
 */
export function validate(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("config must be a non-null object");
  }

  const errors = validateSchema(raw, CONFIG_SCHEMA);

  // Cross-field validation: defaultLanguage must be in languages
  if (Array.isArray(raw.docs?.languages) && typeof raw.docs?.defaultLanguage === "string") {
    if (!raw.docs.languages.includes(raw.docs.defaultLanguage)) {
      errors.push("'docs.defaultLanguage' must be one of 'docs.languages'");
    }
  }

  // Cross-field validation: profile provider references must be valid
  if (raw.agent?.profiles) {
    const registry = new ProviderRegistry(raw.agent?.providers || {});
    const knownKeys = new Set(registry.profileKeys());
    for (const [profileName, profile] of Object.entries(raw.agent.profiles)) {
      if (typeof profile !== "object" || profile == null) continue;
      for (const [commandId, providerKey] of Object.entries(profile)) {
        if (typeof providerKey === "string" && !knownKeys.has(providerKey)) {
          errors.push(`'agent.profiles.${profileName}.${commandId}': unknown provider "${providerKey}"`);
        }
      }
    }
  }

  // Cross-field validation: useProfile must reference a defined profile
  if (typeof raw.agent?.useProfile === "string" && raw.agent.profiles) {
    if (!raw.agent.profiles[raw.agent.useProfile]) {
      errors.push(`'agent.useProfile': profile "${raw.agent.useProfile}" is not defined in agent.profiles`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n  - ${errors.join("\n  - ")}`);
  }

  return /** @type {import("./types.js").SddConfig} */ (raw);
}

// ---------------------------------------------------------------------------
// SDD 設定管理
// ---------------------------------------------------------------------------

/**
 * .sdd-forge/config.json を読み込みバリデーションする。
 *
 * @param {string} root - リポジトリルート
 * @returns {import("./types.js").SddConfig}
 */
export function loadConfig(root) {
  const raw = loadJsonFile(sddConfigPath(root));
  return validate(raw);
}

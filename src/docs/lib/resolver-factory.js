/**
 * senrail/engine/resolvers/index.js
 *
 * リゾルバファクトリ。
 * type に応じて DataSource モジュールをロードし、リゾルバを返す。
 * 複数 type（配列）の場合、各チェーンごとに独立した resolver を生成する。
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { managedDir } from "../../lib/config.js";
import { loadDataSources as loadDataSourcesBase } from "./data-source-loader.js";
import { PRESETS, resolveMultiChains } from "../../lib/presets.js";
import { createLogger } from "../../lib/progress.js";

const logger = createLogger("resolver");

/** Load DataSources and call init(ctx) on each instance */
function loadDataSources(dataDir, ctx, existing, presetKey) {
  return loadDataSourcesBase(dataDir, {
    existing,
    presetKey,
    onInstance: (instance) => { instance.init(ctx); },
  });
}

// ---------------------------------------------------------------------------
// overrides.json 読み込み（キャッシュ付き）
// ---------------------------------------------------------------------------

let _overridesCache = null;
let _overridesRoot = null;

function loadOverridesFor(root) {
  if (_overridesCache && _overridesRoot === root) return _overridesCache;
  const overridesPath = path.join(managedDir(root), "overrides.json");
  if (fs.existsSync(overridesPath)) {
    _overridesCache = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
  } else {
    _overridesCache = {};
  }
  _overridesRoot = root;
  return _overridesCache;
}

function descFactory(root) {
  return function desc(section, key) {
    const o = loadOverridesFor(root);
    return o[section]?.[key] ?? "—";
  };
}

// ---------------------------------------------------------------------------
// ファクトリ
// ---------------------------------------------------------------------------

const COMMON_DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data",
);

/**
 * 単一チェーン用の resolver を生成する。
 *
 * @param {Object[]} chain - preset チェーン（root → leaf）
 * @param {string} root - プロジェクトルート
 * @param {Object} ctx - 共有コンテキスト
 * @returns {Promise<Map<string, Object>>} DataSource マップ
 */
async function loadChainDataSources(chain, ctx) {
  let dataSources = await loadDataSources(COMMON_DATA_DIR, ctx);

  for (const preset of chain) {
    const dataDir = path.join(preset.dir, "data");
    dataSources = await loadDataSources(dataDir, ctx, dataSources, preset.key);
  }

  return dataSources;
}

function fallbackDataSourceChains(types) {
  const basePreset = PRESETS.find((p) => p.key === "base");
  if (!basePreset) return [];

  const typeList = Array.isArray(types) ? types : [types];
  return [...new Set(typeList)].map((key) => [
    key === "base" ? basePreset : { ...basePreset, key, parent: null },
  ]);
}

/**
 * type に基づいてリゾルバを生成する。
 * 複数 type の場合、各チェーンごとに独立した DataSource マップを持つ。
 *
 * @param {string|string[]} type - preset 名（例: "symfony"）または配列（例: ["symfony", "postgres"]）
 * @param {string} root - プロジェクトルート
 * @param {Object} [opts] - 追加オプション
 * @param {string} [opts.docsDir] - docs ディレクトリの絶対パス
 * @param {string} [opts.documentPath] - directive を解決する文書の絶対パス
 * @returns {Promise<{ resolve: (preset: string, source: string, method: string, analysis: Object, labels: string[]) => string|null }>}
 */
export async function createResolver(type, root, opts) {
  // Warn about deprecated .senrail/data/ directory
  if (root) {
    const deprecatedDataDir = path.join(managedDir(root), "data");
    if (fs.existsSync(deprecatedDataDir)) {
      process.stderr.write(`[senrail] WARN: .senrail/data/ is deprecated. Move DataSources to .senrail/presets/<type>/data/ instead.\n`);
    }
  }

  const desc = descFactory(root);
  const loadOverrides = () => loadOverridesFor(root);
  const ctx = {
    desc,
    loadOverrides,
    root,
    docsDir: opts?.docsDir,
    documentPath: opts?.documentPath,
    type,
    configChapters: opts?.configChapters,
  };

  let chains;
  try {
    chains = resolveMultiChains(type, root);
  } catch (err) {
    if (!/Preset not found:/.test(err.message)) throw err;
    try {
      chains = resolveMultiChains(type);
    } catch (fallbackErr) {
      if (!/Preset not found:/.test(fallbackErr.message)) throw fallbackErr;
      chains = fallbackDataSourceChains(type);
    }
  }

  // 各チェーンの leaf key → DataSource マップ
  const resolverMap = new Map();
  // ancestor key → leaf key マッピング（先祖プリセット名から leaf を逆引き）
  const ancestorMap = new Map();
  for (const chain of chains) {
    const leafKey = chain[chain.length - 1].key;
    const dataSources = await loadChainDataSources(chain, ctx);
    resolverMap.set(leafKey, dataSources);
    // chain 内の全プリセットを ancestor マップに登録
    for (const p of chain) {
      if (!ancestorMap.has(p.key)) ancestorMap.set(p.key, leafKey);
    }
  }

  return {
    /**
     * preset.source.method でデータを解決する。
     *
     * @param {string} preset - プリセット名（resolver マップのキー、または先祖プリセット名）
     * @param {string} source - DataSource 名
     * @param {string} method - メソッド名
     * @param {Object} analysis - analysis.json データ
     * @param {string[]} labels - ラベル配列
     * @param {Object} [params] - directive option object (excluding parser-owned controls)
     * @returns {string|null}
     */
    resolve(preset, source, method, analysis, labels, params) {
      let dataSources = resolverMap.get(preset);
      // 先祖プリセット名で指定された場合、leaf の DataSource マップにフォールバック
      if (!dataSources) {
        const leafKey = ancestorMap.get(preset);
        if (leafKey) dataSources = resolverMap.get(leafKey);
      }
      if (!dataSources) {
        logger.verbose(`unknown preset: ${preset}`);
        return null;
      }

      const ds = dataSources.get(source);
      if (ds && typeof ds[method] === "function") {
        return ds[method](analysis, labels, params);
      }

      logger.verbose(`unknown: ${preset}.${source}.${method}`);
      return null;
    },

    /** Get the list of preset keys this resolver handles. */
    presetKeys() {
      return [...resolverMap.keys()];
    },
  };
}

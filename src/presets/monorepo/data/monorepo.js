/**
 * MonorepoSource — DataSource for monorepo project metadata.
 *
 * Provides app-level information for chapter headers.
 *
 * Available methods:
 *   monorepo.apps("chapter_name") — badge-style text showing target apps for a chapter
 */

import path from "path";

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const ANALYSIS_META_KEYS = container.get("base.ANALYSIS_META_KEYS");
  const loadJsonFile = container.get("config.loadJsonFile");

  class MonorepoSource extends DataSource {
    init(ctx) {
      super.init(ctx);
      this._root = ctx.root;
    }

    /**
     * Return badge-style text listing target apps for a chapter.
     *
     * Priority: config.monorepo.apps (if defined) > enriched analysis app field.
     * When config defines apps, all apps are shown for every chapter.
     * When using enriched analysis, apps are filtered by chapter name.
     *
     * @param {Object} analysis - analysis.json data
     * @param {string[]} labels - labels[0] = chapter name (without .md)
     * @returns {string|null}
     */
    apps(analysis, labels) {
      const chapterName = labels[0] || "";

      // Priority 1: config.monorepo.apps
      const config = this._loadConfig();
      const configApps = config?.monorepo?.apps;
      if (Array.isArray(configApps) && configApps.length > 0) {
        const names = configApps.map((a) => a.name).filter(Boolean);
        if (names.length > 0) {
          return this._formatBadge(names);
        }
      }

      // Priority 2: enriched analysis app field
      if (!analysis?.enrichedAt) return null;
      if (!chapterName) return null;

      const appSet = new Set();
      for (const cat of Object.keys(analysis)) {
        if (ANALYSIS_META_KEYS.has(cat)) continue;
        const data = analysis[cat];
        if (!data || typeof data !== "object") continue;
        const items = data.entries;
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          if (item.chapter === chapterName && item.app) {
            appSet.add(item.app);
          }
        }
      }

      if (appSet.size === 0) return null;
      return this._formatBadge([...appSet].sort());
    }

    _formatBadge(names) {
      return `> **Target:** ${names.join(", ")}`;
    }

    _loadConfig() {
      try {
        return loadJsonFile(path.join(this._root, ".sdd-forge", "config.json"));
      } catch (_) {
        return {};
      }
    }
  }

  return MonorepoSource;
}

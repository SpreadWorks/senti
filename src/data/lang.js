/**
 * LangSource — DataSource for language switcher links.
 *
 * Generates {{data: lang.links}} directives that produce
 * language navigation links at the top of each document.
 */

import path from "path";

/** Map of language codes to display names. */
const LANG_NAMES = {
  en: "English",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  ru: "Русский",
};

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Paragraph = container.get("base.Paragraph");
  const loadJsonFile = container.get("config.loadJsonFile");

  class LangSource extends DataSource {
  init(ctx) {
    super.init(ctx);
    this._root = ctx.root;
  }

  /**
   * Generate language switcher links for the current file.
   *
   * Called via: {{data: lang.links}}
   * The file path context is passed via the labels parameter.
   * When called from data.js, labels[0] is the relative file path.
   *
   * @param {Object} _analysis
   * @param {string[]} labels - labels[0] = relative file path from project root
   * @returns {string|null}
   */
  links(_analysis, labels) {
    const config = this._loadConfig();
    const languages = config.docs.languages;
    const defaultLang = config.docs.defaultLanguage;

    if (languages.length < 2) return null;

    const filePath = labels[0] || "";
    if (!filePath) return null;

    // Determine current file's language from path
    const currentLang = this._detectLang(filePath, defaultLang);

    // Build links to other languages
    const links = [];
    for (const lang of languages) {
      if (lang === currentLang) continue;
      const displayName = LANG_NAMES[lang] || lang;
      const targetPath = this._computeRelativePath(filePath, currentLang, lang, defaultLang);
      links.push(`[${displayName}](${targetPath})`);
    }

    if (links.length === 0) return null;
    return new Paragraph(`🌐 ${links.join(" | ")}`);
  }

  /**
   * Detect the language of a file from its path.
   * Files under docs/{lang}/ → that lang. Files under docs/ → default.
   */
  _detectLang(filePath, defaultLang) {
    // Normalize to forward slashes
    const normalized = filePath.replace(/\\/g, "/");
    const match = normalized.match(/^docs\/([a-z]{2})\//);
    return match ? match[1] : defaultLang;
  }

  /**
   * Compute relative path from current file to the same file in another language.
   */
  _computeRelativePath(filePath, currentLang, targetLang, defaultLang) {
    const normalized = filePath.replace(/\\/g, "/");
    const fileName = path.basename(normalized);

    if (currentLang === defaultLang) {
      // docs/overview.md → docs/{targetLang}/overview.md
      // Relative: {targetLang}/overview.md
      return `${targetLang}/${fileName}`;
    } else if (targetLang === defaultLang) {
      // docs/{currentLang}/overview.md → docs/overview.md
      // Relative: ../overview.md
      return `../${fileName}`;
    } else {
      // docs/{currentLang}/overview.md → docs/{targetLang}/overview.md
      // Relative: ../{targetLang}/overview.md
      return `../${targetLang}/${fileName}`;
    }
  }

  _loadConfig() {
    try {
      return loadJsonFile(path.join(this._root, ".senti", "config.json"));
    } catch (_) {
      return {};
    }
  }
  }

  return LangSource;
}

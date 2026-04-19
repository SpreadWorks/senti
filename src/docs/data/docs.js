/**
 * DocsSource — common DataSource for docs/ chapter listing.
 *
 * Provides chapter table for README and other docs.
 * Available for all project types.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getChapterFiles } from "../lib/command-context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const loadJsonFile = container.get("config.loadJsonFile");

  class DocsSource extends DataSource {
  init(ctx) {
    super.init(ctx);
    this._root = ctx.root;
    this._docsDir = ctx.docsDir || null;
    this._type = ctx.type || null;
    this._configChapters = ctx.configChapters || null;
    this._repoUrl = this._resolveRepoUrl();
  }

  _resolveRepoUrl() {
    const pkgPath = path.join(this._root, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const repo = pkg.repository;
    if (!repo) return null;
    const url = typeof repo === "string" ? repo : repo.url;
    if (!url) return null;
    return url.replace(/^git\+/, "").replace(/\.git$/, "");
  }

  /**
   * Language switcher links for the top of each document.
   *
   * Called via: {{data: docs.langSwitcher("relative")}} or {{data: docs.langSwitcher("absolute")}}
   * labels[0] = "relative" or "absolute"
   * labels[1] = relative file path from project root (injected by data.js / readme.js)
   *
   * @returns {string|null} Markdown links or null if single language
   */
  langSwitcher(_analysis, labels) {
    const mode = labels[0] || "relative";
    const filePath = labels[1] || "";
    if (!filePath) return null;

    const config = this._loadConfig();
    if (!config?.docs?.languages || config.docs.languages.length < 2) return null;

    const languages = config.docs.languages;
    const defaultLang = config.docs.defaultLanguage;
    const currentLang = this._detectLang(filePath, defaultLang);
    const langNames = this._loadLanguageNames(config.lang || defaultLang);

    const parts = [];
    for (const lang of languages) {
      const displayName = langNames[lang] || lang;
      if (lang === currentLang) {
        parts.push(`**${displayName}**`);
      } else {
        const targetPath = mode === "absolute"
          ? this._computeAbsolutePath(filePath, currentLang, lang, defaultLang)
          : this._computeLangRelativePath(filePath, currentLang, lang, defaultLang);
        parts.push(`[${displayName}](${targetPath})`);
      }
    }

    return parts.join(" | ");
  }

  /**
   * Detect language from file path.
   * Files under docs/{lang}/ → that lang. Others → default.
   */
  _detectLang(filePath, defaultLang) {
    const normalized = filePath.replace(/\\/g, "/");
    const match = normalized.match(/^docs\/([a-z]{2})\//);
    return match ? match[1] : defaultLang;
  }

  /**
   * Compute relative path from current file to same file in another language.
   */
  _computeLangRelativePath(filePath, currentLang, targetLang, defaultLang) {
    const normalized = filePath.replace(/\\/g, "/");
    const fileName = path.basename(normalized);
    const isReadme = fileName === "README.md";

    // README at root (e.g. "README.md")
    if (isReadme && !normalized.includes("/")) {
      // Root README → target lang README
      if (targetLang === defaultLang) return "README.md";
      return `docs/${targetLang}/${fileName}`;
    }

    // README in docs/ja/ etc
    if (isReadme && currentLang !== defaultLang && targetLang === defaultLang) {
      return `../../${fileName}`;
    }
    if (isReadme && currentLang === defaultLang && targetLang !== defaultLang) {
      return `docs/${targetLang}/${fileName}`;
    }

    // Regular docs chapter files
    if (currentLang === defaultLang) {
      return `${targetLang}/${fileName}`;
    } else if (targetLang === defaultLang) {
      return `../${fileName}`;
    } else {
      return `../${targetLang}/${fileName}`;
    }
  }

  /**
   * Compute absolute URL from current file to same file in another language.
   */
  _computeAbsolutePath(filePath, currentLang, targetLang, defaultLang) {
    if (!this._repoUrl) {
      return this._computeLangRelativePath(filePath, currentLang, targetLang, defaultLang);
    }

    const fileName = path.basename(filePath);

    if (targetLang === defaultLang) {
      // Default lang files are at root (README.md) or docs/ (chapters)
      const isReadme = fileName === "README.md";
      if (isReadme) return `${this._repoUrl}/blob/main/README.md`;
      return `${this._repoUrl}/blob/main/docs/${fileName}`;
    }

    // Non-default lang files are in docs/{lang}/
    return `${this._repoUrl}/blob/main/docs/${targetLang}/${fileName}`;
  }

  _loadConfig() {
    try {
      return loadJsonFile(path.join(this._root, ".sdd-forge", "config.json"));
    } catch (_) {
      return {};
    }
  }

  /**
   * Load language display names from locale file.
   */
  _loadLanguageNames(lang) {
    const localeDir = path.resolve(__dirname, "..", "..", "locale");
    const filePath = path.join(localeDir, lang, "ui.json");
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return data.languageNames || {};
    } catch (_) {
      // Fallback to en
      try {
        const fallback = JSON.parse(fs.readFileSync(path.join(localeDir, "en", "ui.json"), "utf8"));
        return fallback.languageNames || {};
      } catch (__) {
        return {};
      }
    }
  }

  /** Chapter table: lists docs chapter files with title and description. */
  chapters(_analysis, labels) {
    const docsDir = this._docsDir || path.join(this._root, "docs");
    if (!fs.existsSync(docsDir)) return null;

    const files = getChapterFiles(docsDir, { type: this._type, configChapters: this._configChapters, projectRoot: this._root });

    if (files.length === 0) return null;

    const rows = files.map((f) => {
      const content = fs.readFileSync(path.join(docsDir, f), "utf8");
      const lines = content.split("\n");

      const title = this._extractTitle(path.join(docsDir, f), f);

      // Description: ## Description / ## 説明 ~ next ##
      let inDesc = false;
      const descLines = [];
      for (const line of lines) {
        if (/^## (Description|説明|概要)/.test(line)) { inDesc = true; continue; }
        if (inDesc && /^## /.test(line)) break;
        if (inDesc) {
          // Skip directive lines (both old and new syntax)
          if (/<!--\s*\{\{(text|data)/.test(line)) continue;
          if (/<!--\s*\{\{\/(data|text)\}\}\s*-->/.test(line)) continue;
          if (/<!--\s*@(block|endblock|extends|parent)/.test(line)) continue;
          if (/<!--\s*\{%/.test(line)) continue;
          descLines.push(line);
        }
      }

      const rawDesc = descLines.join(" ").replace(/\s+/g, " ").trim() || "";
      // First sentence: match Japanese (。) or English (. followed by space/end)
      const firstSentence = rawDesc.match(/^.*?[。]|^.*?\.\s/)?.[0]?.trim() || rawDesc;
      // Strip markdown formatting for clean display in tables
      const cleanDesc = firstSentence
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        .replace(/\[(.+?)\]\([^)]*\)/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/~~(.+?)~~/g, "$1");
      const description = cleanDesc.length > 120
        ? cleanDesc.slice(0, 117) + "…"
        : cleanDesc;

      const docsDirRel = this._docsDir
        ? path.relative(this._root, this._docsDir).replace(/\\/g, "/")
        : "docs";
      const link = this._repoUrl
        ? `${this._repoUrl}/blob/main/${docsDirRel}/${f}`
        : `${docsDirRel}/${f}`;
      return [`[${title}](${link})`, description];
    });

    const hdr = labels.length >= 2 ? labels : ["章", "概要"];
    return this.toMarkdownTable(rows, hdr);
  }

  /**
   * Chapter navigation links (prev/next).
   *
   * Called via: {{data: docs.nav("")}}
   * labels[0] = relative file path from project root (injected by data.js)
   *
   * @returns {string|null} Markdown navigation links or null
   */
  nav(_analysis, labels) {
    const filePath = labels[0] || "";
    if (!filePath) return null;

    const docsDir = this._docsDir || path.join(this._root, "docs");
    if (!fs.existsSync(docsDir)) return null;

    const files = getChapterFiles(docsDir, { type: this._type, configChapters: this._configChapters, projectRoot: this._root });
    if (files.length <= 1) return null;

    // Find current file in the chapter list
    const currentFile = path.basename(filePath);
    const currentIdx = files.indexOf(currentFile);
    if (currentIdx < 0) return null;

    const parts = [];

    // Previous chapter link
    if (currentIdx > 0) {
      const prevFile = files[currentIdx - 1];
      const prevTitle = this._extractTitle(path.join(docsDir, prevFile), prevFile);
      parts.push(`[← ${prevTitle}](${prevFile})`);
    }

    // Next chapter link
    if (currentIdx < files.length - 1) {
      const nextFile = files[currentIdx + 1];
      const nextTitle = this._extractTitle(path.join(docsDir, nextFile), nextFile);
      parts.push(`[${nextTitle} →](${nextFile})`);
    }

    if (parts.length === 0) return null;
    return parts.join(" | ");
  }

  /**
   * Extract the title from a chapter file.
   * Prefers `# NN. Title` format, falls back to first `# ` line.
   *
   * @param {string} filePath - Absolute path to chapter file
   * @param {string} fileName - File name (fallback)
   * @returns {string} Chapter title
   */
  _extractTitle(filePath, fileName) {
    if (!fs.existsSync(filePath)) return fileName.replace(/\.md$/, "");
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const titleLine = lines.find((l) => /^# \d{2}\./.test(l))
      || lines.find((l) => /^# /.test(l));
    return titleLine ? titleLine.replace(/^# /, "") : fileName.replace(/\.md$/, "");
  }
  }

  return DocsSource;
}

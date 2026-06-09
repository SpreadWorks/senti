/**
 * ConfigSource — Laravel configuration DataSource.
 *
 * Parses config files, .env.example, providers, and middleware
 * into ConfigEntry instances. Each entry carries a `kind` field indicating
 * what type of config data it provides.
 *
 * Available methods (called via {{data}} directives):
 *   config.composer("Package|Version|Description")
 *   config.env("Key|Default|Description")
 *   config.providers("Name|File|Register|Boot")
 *   config.middleware("Name|File|Description")
 *   config.files("File|Keys")
 */

import fs from "fs";
import path from "path";

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const hasSegmentPath = container.get("pathMatch.hasSegmentPath");
  const WebappDataSource = container.getPreset("webapp").dataSources["webapp-data-source"];

  class ConfigEntry extends AnalysisEntry {
    /** Discriminator: "env" | "configFile" | "provider" | "middleware" */
    kind = null;

    // env
    envKeys = null;

    // configFile
    configFileKeys = null;

    // provider
    className = null;
    hasRegister = null;
    hasBoot = null;

    static summary = {};
  }

  class ConfigSource extends WebappDataSource {
    static Entry = ConfigEntry;

    match(relPath) {
      return (
        (hasPathPrefix(relPath, "config/") && relPath.endsWith(".php")) ||
        hasSegmentPath(relPath, ".env.example") ||
        hasSegmentPath(relPath, ".env") ||
        (hasPathPrefix(relPath, "app/Providers/") && relPath.endsWith(".php")) ||
        (hasPathPrefix(relPath, "app/Http/Middleware/") && relPath.endsWith(".php"))
      );
    }

    parse(absPath) {
      const entry = new ConfigEntry();

      if (absPath.endsWith(".env.example") || absPath.endsWith(".env")) {
        entry.kind = "env";
        const content = fs.readFileSync(absPath, "utf8");
        const keys = [];
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
          if (m) {
            keys.push({ key: m[1], defaultValue: trimmed.slice(m[0].length) });
          }
        }
        entry.envKeys = keys;
        return entry;
      }

      if (absPath.includes("/config/") && absPath.endsWith(".php")) {
        entry.kind = "configFile";
        const content = fs.readFileSync(absPath, "utf8");
        const topKeys = [];
        const keyRegex = /['"](\w+)['"]\s*=>/g;
        const returnPos = content.indexOf("return [");
        if (returnPos >= 0) {
          const body = content.slice(returnPos, returnPos + 2000);
          let m;
          while ((m = keyRegex.exec(body)) !== null) {
            if (!topKeys.includes(m[1])) topKeys.push(m[1]);
            if (topKeys.length >= 20) break;
          }
        }
        entry.configFileKeys = topKeys;
        return entry;
      }

      if (absPath.includes("/app/Providers/") && absPath.endsWith(".php")) {
        entry.kind = "provider";
        const content = fs.readFileSync(absPath, "utf8");
        const classMatch = content.match(/class\s+(\w+)/);
        entry.className = classMatch
          ? classMatch[1]
          : path.basename(absPath, ".php");
        entry.hasRegister = /public\s+function\s+register\s*\(/.test(content);
        entry.hasBoot = /public\s+function\s+boot\s*\(/.test(content);
        return entry;
      }

      if (absPath.includes("/app/Http/Middleware/") && absPath.endsWith(".php")) {
        entry.kind = "middleware";
        const content = fs.readFileSync(absPath, "utf8");
        const classMatch = content.match(/class\s+(\w+)/);
        entry.className = classMatch
          ? classMatch[1]
          : path.basename(absPath, ".php");
        return entry;
      }

      return entry;
    }

    /** Composer dependencies table (reads from base PackageSource). */
    composer(analysis, labels) {
      const pkgEntry = (analysis.package?.entries || []).find(
        (e) => e.composerDeps != null,
      );
      if (!pkgEntry?.composerDeps) return null;
      const { require: req, requireDev } = pkgEntry.composerDeps;
      const rows = [];
      for (const [pkg, ver] of Object.entries(req)) {
        rows.push([pkg, ver, this.desc("composerDeps", pkg)]);
      }
      for (const [pkg, ver] of Object.entries(requireDev)) {
        rows.push([`${pkg} (dev)`, ver, this.desc("composerDeps", pkg)]);
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Environment variables table. */
    env(analysis, labels) {
      const envEntry = (analysis.config?.entries || []).find(
        (e) => e.kind === "env",
      );
      if (!envEntry?.envKeys || envEntry.envKeys.length === 0) return null;
      const items = this.mergeDesc(envEntry.envKeys, "env", "key");
      const rows = this.toRows(items, (e) => [
        e.key,
        e.defaultValue || "\u2014",
        e.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Service providers table. */
    providers(analysis, labels) {
      const providers = (analysis.config?.entries || []).filter(
        (e) => e.kind === "provider",
      );
      if (providers.length === 0) return null;
      const rows = this.toRows(providers, (p) => [
        p.className,
        p.file,
        p.hasRegister ? "YES" : "\u2014",
        p.hasBoot ? "YES" : "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** HTTP middleware table. */
    middleware(analysis, labels) {
      const mw = (analysis.config?.entries || []).filter(
        (e) => e.kind === "middleware",
      );
      if (mw.length === 0) return null;
      const items = this.mergeDesc(mw, "middleware");
      const rows = this.toRows(items, (m) => [
        m.className,
        m.file,
        m.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Config files and their top-level keys. */
    files(analysis, labels) {
      const configFiles = (analysis.config?.entries || []).filter(
        (e) => e.kind === "configFile",
      );
      if (configFiles.length === 0) return null;
      const rows = this.toRows(configFiles, (cf) => [
        cf.file,
        (cf.configFileKeys || []).join(", ") || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return ConfigSource;
}

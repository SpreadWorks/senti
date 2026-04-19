/**
 * ConfigSource — Symfony configuration DataSource.
 *
 * Symfony-only category using Scannable(DataSource) directly.
 * Each matched config file is parsed individually; resolve methods
 * aggregate across all entries.
 *
 * Available methods (called via {{data}} directives):
 *   config.composer("Package|Version|Description")
 *   config.env("Key|Default|Description")
 *   config.bundles("Bundle|FullName|Description")
 *   config.packages("File|Keys")
 *   config.services("Autowire|Autoconfigure")
 */

import fs from "fs";
import path from "path";

function parseEnvContent(content) {
  const keys = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      const value = trimmed.slice(match[0].length);
      keys.push({ key: match[1], defaultValue: value });
    }
  }
  return keys;
}

function parseBundlesContent(content) {
  const bundles = [];
  const bundleRegex = /([\w\\]+)::class\s*=>/g;
  let m;
  while ((m = bundleRegex.exec(content)) !== null) {
    const fullName = m[1];
    const shortName = fullName.split("\\").pop();
    bundles.push({ fullName, shortName });
  }
  return bundles;
}

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const hasSegmentPath = container.get("pathMatch.hasSegmentPath");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const webapp = container.getPreset("webapp").dataSources;
  const WebappDataSource = webapp["webapp-data-source"];

  class SymfonyConfigEntry extends AnalysisEntry {
    /** Entry type: "composer" | "env" | "bundle" | "package" | "services" | "kernel" */
    configType = null;
    /** composer.json: { require, requireDev } */
    composerDeps = null;
    /** .env: Array<{key, defaultValue}> */
    envKeys = null;
    /** config/bundles.php: Array<{fullName, shortName}> */
    bundles = null;
    /** config/packages/*.yaml: { file, keys } */
    packageConfig = null;
    /** config/services.yaml: { autowire, autoconfigure } */
    services = null;
    /** src/Kernel.php: { className, parentClass } */
    kernel = null;

    static summary = {};
  }

  class ConfigSource extends WebappDataSource {
    static Entry = SymfonyConfigEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "config/") ||
        hasSegmentPath(relPath, ".env") ||
        hasSegmentPath(relPath, ".env.local") ||
        hasSegmentPath(relPath, "composer.json");
    }

    parse(absPath) {
      const entry = new SymfonyConfigEntry();
      const fileName = path.basename(absPath);
      const content = fs.readFileSync(absPath, "utf8");

      if (fileName === "composer.json") {
        entry.configType = "composer";
        try {
          const composer = JSON.parse(content);
          entry.composerDeps = {
            require: composer.require || {},
            requireDev: composer["require-dev"] || {},
          };
        } catch (_) {
          entry.composerDeps = { require: {}, requireDev: {} };
        }
      } else if (fileName === ".env" || fileName === ".env.local" || fileName === ".env.example") {
        entry.configType = "env";
        entry.envKeys = parseEnvContent(content);
      } else if (fileName === "bundles.php") {
        entry.configType = "bundle";
        entry.bundles = parseBundlesContent(content);
      } else if (fileName === "services.yaml" || fileName === "services.yml") {
        entry.configType = "services";
        entry.services = {
          autowire: /autowire:\s*true/.test(content),
          autoconfigure: /autoconfigure:\s*true/.test(content),
        };
      } else if (/\.(yaml|yml)$/.test(fileName) && absPath.includes("config/packages")) {
        entry.configType = "package";
        const topKeys = [];
        for (const line of content.split("\n")) {
          const keyMatch = line.match(/^(\w[\w_-]*):/);
          if (keyMatch && !topKeys.includes(keyMatch[1])) {
            topKeys.push(keyMatch[1]);
            if (topKeys.length >= 20) break;
          }
        }
        entry.packageConfig = { file: fileName, keys: topKeys };
      } else if (fileName === "Kernel.php") {
        entry.configType = "kernel";
        const classMatch = content.match(/class\s+(\w+)\s+extends\s+(\w+)/);
        entry.kernel = {
          className: classMatch ? classMatch[1] : "Kernel",
          parentClass: classMatch ? classMatch[2] : "",
        };
      }

      return entry;
    }

    /** Composer dependencies table. */
    composer(analysis, labels) {
      const entries = analysis.config?.entries || [];
      const composerEntry = entries.find((e) => e.configType === "composer");
      if (!composerEntry?.composerDeps) return null;
      const { require: req, requireDev } = composerEntry.composerDeps;
      const rows = [];
      for (const [pkg, ver] of Object.entries(req || {})) {
        rows.push([pkg, ver, this.desc("composerDeps", pkg)]);
      }
      for (const [pkg, ver] of Object.entries(requireDev || {})) {
        rows.push([`${pkg} (dev)`, ver, this.desc("composerDeps", pkg)]);
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    /** Environment variables table. */
    env(analysis, labels) {
      const entries = analysis.config?.entries || [];
      const envEntries = entries.filter((e) => e.configType === "env");
      const allKeys = envEntries.flatMap((e) => e.envKeys || []);
      if (allKeys.length === 0) return null;
      const items = this.mergeDesc(allKeys, "env", "key");
      const rows = this.toRows(items, (e) => [
        e.key,
        e.defaultValue || "\u2014",
        e.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Symfony bundles table. */
    bundles(analysis, labels) {
      const entries = analysis.config?.entries || [];
      const bundleEntry = entries.find((e) => e.configType === "bundle");
      if (!bundleEntry?.bundles || bundleEntry.bundles.length === 0) return null;
      const items = this.mergeDesc(bundleEntry.bundles, "bundles", "shortName");
      const rows = this.toRows(items, (b) => [
        b.shortName,
        b.fullName,
        b.summary || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Config packages table. */
    packages(analysis, labels) {
      const entries = analysis.config?.entries || [];
      const packageEntries = entries.filter((e) => e.configType === "package");
      if (packageEntries.length === 0) return null;
      const configFiles = packageEntries.map((e) => e.packageConfig).filter(Boolean);
      if (configFiles.length === 0) return null;
      const rows = this.toRows(configFiles, (cf) => [
        cf.file,
        cf.keys.join(", ") || "\u2014",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    /** Services configuration table. */
    services(analysis, labels) {
      const entries = analysis.config?.entries || [];
      const servicesEntry = entries.find((e) => e.configType === "services");
      if (!servicesEntry?.services) return null;
      const rows = [
        [servicesEntry.services.autowire ? "YES" : "NO", servicesEntry.services.autoconfigure ? "YES" : "NO"],
      ];
      return this.toMarkdownTable(rows, labels);
    }
  }

  return ConfigSource;
}

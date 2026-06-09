/**
 * PackageSource — package.json / composer.json DataSource.
 *
 * Extracts dependency and script information from package manifest files.
 * Available for all presets via base preset inheritance.
 */

import fs from "fs";
import path from "path";
import { hasMakeTestTarget, readMakefile } from "../../../lib/makefile.js";

const PACKAGE_FILES = new Set(["package.json", "composer.json"]);
const MAKE_FILES = new Set(["Makefile", "makefile"]);

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");

  class PackageEntry extends AnalysisEntry {
    packageDeps = null;
    packageScripts = null;
    composerDeps = null;
    composerScripts = null;
    makefileTest = null;
    static summary = {};
  }

  class PackageSource extends Scannable(DataSource) {
    static Entry = PackageEntry;

    match(relPath) {
      const base = path.basename(relPath);
      return PACKAGE_FILES.has(base) || MAKE_FILES.has(base);
    }

    parse(absPath) {
      const entry = new PackageEntry();
      const fileName = path.basename(absPath);
      if (MAKE_FILES.has(fileName)) {
        if (hasMakeTestTarget(readMakefile(absPath, { ignoreTooLarge: true }))) {
          entry.makefileTest = true;
        }
        return entry;
      }
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(absPath, "utf8"));
      } catch (_) {
        return entry;
      }

      if (fileName === "package.json") {
        entry.packageDeps = {
          dependencies: parsed.dependencies || {},
          devDependencies: parsed.devDependencies || {},
        };
        if (parsed.scripts && Object.keys(parsed.scripts).length > 0) {
          entry.packageScripts = parsed.scripts;
        }
      }

      if (fileName === "composer.json") {
        entry.composerDeps = {
          require: parsed.require || {},
          requireDev: parsed["require-dev"] || {},
        };
        if (parsed.scripts && Object.keys(parsed.scripts).length > 0) {
          entry.composerScripts = parsed.scripts;
        }
      }

      return entry;
    }
  }

  return PackageSource;
}

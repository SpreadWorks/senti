/**
 * NextjsComponentsSource — scan + data DataSource for Next.js components.
 *
 * Scans .tsx/.jsx files in app/components directories and classifies them
 * as server, client, or shared components.
 * Data methods read analysis.components to generate component tables.
 */

import fs from "fs";
import path from "path";

const COMPONENT_DIR_PREFIXES = ["app/", "components/", "src/components/", "src/app/"];
const COMPONENT_EXT = /\.(tsx|jsx)$/;

function classifyComponent(absPath, content) {
  if (/\/(shared|common)\//.test(absPath)) return "shared";
  if (/^["']use client["']/.test(content.trimStart())) return "client";
  return "server";
}

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const hasAnyPathPrefix = container.get("pathMatch.hasAnyPathPrefix");

  class ComponentEntry extends AnalysisEntry {
    name = null;
    componentType = null;
    static summary = {};
  }

  class NextjsComponentsSource extends Scannable(DataSource) {
    static Entry = ComponentEntry;

    match(relPath) {
      return COMPONENT_EXT.test(relPath) && hasAnyPathPrefix(relPath, COMPONENT_DIR_PREFIXES);
    }

    parse(absPath) {
      const entry = new ComponentEntry();
      const content = fs.readFileSync(absPath, "utf8");
      entry.name = path.basename(absPath, path.extname(absPath));
      entry.componentType = classifyComponent(absPath, content);
      return entry;
    }

    server(analysis, labels) {
      return this._componentTable(analysis, labels, "server");
    }

    client(analysis, labels) {
      return this._componentTable(analysis, labels, "client");
    }

    shared(analysis, labels) {
      return this._componentTable(analysis, labels, "shared");
    }

    _componentTable(analysis, labels, type) {
      const items = (analysis.components?.entries || []).filter(
        (c) => c.componentType === type,
      );
      if (items.length === 0) return null;
      const rows = this.toRows(items, (c) => [
        c.name || "\u2014",
        c.file || "\u2014",
        c.summary || "\u2014",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Component", "File", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return NextjsComponentsSource;
}

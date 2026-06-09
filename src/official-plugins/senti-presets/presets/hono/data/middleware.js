/**
 * HonoMiddlewareSource — scan + data DataSource for Hono middleware.
 *
 * Scans .ts/.js/.mjs files for app.use() calls and createMiddleware()
 * definitions to extract middleware registrations.
 * Data methods read analysis.middleware to generate middleware tables.
 */

import fs from "fs";

const SOURCE_EXT = /\.(ts|js|mjs)$/;

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const WebappDataSource = container.getPreset("webapp").dataSources["webapp-data-source"];

  class MiddlewareEntry extends AnalysisEntry {
    name = null;
    middlewarePath = null;
    static summary = {};
  }

  class HonoMiddlewareSource extends WebappDataSource {
    static Entry = MiddlewareEntry;

    match(relPath) {
      return SOURCE_EXT.test(relPath);
    }

    parse(absPath) {
      const entry = new MiddlewareEntry();
      const content = fs.readFileSync(absPath, "utf8");

      // Pattern 1: .use('/path', middlewareName( ... ))
      const useWithPathRegex = /\.use\(\s*['"]([^'"]*)['"]\s*,\s*(\w+)\s*\(/;
      const m1 = useWithPathRegex.exec(content);
      if (m1) {
        entry.name = m1[2];
        entry.middlewarePath = m1[1];
        return entry;
      }

      // Pattern 2: .use(middlewareName( ... )) — no path argument
      const useNoPathRegex = /\.use\(\s*(\w+)\s*\(/;
      const m2 = useNoPathRegex.exec(content);
      if (m2) {
        entry.name = m2[1];
        entry.middlewarePath = "*";
        return entry;
      }

      // Pattern 3: createMiddleware() definitions
      const createMwRegex = /(?:const|let|var)\s+(\w+)\s*=\s*createMiddleware\s*\(/;
      const m3 = createMwRegex.exec(content);
      if (m3) {
        entry.name = m3[1];
        entry.middlewarePath = "*";
        return entry;
      }

      return entry;
    }

    /** Middleware list table. */
    list(analysis, labels) {
      const items = analysis.middleware?.entries || [];
      if (items.length === 0) return null;
      const rows = this.toRows(items, (m) => [
        m.name || "\u2014",
        m.summary || "\u2014",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Middleware", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return HonoMiddlewareSource;
}

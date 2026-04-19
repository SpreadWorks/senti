/**
 * CommandsSource — CakePHP 2.x commands DataSource.
 *
 * Extends webapp CommandsSource with CakePHP-specific parse logic
 * and resolve methods (deps, flow).
 */

import fs from "fs";

export default function register(container) {
  const stripBlockComments = container.get("phpParser.stripBlockComments");
  const webapp = container.getPreset("webapp").dataSources;
  const CommandsSource = webapp.commands;
  const CommandEntry = CommandsSource.Entry;

  class CakephpCommandsSource extends CommandsSource {
    static Entry = CommandEntry;

    match(relPath) {
      return /Shell\.php$/.test(relPath)
        && relPath.includes("Console/Command/")
        && !/AppShell\.php$/.test(relPath);
    }

    parse(absPath) {
      const entry = new CommandEntry();
      const raw = fs.readFileSync(absPath, "utf8");
      const src = stripBlockComments(raw);

      const classMatch = src.match(/class\s+(\w+)\s+extends\s+(\w+)/);
      if (!classMatch) return entry;

      entry.className = classMatch[1];

      const methods = [];
      const fnRe = /public\s+function\s+(\w+)\s*\(/g;
      let fm;
      while ((fm = fnRe.exec(src)) !== null) {
        if (!fm[1].startsWith("_")) methods.push(fm[1]);
      }
      entry.publicMethods = methods;

      const appUses = [];
      const usesRe = /App::uses\s*\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
      let um;
      while ((um = usesRe.exec(raw)) !== null) {
        appUses.push({ class: um[1], package: um[2] });
      }
      entry.appUses = appUses;

      return entry;
    }

    deps(analysis, labels) {
      const rows = [];
      for (const s of analysis.commands?.entries || []) {
        for (const dep of s.appUses || []) {
          rows.push([s.className, dep.class, dep.package]);
        }
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    flow(analysis, labels) {
      const configEntries = analysis.config?.entries;
      if (!configEntries) return null;
      const items = configEntries.flatMap((e) => e.commandDetails || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (s) => [
        s.className,
        s.flowSteps.join(" → "),
        s.hasMail ? "あり" : "なし",
        s.hasFileOps ? "あり" : "なし",
        s.hasTransaction ? "あり" : "なし",
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpCommandsSource;
}

/**
 * CommandsSource — Symfony console commands DataSource.
 *
 * Extends webapp CommandsSource with Symfony-specific match/parse logic.
 *
 * Available methods (called via {{data}} directives):
 *   commands.list("Name|File|Description")   — inherited
 */

import fs from "fs";

export default function register(container) {
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const webapp = container.getPreset("webapp").dataSources;
  const CommandsSource = webapp.commands;
  const CommandEntry = CommandsSource.Entry;

  class SymfonyCommandsSource extends CommandsSource {
    static Entry = CommandEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "src/Command/") && relPath.endsWith(".php");
    }

    parse(absPath) {
      const entry = new CommandEntry();
      const content = fs.readFileSync(absPath, "utf8");

      const classMatch = content.match(/class\s+(\w+)\s+(?:extends\s+(\w+))?/);
      if (!classMatch) return entry;

      entry.className = classMatch[1];

      const methods = [];
      const fnRe = /public\s+function\s+(\w+)\s*\(/g;
      let fm;
      while ((fm = fnRe.exec(content)) !== null) {
        if (!fm[1].startsWith("_")) methods.push(fm[1]);
      }
      entry.publicMethods = methods;
      entry.appUses = [];

      return entry;
    }
  }

  return SymfonyCommandsSource;
}

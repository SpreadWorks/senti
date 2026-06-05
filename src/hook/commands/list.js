import { Command } from "../../lib/command.js";
import { listHooks } from "../../lib/hooks.js";

function formatTable(hooks) {
  const rows = [
    ["Name", "Description", "Placeholders", "Command"],
    ...hooks.map((hook) => [
      hook.name,
      hook.description,
      hook.placeholders.map((name) => `{{${name}}}`).join(", "),
      hook.command || "(not configured)",
    ]),
  ];
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)));
  return rows
    .map((row) => row.map((cell, col) => cell.padEnd(widths[col])).join("  ").trimEnd())
    .join("\n");
}

export default class HookListCommand extends Command {
  static outputMode = "raw";

  execute(ctx) {
    const hooks = listHooks(ctx.container.get("config") || {});
    if (ctx.json) {
      process.stdout.write(JSON.stringify(hooks, null, 2) + "\n");
    } else {
      process.stdout.write(formatTable(hooks) + "\n");
    }
  }
}

#!/usr/bin/env node
/**
 * src/check/commands/config.js
 *
 * senrail check config — config.json validation report.
 *
 * Runs three checks in order:
 *   1. File existence and JSON parse
 *   2. Schema validation (required fields, type constraints)
 *   3. Preset existence (type values must match known presets)
 */

import fs from "fs";
import { parseArgs } from "../../lib/cli.js";
import { managedConfigPath, validate } from "../../lib/config.js";
import { createPresetCatalog } from "../../lib/presets.js";
import { Command } from "../../lib/command.js";
import { EXIT_ERROR } from "../../lib/constants.js";

const MAX_SCHEMA_ERRORS = 50;

function printHelp() {
  console.log(
    [
      "Usage: senrail check config [options]",
      "",
      "Validate .senrail/config.json for required fields, preset existence,",
      "and schema consistency.",
      "",
      "Options:",
      "  --format <text|json>  Output format (default: text)",
      "  -h, --help            Show this help",
    ].join("\n")
  );
}

/**
 * Run all config checks and return check results.
 * Stops early if file or schema check fails.
 *
 * @param {string} root - repo root
 * @returns {{ name: string, result: "pass"|"fail", errors: string[] }[]}
 */
function runChecks(root) {
  const configPath = managedConfigPath(root);
  const checks = [];

  // Check 1: file existence + JSON parse
  if (!fs.existsSync(configPath)) {
    checks.push({ name: "file", result: "fail", errors: [`config.json not found: ${configPath}`] });
    return checks;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    checks.push({ name: "file", result: "fail", errors: [`Failed to parse config.json: ${err.message}`] });
    return checks;
  }
  checks.push({ name: "file", result: "pass", errors: [] });

  // Check 2: schema validation
  try {
    validate(raw);
    checks.push({ name: "schema", result: "pass", errors: [] });
  } catch (err) {
    const errors = err.message
      .replace(/^Config validation failed:\n/, "")
      .split(/\n\s*-\s*/)
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, MAX_SCHEMA_ERRORS);
    checks.push({ name: "schema", result: "fail", errors });
    return checks;
  }

  // Check 3: preset existence
  const types = Array.isArray(raw.type) ? raw.type : [raw.type];
  const presetCatalog = createPresetCatalog(root);
  const unknownPresets = types.filter((type) => !presetCatalog.has(type));

  if (unknownPresets.length > 0) {
    checks.push({
      name: "presets",
      result: "fail",
      errors: unknownPresets.map((t) => `Preset not found: ${t}`),
    });
  } else {
    checks.push({ name: "presets", result: "pass", errors: [] });
  }

  return checks;
}

async function runConfigCheck(rawArgs, container) {
  const cli = parseArgs(rawArgs, {
    options: ["--format"],
    defaults: { format: "text" },
  });

  if (cli.help) {
    printHelp();
    return;
  }

  const format = cli.format || "text";
  if (!["text", "json"].includes(format)) {
    process.stderr.write(`senrail check config: unknown format '${format}'. Use text or json.\n`);
    process.exit(EXIT_ERROR);
  }

  const root = container.get("root");
  const checks = runChecks(root);
  const ok = checks.every((c) => c.result === "pass");

  if (format === "json") {
    process.stdout.write(JSON.stringify({ ok, checks }, null, 2) + "\n");
    if (!ok) process.exit(EXIT_ERROR);
    return;
  }

  // text format
  if (ok) {
    process.stdout.write("config is valid\n");
  } else {
    for (const check of checks) {
      if (check.result === "fail") {
        for (const err of check.errors) {
          process.stderr.write(`  - ${err}\n`);
        }
      }
    }
    process.exit(EXIT_ERROR);
  }
}

export default class CheckConfigCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runConfigCheck(ctx._rawArgs || [], ctx.container);
  }
}

import { groupTestFilesByCategory } from "./test-runner-labels.js";
import { TestSelection, renderTestList, validateResolvedFiles } from "./test-selection.js";

export class TestRunner {
  constructor({ presetNames = [], resolveFiles, executeFiles, maxDepth = 32, maxFiles = 10000, maxRelativePath = 4096, maxJsonBytes = 16 * 1024 * 1024 }) {
    this.presetNames = presetNames;
    this.resolveFiles = resolveFiles;
    this.executeFiles = executeFiles;
    this.limits = { maxDepth, maxFiles, maxRelativePath, maxJsonBytes };
  }

  run(args) {
    let selection;
    try {
      selection = TestSelection.parse(args, { presetNames: this.presetNames });
      if (selection.mode === "help") return { exitCode: 0, stdout: usage(), stderr: "" };
      const files = validateResolvedFiles(this.resolveFiles(selection), this.limits);
      if (files.length === 0) throw new Error("No test files found");
      if (selection.list) return { exitCode: 0, stdout: JSON.stringify(renderTestList(selection, groupsFor(files), this.limits)), stderr: "" };
      return { exitCode: this.executeFiles(files) || 0, stdout: "", stderr: "" };
    } catch (error) {
      return { exitCode: 1, stdout: "", stderr: `Error: ${error.message}\n` };
    }
  }
}

function groupsFor(files) {
  const grouped = groupTestFilesByCategory(files.map((file) => `/${file}`));
  return [
    { category: "unit", files: grouped.unit.map(stripRoot) },
    { category: "integration", files: grouped.integration.map(stripRoot) },
    { category: "acceptance", files: grouped.acceptance.map(stripRoot) },
    { category: "other", files: grouped.other.map(stripRoot) },
  ];
}

function stripRoot(file) {
  return file.slice(1);
}

function usage() {
  return `Usage: node tests/run.js [--preset <name> | --scope <unit|e2e> | --agent | --all | --file <path> | --pattern <glob> | <path>...] [--list --json]\n`;
}

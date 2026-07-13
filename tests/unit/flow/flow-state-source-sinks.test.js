import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const srcRoot = path.join(repoRoot, "src");
const allowedOwner = path.join(srcRoot, "lib", "flow-state-atomic-writer.js");
const sinkCall = /\b(?:fs\.)?(?:writeFileSync|writeFile|renameSync|rename|copyFileSync|copyFile|openSync|writeJson|writeJsonFile)\s*\(\s*([^,\n)]+)/g;

function sourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(target);
  }
  return files;
}

function balancedFunctionBodies(source) {
  const bodies = [];
  const starts = /\b(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*[^{}]*\{|\b(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
  for (const match of source.matchAll(starts)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < source.length && depth > 0) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") depth -= 1;
      index += 1;
    }
    bodies.push(source.slice(match.index, index));
  }
  return bodies;
}

function flowPathVariables(body) {
  const variables = new Set();
  const assignment = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*(?:["'`]flow\.json["'`]|\bSTATE_FILE\b)/g;
  for (const match of body.matchAll(assignment)) variables.add(match[1]);
  return variables;
}

function directFlowStateSinks(filePath) {
  if (filePath === allowedOwner) return [];
  const source = fs.readFileSync(filePath, "utf8");
  const findings = [];
  for (const body of [source, ...balancedFunctionBodies(source)]) {
    const variables = flowPathVariables(body);
    for (const match of body.matchAll(sinkCall)) {
      const argument = match[1];
      const literal = /["'`]flow\.json["'`]/.test(argument);
      const tainted = [...variables].some((variable) => new RegExp(`\\b${variable}\\b`).test(argument));
      if (literal || tainted) findings.push(`${path.relative(repoRoot, filePath)}: ${match[0].trim()}`);
    }
  }
  return [...new Set(findings)];
}

test("all source flow.json write sinks are owned by the shared atomic writer", () => {
  const findings = sourceFiles(srcRoot).flatMap(directFlowStateSinks);
  assert.deepEqual(findings, [], `direct flow.json sinks:\n${findings.join("\n")}`);
});

/**
 * src/flow/lib/req-map.js
 *
 * Shared utilities for file-map.json and test-map.json:
 * load, save, append (with dedup), reconcile against git diff,
 * and evaluate per-requirement test results from TAP output.
 */

import fs from "node:fs";
import path from "node:path";
import { loadSpecJson, normalizeRequirements } from "../../lib/spec-json.js";

const FILE_MAP_NAME = "file-map.json";
const TEST_MAP_NAME = "test-map.json";

function loadJsonMap(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJsonMap(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function loadFileMap(specDir) {
  return loadJsonMap(path.join(specDir, FILE_MAP_NAME));
}

export function loadTestMap(specDir) {
  const testsDir = path.join(specDir, "tests");
  return loadJsonMap(path.join(testsDir, TEST_MAP_NAME));
}

export function isTestNotRequired(entry) {
  return entry === null;
}

export function appendFiles(specDir, reqId, paths, root, specPath) {
  const absSpecInput = path.isAbsolute(specPath) ? specPath : path.resolve(root, specPath);
  const spec = loadSpecJson(absSpecInput, { validate: false });
  const reqs = normalizeRequirements(spec.requirements);
  const validIds = new Set(reqs.map((r) => r.id));

  if (!validIds.has(reqId)) {
    const err = new Error(`requirement id not found: ${reqId}`);
    err.code = "INVALID_REQ_ID";
    throw err;
  }

  const mapPath = path.join(specDir, FILE_MAP_NAME);
  const map = loadJsonMap(mapPath);

  if (!Array.isArray(map[reqId])) {
    map[reqId] = [];
  }
  const existing = new Set(map[reqId]);
  for (const p of paths) {
    if (!existing.has(p)) {
      map[reqId].push(p);
      existing.add(p);
    }
  }

  saveJsonMap(mapPath, map);
  return map;
}

export function reconcileFileMap(fileMap, diffFiles) {
  const recorded = new Set();
  for (const paths of Object.values(fileMap)) {
    for (const p of paths) {
      recorded.add(p);
    }
  }
  return diffFiles.filter((f) => !recorded.has(f));
}

export function parseTapOutput(tap) {
  const results = new Map();
  for (const line of tap.split("\n")) {
    const match = line.match(/^\s*(ok|not ok)\s+\d+\s+-\s+(.+)$/);
    if (!match) continue;
    const status = match[1] === "ok";
    let name = match[2].trim();
    const dirIdx = name.indexOf(" # ");
    if (dirIdx !== -1) {
      const directive = name.slice(dirIdx + 3).trim().toUpperCase();
      if (directive.startsWith("SKIP")) continue;
      name = name.slice(0, dirIdx).trim();
    }
    results.set(name, status);
  }
  return results;
}

export function extractReqResults(tapResults) {
  const reqMap = new Map();
  for (const [name, passed] of tapResults) {
    const m = name.match(/^(R\d+)\b/);
    if (!m) continue;
    const id = m[1];
    if (!reqMap.has(id)) reqMap.set(id, { passed: 0, failed: 0 });
    const entry = reqMap.get(id);
    if (passed) entry.passed++;
    else entry.failed++;
  }
  return reqMap;
}

export function evaluateReqByResults(counts) {
  if (!counts) return "unverified";
  if (counts.passed > 0 && counts.failed === 0) return "done";
  if (counts.failed > 0 && counts.passed === 0) return "not_done";
  return "partial";
}

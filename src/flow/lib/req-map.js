/**
 * src/flow/lib/req-map.js
 *
 * Shared utilities for file-map.json: load, save, append (with dedup),
 * reconcile against git diff.
 *
 * spec 249: legacy test-map.json related exports were removed; spec
 * verification test coverage is now declared via file headers
 * (`// spec: R1 R2 ...`) — see src/flow/lib/test-headers.js.
 *
 * spec 251: TAP-output parsing helpers (parseTapOutput / extractReqResults /
 * evaluateReqByResults) were removed when retro switched to consuming
 * test-execute-result.json directly. No consumer remains.
 */

import fs from "node:fs";
import path from "node:path";
import { loadSpecJson, normalizeRequirements } from "../../lib/spec-json.js";

const FILE_MAP_NAME = "file-map.json";

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


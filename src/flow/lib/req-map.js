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

const FILE_MAP_NAME = "steps/impl/file-map.json";

function loadJsonMap(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadFileMap(specDir) {
  return loadJsonMap(path.join(specDir, FILE_MAP_NAME));
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

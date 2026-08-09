/**
 * src/flow/lib/retro-artifacts.js
 *
 * Helpers for reading retro artifacts into report input.
 */

import fs from "fs";
import path from "path";

function readJsonIfExists(filePath, sourceLabel) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`[senrail] ${sourceLabel}: failed to parse ${filePath}: ${err.message}`);
  }
}

export function readRetroResultIfExists(specDir, sourceLabel) {
  const retro = readJsonIfExists(path.join(specDir, "retro.json"), sourceLabel);
  if (!retro) return null;
  return {
    status: "done",
    summary: retro.summary,
    requirements: retro.requirements,
  };
}

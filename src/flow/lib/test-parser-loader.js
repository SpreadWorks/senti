/**
 * src/flow/lib/test-parser-loader.js
 *
 * Resolves the test-log parser for `flow run tests`. Presets may ship a
 * `test-parser.js` module in `src/presets/<key>/` that exports
 * `parseCountsFromLog(text) -> { unit?, integration?, acceptance? }`. When a
 * preset provides one, it is used; otherwise the builtin default parser is
 * returned.
 *
 * Contract (spec 200 REQ-6): parsers return only the keys they can detect.
 * Missing keys are omitted from the result so `test.summary` does not get
 * fabricated zeroes.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { parseCountsFromLog as builtinParseCountsFromLog } from "./test-log-parser.js";

export async function loadTestParser({ root, presetKey }) {
  if (presetKey) {
    const parserPath = path.join(root, "src", "presets", presetKey, "test-parser.js");
    if (fs.existsSync(parserPath)) {
      const mod = await import(pathToFileURL(parserPath).href);
      if (typeof mod.parseCountsFromLog === "function") {
        return { parseCountsFromLog: mod.parseCountsFromLog };
      }
    }
  }
  return { parseCountsFromLog: builtinParseCountsFromLog };
}

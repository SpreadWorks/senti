/**
 * src/flow/lib/set-files.js
 *
 * Record file-to-requirement mapping: flow set files <reqId> <path...>
 * Appends paths to file-map.json with deduplication.
 */

import path from "node:path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { appendFiles } from "./req-map.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";

export default class SetFilesCommand extends FlowCommand {
  execute(ctx) {
    const { reqId, paths } = ctx;

    if (!reqId || !paths || paths.length === 0) {
      return Envelope.fail("set", "files", "INVALID_USAGE", "usage: flow set files <reqId> <path...>");
    }

    const specPath = relativeFlowSpecFile(ctx.flowState);
    const specDir = resolveSpecDir(path.resolve(ctx.root, specPath));

    let map;
    try {
      map = appendFiles(specDir, reqId, paths, ctx.root, specPath);
    } catch (err) {
      if (err.code === "INVALID_REQ_ID") {
        return Envelope.fail("set", "files", "INVALID_REQ_ID", err.message);
      }
      throw err;
    }

    return { reqId, paths, map };
  }
}

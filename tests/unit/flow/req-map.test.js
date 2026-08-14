import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { loadFileMap } from "../../../src/flow/lib/req-map.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root = null;

afterEach(() => {
  if (root !== null) removeTmpDir(root);
  root = null;
});

test("impl review resolves the canonical shared file map and ignores the retired root path", () => {
  root = createTmpDir("canonical-req-map-");
  fs.mkdirSync(path.join(root, "steps", "impl"), { recursive: true });
  fs.writeFileSync(path.join(root, "file-map.json"), `${JSON.stringify({ R1: ["legacy.js"] })}\n`);
  fs.writeFileSync(
    path.join(root, "steps", "impl", "file-map.json"),
    `${JSON.stringify({ R1: ["src/current.js"] })}\n`,
  );

  assert.deepEqual(loadFileMap(root), { R1: ["src/current.js"] });
});

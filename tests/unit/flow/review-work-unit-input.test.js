import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { CanonicalReviewInputDescriptor } from "../../../src/flow/lib/review-work-unit-input.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root = null;

afterEach(() => {
  if (root !== null) removeTmpDir(root);
  root = null;
});

function descriptorFor(bytes) {
  root = createTmpDir("canonical-review-input-");
  const sourcePath = path.join(root, "inputs", "file-map.json");
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, bytes);
  return new CanonicalReviewInputDescriptor({
    version: 1,
    logicalKey: "file.map",
    logicalPath: "file-map.json",
    sourcePath,
    digest: crypto.createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  });
}

test("review work-unit input preserves the catalog digest and exact transient binding", () => {
  const bytes = Buffer.from('{"R-1":["src/mapped.js"]}\n', "utf8");
  const descriptor = descriptorFor(bytes);
  const loaded = CanonicalReviewInputDescriptor.fromEnvironment(JSON.stringify(descriptor), {
    variable: "SENNEL_REVIEW_FILE_MAP_SOURCE",
    logicalKey: "file.map",
    logicalPath: "file-map.json",
    workUnitDirectory: root,
  });

  assert.deepEqual(loaded.readJsonObject(), { "R-1": ["src/mapped.js"] });
  fs.writeFileSync(loaded.sourcePath, '{"R-1":["src/tampered.js"]}\n');
  assert.throws(() => loaded.readBytes(), /byteLength does not match|digest does not match/);
});

test("review work-unit input refuses a source path outside its typed inputs directory", () => {
  const descriptor = descriptorFor(Buffer.from("{}\n", "utf8"));
  const escaped = { ...descriptor.toJSON(), sourcePath: path.join(root, "file-map.json") };
  assert.throws(() => CanonicalReviewInputDescriptor.fromEnvironment(JSON.stringify(escaped), {
    variable: "SENNEL_REVIEW_FILE_MAP_SOURCE",
    logicalKey: "file.map",
    logicalPath: "file-map.json",
    workUnitDirectory: root,
  }), /source must be inputs/);
});

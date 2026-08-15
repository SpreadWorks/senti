import assert from "node:assert/strict";
import { test } from "node:test";

import { CanonicalFileMap } from "../../../src/flow/lib/canonical-file-map.js";
import { reconcileFileMap } from "../../../src/flow/lib/req-map.js";

test("canonical file-map keeps one typed requirement-to-file authority", () => {
  const fileMap = new CanonicalFileMap({
    R1: ["src/current.js", "src/current.js"],
  }).assertAgainstSpec({ requirements: [{ id: "R1" }] });

  assert.deepEqual(fileMap.toJSON(), { R1: ["src/current.js"] });
  assert.deepEqual(reconcileFileMap(fileMap.toJSON(), ["src/current.js", "src/unmapped.js"]), ["src/unmapped.js"]);
  assert.throws(
    () => new CanonicalFileMap({ R2: ["src/unknown.js"] }).assertAgainstSpec({ requirements: [{ id: "R1" }] }),
    /requirement id not found: R2/,
  );
  assert.throws(() => new CanonicalFileMap({ R1: ["../outside.js"] }), /repository-relative path/);
});

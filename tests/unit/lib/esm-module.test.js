import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EsmModule } from "../../../src/lib/esm-module.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

describe("EsmModule", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("loads ESM syntax from a package-less .js module", async () => {
    tmp = createTmpDir("senti-esm-module-");
    writeFile(tmp, "module.js", "export default 42;\n");
    const loaded = await new EsmModule(path.join(tmp, "module.js")).import();
    assert.equal(loaded.default, 42);
  });

  it("resolves relative imports from a package-less module", async () => {
    tmp = createTmpDir("senti-esm-module-");
    writeFile(tmp, "value.mjs", "export const value = 42;\n");
    writeFile(tmp, "module.js", "import { value } from './value.mjs'; export default value;\n");
    const loaded = await new EsmModule(path.join(tmp, "module.js")).import();
    assert.equal(loaded.default, 42);
  });

  it("preserves file import.meta.url inside a module package scope", async () => {
    tmp = createTmpDir("senti-esm-module-");
    writeJson(tmp, "package.json", { type: "module" });
    const modulePath = path.join(tmp, "module.js");
    writeFile(tmp, "module.js", "export default import.meta.url;\n");
    const loaded = await new EsmModule(modulePath).import();
    assert.equal(loaded.default, pathToFileURL(modulePath).href);
  });
});

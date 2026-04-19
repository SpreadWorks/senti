import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";

// MonorepoSource will be at src/presets/monorepo/data/monorepo.js
// Import dynamically after the file exists
let MonorepoSource;

async function loadModule() {
  if (!MonorepoSource) {
    const { container, initContainer } = await import("../../../../src/lib/container.js");
    initContainer();
    const mod = await import("../../../../src/presets/monorepo/data/monorepo.js");
    MonorepoSource = mod.default(container);
  }
  return MonorepoSource;
}

describe("MonorepoSource", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  async function createSource(configOverrides = {}) {
    const Source = await loadModule();
    const source = new Source();
    tmp = createTmpDir();
    const config = {
      lang: "ja",
      type: ["hono", "monorepo"],
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      ...configOverrides,
    };
    writeJson(tmp, ".sdd-forge/config.json", config);
    source.init({ root: tmp, desc: () => "—", loadOverrides: () => ({}) });
    return source;
  }

  describe("apps()", () => {
    it("returns badge text from config monorepo.apps definition", async () => {
      const source = await createSource({
        monorepo: {
          apps: [
            { name: "Frontend", path: "apps/frontend" },
            { name: "Backend CMS", path: "apps/backend" },
          ],
        },
      });

      const analysis = {
        enrichedAt: "2026-03-19T00:00:00Z",
        modules: {
          entries: [
            { file: "apps/frontend/src/App.tsx", chapter: "overview", app: "Frontend" },
            { file: "apps/backend/src/index.ts", chapter: "api_overview", app: "Backend CMS" },
          ],
        },
      };

      const result = source.apps(analysis, ["overview"]);
      assert.ok(result);
      assert.ok(result.includes("Frontend"));
    });

    it("returns badge text from enriched analysis app field when no config", async () => {
      const source = await createSource({});

      const analysis = {
        enrichedAt: "2026-03-19T00:00:00Z",
        modules: {
          entries: [
            { file: "apps/frontend/src/App.tsx", chapter: "overview", app: "Frontend" },
            { file: "apps/frontend/src/Header.tsx", chapter: "overview", app: "Frontend" },
            { file: "apps/backend/src/index.ts", chapter: "overview", app: "Backend CMS" },
          ],
        },
      };

      const result = source.apps(analysis, ["overview"]);
      assert.ok(result);
      assert.ok(result.includes("Frontend"));
      assert.ok(result.includes("Backend CMS"));
    });

    it("returns unique app names (no duplicates)", async () => {
      const source = await createSource({});

      const analysis = {
        enrichedAt: "2026-03-19T00:00:00Z",
        modules: {
          entries: [
            { file: "apps/web/src/A.tsx", chapter: "components", app: "Web" },
            { file: "apps/web/src/B.tsx", chapter: "components", app: "Web" },
            { file: "apps/web/src/C.tsx", chapter: "components", app: "Web" },
          ],
        },
      };

      const result = source.apps(analysis, ["components"]);
      assert.ok(result);
      // Should only mention "Web" once
      const count = (result.match(/Web/g) || []).length;
      assert.equal(count, 1);
    });

    it("returns null when no monorepo config and no app fields in analysis", async () => {
      const source = await createSource({});

      const analysis = {
        modules: {
          entries: [
            { file: "src/index.ts", chapter: "overview" },
          ],
        },
      };

      const result = source.apps(analysis, ["overview"]);
      assert.equal(result, null);
    });

    it("returns null when no entries match the chapter", async () => {
      const source = await createSource({});

      const analysis = {
        enrichedAt: "2026-03-19T00:00:00Z",
        modules: {
          entries: [
            { file: "apps/web/src/A.tsx", chapter: "components", app: "Web" },
          ],
        },
      };

      const result = source.apps(analysis, ["overview"]);
      assert.equal(result, null);
    });
  });
});

import { createTmpDir, writeJson, writeFile } from "./tmp-dir.js";
import { join } from "path";

const DEFAULT_CONFIG = {
  lang: "ja",
  type: "node-cli",
  scan: { include: ["src/**/*.js"], exclude: [] },
  providers: {},
  docs: { languages: ["ja"], defaultLanguage: "ja" },
};

const DEFAULT_PACKAGE = {
  name: "test-project",
  version: "1.0.0",
  type: "module",
};

export function createMockProject(overrides = {}) {
  const root = createTmpDir("senti-mock-");
  const cfg = { ...DEFAULT_CONFIG, ...overrides.config };
  const pkg = { ...DEFAULT_PACKAGE, ...overrides.package };

  writeJson(root, ".senti/config.json", cfg);
  writeJson(root, "package.json", pkg);
  writeFile(root, ".senti/output/.gitkeep");

  if (overrides.analysis) {
    writeJson(root, ".senti/output/analysis.json", overrides.analysis);
  }

  if (overrides.docs) {
    for (const [name, content] of Object.entries(overrides.docs)) {
      writeFile(root, join("docs", name), content);
    }
  }

  return root;
}

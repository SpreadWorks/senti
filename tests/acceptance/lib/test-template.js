/**
 * tests/acceptance/lib/test-template.js
 *
 * Shared test factory for acceptance tests.
 * Creates a standard test suite for a given preset.
 * Collects pipeline, directive, and quality data into a report JSON.
 */

import { describe, it } from "node:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { copyFixture, runPipeline, removeTmpDir } from "./pipeline.js";
import {
  assertStructure,
  detectUnfilledDirectives,
  detectExposedDirectives,
} from "./assertions.js";
import { verifyWithAI } from "./ai-verify.js";
import {
  AcceptanceHostAgentConfiguration,
  acceptanceHostRoot,
} from "./host-agent-config.js";

const PROJECT_ROOT = acceptanceHostRoot();

function resolveFixtureDir(presetName, opts) {
  const fixtureDir = opts?.fixtureDir;
  if (!fixtureDir) {
    throw new Error(`fixtureDir is required for acceptance preset: ${presetName}`);
  }
  if (fixtureDir instanceof URL) {
    return path.resolve(fileURLToPath(fixtureDir));
  }
  return path.resolve(String(fixtureDir));
}

export function writeReport(reportPath, report) {
  const dir = path.dirname(reportPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

export function persistReport(projectRoot, report) {
  const reportPath = path.join(
    projectRoot,
    ".sennel",
    "output",
    `acceptance-report-${report.preset}.json`,
  );
  writeReport(reportPath, report);
  return reportPath;
}

/**
 * Preserve fixture-specific docs and scan settings while running AI steps with
 * the test host's effective provider/profile selection.
 */
export function acceptanceFixtureConfigOverrides(configOverrides = {}, hostRoot = PROJECT_ROOT) {
  return {
    ...configOverrides,
    agent: AcceptanceHostAgentConfiguration.fromRoot(hostRoot).toFixtureAgent(),
  };
}

export function acceptanceTest(presetName, opts) {
  const { configOverrides } = opts || {};
  const fixtureDir = resolveFixtureDir(presetName, opts);

  describe(`acceptance: ${presetName}`, { timeout: 600000 }, () => {
    let tmp;

    it("pipeline completes and passes all checks", async () => {
      tmp = copyFixture(fixtureDir, acceptanceFixtureConfigOverrides(configOverrides));

      const { ctx, steps } = await runPipeline(tmp);

      const { files } = assertStructure(ctx.docsDir);
      const unfilled = detectUnfilledDirectives(ctx.docsDir, files);
      const exposed = detectExposedDirectives(ctx.docsDir, files);

      if (unfilled.length > 0) {
        console.log(`  [directives] ${unfilled.length} unfilled directive(s):`);
        for (const d of unfilled) {
          console.log(`    ${d.file}:${d.line}`);
        }
      }
      if (exposed.length > 0) {
        console.log(`  [directives] ${exposed.length} exposed directive(s):`);
        for (const d of exposed) {
          console.log(`    ${d.file}:${d.line}`);
        }
      }

      let quality = null;
      let aiError = null;
      try {
        const aiResult = await verifyWithAI(tmp, ctx.config, presetName);
        quality = aiResult.quality;
      } catch (e) {
        quality = e.quality || null;
        aiError = e;
      }

      const report = {
        preset: presetName,
        timestamp: new Date().toISOString(),
        pipeline: { steps },
        directives: { unfilled, exposed },
        quality,
      };

      const reportPath = path.join(
        tmp,
        ".sennel",
        "output",
        "acceptance-report.json",
      );
      writeReport(reportPath, report);
      console.log(`  [report] written to ${reportPath}`);

      const persistPath = persistReport(PROJECT_ROOT, report);
      console.log(`  [report] persisted to ${persistPath}`);

      if (aiError) throw aiError;
    });

    it("cleanup", () => {
      if (tmp) {
        removeTmpDir(tmp);
        tmp = null;
      }
    });
  });
}

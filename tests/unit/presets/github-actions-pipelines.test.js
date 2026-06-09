import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Sample workflow YAML files
// ---------------------------------------------------------------------------

const SIMPLE_WORKFLOW = `name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
`;

const DEPLOY_WORKFLOW = `name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploying"
    env:
      NODE_ENV: production
`;

const SECRETS_WORKFLOW = `name: Release
on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm publish
        env:
          NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          APP_ENV: \${{ env.APP_ENV }}
`;

const SCHEDULE_WORKFLOW = `name: Nightly
on:
  schedule:
    - cron: "0 0 * * *"

jobs:
  cleanup:
    runs-on: ubuntu-22.04
    steps:
      - run: echo "cleanup"
`;

const NO_NAME_WORKFLOW = `on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
`;

const EMPTY_WORKFLOW = ``;

const NO_JOBS_WORKFLOW = `name: Empty
on: push
`;

// ---------------------------------------------------------------------------
// Parse workflow tests
// ---------------------------------------------------------------------------

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function setupProject(workflows) {
  tmp = createTmpDir("ci-test-");
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });
  const wfDir = path.join(tmp, ".github", "workflows");
  fs.mkdirSync(wfDir, { recursive: true });
  for (const [name, content] of Object.entries(workflows)) {
    writeFile(tmp, `.github/workflows/${name}`, content);
  }
  return tmp;
}

describe("github-actions preset: scan/workflows.js", async () => {
  // Dynamic import after file creation
  const { parseWorkflow } = await import(
    "../../../src/presets/github-actions/tests/analyzers.js"
  );

  describe("parseWorkflow", () => {
    it("extracts name, triggers, jobs from simple workflow", () => {
      const result = parseWorkflow(SIMPLE_WORKFLOW, "ci.yml");
      assert.equal(result.name, "CI");
      assert.equal(result.file, "ci.yml");
      assert.equal(result.platform, "github-actions");
      assert.ok(result.triggers.some((t) => t.includes("push")));
      assert.ok(result.triggers.some((t) => t.includes("pull_request")));
      assert.equal(result.jobs.length, 1);
      assert.equal(result.jobs[0].id, "build");
      assert.equal(result.jobs[0].runner, "ubuntu-latest");
      assert.ok(result.jobs[0].steps >= 4);
      assert.ok(result.jobs[0].dependencies.includes("actions/checkout@v4"));
      assert.ok(result.jobs[0].dependencies.includes("actions/setup-node@v4"));
    });

    it("handles multiple jobs", () => {
      const result = parseWorkflow(DEPLOY_WORKFLOW, "deploy.yml");
      assert.equal(result.name, "Deploy");
      assert.equal(result.jobs.length, 2);
      const jobIds = result.jobs.map((j) => j.id);
      assert.ok(jobIds.includes("build"));
      assert.ok(jobIds.includes("deploy"));
    });

    it("extracts secrets and env references", () => {
      const result = parseWorkflow(SECRETS_WORKFLOW, "release.yml");
      assert.ok(result.secrets.includes("NPM_TOKEN"));
      assert.ok(result.secrets.includes("GITHUB_TOKEN"));
      assert.ok(result.envVars.includes("APP_ENV"));
    });

    it("handles schedule trigger", () => {
      const result = parseWorkflow(SCHEDULE_WORKFLOW, "nightly.yml");
      assert.ok(result.triggers.some((t) => t.includes("schedule")));
      assert.equal(result.jobs[0].runner, "ubuntu-22.04");
    });

    it("uses filename as fallback when name is missing", () => {
      const result = parseWorkflow(NO_NAME_WORKFLOW, "test.yml");
      assert.equal(result.name, "test.yml");
    });

    it("returns empty jobs for workflow without jobs section", () => {
      const result = parseWorkflow(NO_JOBS_WORKFLOW, "empty.yml");
      assert.equal(result.name, "Empty");
      assert.equal(result.jobs.length, 0);
    });

    it("handles empty file", () => {
      const result = parseWorkflow(EMPTY_WORKFLOW, "empty.yml");
      assert.equal(result.name, "empty.yml");
      assert.equal(result.jobs.length, 0);
      assert.equal(result.triggers.length, 0);
    });
  });

  // scanWorkflows (directory-level scanner) removed — scan pipeline now uses per-file parse()
});

// ---------------------------------------------------------------------------
// DataSource tests
// ---------------------------------------------------------------------------

describe("github-actions preset: data/pipelines.js", async () => {
  const { container, initContainer } = await import("../../../src/lib/container.js");
  initContainer();
  const registerPipelines = (await import("../../../src/presets/github-actions/data/pipelines.js")).default;
  const PipelinesSource = registerPipelines(container);

  const MOCK_ANALYSIS = {
    pipelines: {
      pipelines: [
        {
          file: ".github/workflows/ci.yml",
          name: "CI",
          platform: "github-actions",
          triggers: ["push (main)", "pull_request (main)"],
          jobs: [
            { id: "build", runner: "ubuntu-latest", steps: 4, dependencies: ["actions/checkout@v4"] },
            { id: "lint", runner: "ubuntu-latest", steps: 2, dependencies: [] },
          ],
          envVars: ["NODE_ENV"],
          secrets: ["NPM_TOKEN"],
        },
      ],
      summary: { total: 1, totalJobs: 2 },
    },
  };

  const EMPTY_ANALYSIS = {
    pipelines: { pipelines: [], summary: { total: 0, totalJobs: 0 } },
  };

  function createSource() {
    const source = new PipelinesSource();
    source.init({ desc: () => "—", loadOverrides: () => ({}) });
    return source;
  }

  describe("list", () => {
    it("generates pipeline summary table", () => {
      const source = createSource();
      const result = source.list(MOCK_ANALYSIS, ["Name", "File", "Triggers", "Jobs"]);
      assert.ok(result);
      assert.ok(result.toMarkdown().includes("CI"));
      assert.ok(result.toMarkdown().includes("ci.yml"));
    });

    it("returns null for empty pipelines", () => {
      const source = createSource();
      const result = source.list(EMPTY_ANALYSIS, ["Name", "File", "Triggers", "Jobs"]);
      assert.equal(result, null);
    });
  });

  describe("jobs", () => {
    it("generates job detail table", () => {
      const source = createSource();
      const result = source.jobs(MOCK_ANALYSIS, ["Pipeline", "Job", "Runner", "Steps", "Dependencies"]);
      assert.ok(result);
      assert.ok(result.toMarkdown().includes("build"));
      assert.ok(result.toMarkdown().includes("lint"));
      assert.ok(result.toMarkdown().includes("ubuntu-latest"));
    });

    it("returns null for empty pipelines", () => {
      const source = createSource();
      const result = source.jobs(EMPTY_ANALYSIS, ["Pipeline", "Job", "Runner", "Steps", "Dependencies"]);
      assert.equal(result, null);
    });
  });

  describe("env", () => {
    it("generates secrets/env table", () => {
      const source = createSource();
      const result = source.env(MOCK_ANALYSIS, ["Pipeline", "Secrets", "Env Vars"]);
      assert.ok(result);
      assert.ok(result.toMarkdown().includes("NPM_TOKEN"));
      assert.ok(result.toMarkdown().includes("NODE_ENV"));
    });

    it("returns null when no secrets or env vars", () => {
      const source = createSource();
      const noEnvAnalysis = {
        pipelines: {
          pipelines: [
            { file: "ci.yml", name: "CI", triggers: [], jobs: [], envVars: [], secrets: [] },
          ],
          summary: { total: 1, totalJobs: 0 },
        },
      };
      const result = source.env(noEnvAnalysis, ["Pipeline", "Secrets", "Env Vars"]);
      assert.equal(result, null);
    });
  });
});

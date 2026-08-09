import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PRODUCT, ProductIdentity } from "../../src/lib/product.js";

describe("ProductIdentity", () => {
  it("owns canonical product namespaces", () => {
    assert.equal(PRODUCT.displayName, "Senrail");
    assert.equal(PRODUCT.machineName, "senrail");
    assert.equal(PRODUCT.packageName, "senrail");
    assert.equal(PRODUCT.repository, "SpreadWorks/senrail");
    assert.equal(PRODUCT.entrypoint, "src/senrail.js");
    assert.equal(PRODUCT.entrypointBasename, "senrail.js");
    assert.equal(PRODUCT.managedDirName, ".senrail");
    assert.equal(PRODUCT.envPrefix, "SENRAIL_");
    assert.equal(PRODUCT.skillNamespace, "senrail.");
    assert.equal(PRODUCT.repositoryUrl, "https://github.com/SpreadWorks/senrail.git");
    assert.equal(PRODUCT.officialPresetsRepository, "SpreadWorks/senrail-presets");
    assert.equal(PRODUCT.workflowPluginRepository, "SpreadWorks/senrail-workflow-plugin");
    assert.equal(PRODUCT.officialPresetsRepositoryUrl, "https://github.com/SpreadWorks/senrail-presets.git");
    assert.equal(PRODUCT.workflowPluginRepositoryUrl, "https://github.com/SpreadWorks/senrail-workflow-plugin.git");
  });

  it("derives product-owned protocol, environment, and Git namespaces", () => {
    assert.equal(PRODUCT.env("WORK_ROOT"), "SENRAIL_WORK_ROOT");
    assert.equal(PRODUCT.managedPath("output", "analysis.json"), ".senrail/output/analysis.json");
    assert.equal(PRODUCT.skill("flow"), "senrail.flow");
    assert.equal(PRODUCT.artifactMarker("outbox"), "senrail-outbox");
    assert.equal(PRODUCT.protocol("migration-reservation", "v1"), "senrail-migration-reservation-v1");
    assert.equal(PRODUCT.hashSalt("token-metrics-input", "v1"), "senrail-token-metrics-input-v1\0");
    assert.equal(PRODUCT.temporaryPrefix("repair-git"), "senrail-repair-git-");
    assert.equal(PRODUCT.flowBaselineRef("run-1"), "refs/senrail/flows/run-1/baseline");
    assert.equal(PRODUCT.githubUrl(PRODUCT.officialRepository("presets")), PRODUCT.officialPresetsRepositoryUrl);
    assert.equal(PRODUCT.githubUrl(PRODUCT.officialRepository("workflow-plugin")), PRODUCT.workflowPluginRepositoryUrl);
    assert.ok(PRODUCT instanceof ProductIdentity);
  });

  it("matches package metadata and repository-facing README identity", () => {
    const packageJson = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    const readme = fs.readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const japaneseReadme = fs.readFileSync(new URL("../../docs/ja/README.md", import.meta.url), "utf8");
    const englishUi = JSON.parse(fs.readFileSync(new URL("../../src/locale/en/ui.json", import.meta.url), "utf8"));
    const japaneseUi = JSON.parse(fs.readFileSync(new URL("../../src/locale/ja/ui.json", import.meta.url), "utf8"));

    assert.equal(packageJson.name, PRODUCT.packageName);
    assert.equal(packageJson.displayName, PRODUCT.displayName);
    assert.deepEqual(packageJson.bin, { [PRODUCT.machineName]: `./${PRODUCT.entrypoint}` });
    assert.equal(packageJson.exports["."], `./${PRODUCT.entrypoint}`);
    assert.equal(packageJson.repository.url, PRODUCT.repositoryUrl);
    assert.match(readme, new RegExp(`^# ${PRODUCT.displayName}$`, "m"));
    assert.ok(japaneseReadme.startsWith(`# <!-- {{data("cli.project.name")}} -->${PRODUCT.displayName}<!-- {{/data}} -->\n`));
    assert.doesNotMatch(readme, /@spreadworks\/senrail/i);
    assert.doesNotMatch(japaneseReadme, /@spreadworks\/senrail/i);
    assert.match(englishUi.setup.title, new RegExp(`^${PRODUCT.displayName}\\b`));
    assert.match(japaneseUi.setup.title, new RegExp(`^${PRODUCT.displayName}\\b`));
  });

  it("rejects incomplete or structurally invalid identities", () => {
    const valid = {
      displayName: "Example",
      machineName: "example",
      packageName: "example",
      repository: "owner/example",
      entrypoint: "src/example.js",
    };

    assert.throws(() => new ProductIdentity({ ...valid, machineName: "" }), /machineName must be a non-empty string/);
    assert.throws(() => new ProductIdentity({ ...valid, machineName: "Example" }), /lowercase package identifier/);
    assert.throws(() => new ProductIdentity({ ...valid, packageName: "Example" }), /lowercase package identifier/);
    assert.throws(() => new ProductIdentity({ ...valid, repository: "example" }), /owner\/repository pair/);
    assert.throws(() => new ProductIdentity({ ...valid, entrypoint: "bin/example.js" }), /src\/ path/);
  });
});

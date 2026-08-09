import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT, ProductIdentity } from "../../src/lib/product.js";

describe("ProductIdentity", () => {
  it("owns canonical product namespaces", () => {
    assert.equal(PRODUCT.displayName, "Senrail");
    assert.equal(PRODUCT.machineName, "senrail");
    assert.equal(PRODUCT.packageName, "senrail");
    assert.equal(PRODUCT.repository, "SpreadWorks/senrail");
    assert.equal(PRODUCT.entrypoint, "src/senrail.js");
    assert.equal(PRODUCT.managedDirName, ".senrail");
    assert.equal(PRODUCT.skillNamespace, "senrail.");
  });

  it("derives product-owned protocol, environment, and Git namespaces", () => {
    assert.equal(PRODUCT.env("WORK_ROOT"), "SENRAIL_WORK_ROOT");
    assert.equal(PRODUCT.managedPath("output", "analysis.json"), ".senrail/output/analysis.json");
    assert.equal(PRODUCT.artifactMarker("outbox"), "senrail-outbox");
    assert.equal(PRODUCT.protocol("migration-reservation", "v1"), "senrail-migration-reservation-v1");
    assert.equal(PRODUCT.hashSalt("token-metrics-input", "v1"), "senrail-token-metrics-input-v1\0");
    assert.equal(PRODUCT.temporaryPrefix("repair-git"), "senrail-repair-git-");
    assert.equal(PRODUCT.flowBaselineRef("run-1"), "refs/senrail/flows/run-1/baseline");
    assert.equal(PRODUCT.githubUrl(PRODUCT.officialRepository("presets")), "https://github.com/SpreadWorks/senrail-presets.git");
    assert.equal(PRODUCT.githubUrl(PRODUCT.officialRepository("workflow-plugin")), "https://github.com/SpreadWorks/senrail-workflow-plugin.git");
    assert.ok(PRODUCT instanceof ProductIdentity);
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

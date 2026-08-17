import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

const WORKTREE = process.cwd();
const SYMFONY_JA = join(WORKTREE, "src/presets/symfony/templates/ja/guardrail.json");
const SYMFONY_EN = join(WORKTREE, "src/presets/symfony/templates/en/guardrail.json");
const CODING_RULE_JA = join(WORKTREE, "src/presets/coding-rule/templates/ja/guardrail.json");
const CODING_RULE_EN = join(WORKTREE, "src/presets/coding-rule/templates/en/guardrail.json");

function loadGuardrails(path) {
  return JSON.parse(readFileSync(path, "utf8")).guardrails;
}

// ---------------------------------------------------------------------------
// Symfony guardrail.json
// ---------------------------------------------------------------------------

describe("Symfony guardrail.json", () => {
  const jaGuardrails = loadGuardrails(SYMFONY_JA);
  const enGuardrails = loadGuardrails(SYMFONY_EN);

  it("has 38 total guardrails (4 existing + 34 new)", () => {
    assert.equal(jaGuardrails.length, 38);
    assert.equal(enGuardrails.length, 38);
  });

  it("preserves existing 4 guardrails", () => {
    const existingIds = ["use-parameterized-queries", "service", "voter", "dto"];
    const jaIds = jaGuardrails.map((g) => g.id);
    for (const id of existingIds) {
      assert.ok(jaIds.includes(id), `missing existing guardrail: ${id}`);
    }
  });

  it("has all required new spec-phase guardrails", () => {
    const specIds = [
      "no-bundle-for-app-code",
      "env-vars-for-infra-only",
      "use-messenger-for-async",
      "ux-package-selection-criteria",
      "live-component-performance-design",
      "stable-public-interfaces",
      "use-enums-for-fixed-values",
    ];
    const jaIds = jaGuardrails.map((g) => g.id);
    for (const id of specIds) {
      assert.ok(jaIds.includes(id), `missing spec guardrail: ${id}`);
      const g = jaGuardrails.find((x) => x.id === id);
      assert.ok(g.meta.phase.includes("spec"), `${id} should have spec phase`);
    }
  });

  it("has all required new impl-phase guardrails", () => {
    const implIds = [
      "constructor-injection-only",
      "forms-as-php-classes",
      "avoid-raw-filter",
      "snake-case-templates",
      "key-based-translations",
      "doctrine-attribute-mapping",
      "schema-changes-via-migrations",
      "use-asset-mapper",
      "single-firewall-preferred",
      "stimulus-controller-name-match",
      "stimulus-no-dom-assumption-on-connect",
      "turbo-frame-id-match",
      "turbo-cache-js-reinit",
      "turbo-stream-redirect-loss",
      "twig-component-prop-leak",
      "live-prop-required-for-state",
      "live-prop-no-complex-objects",
      "ux-icons-lock-before-deploy",
      "ux-map-height-required",
    ];
    const jaIds = jaGuardrails.map((g) => g.id);
    for (const id of implIds) {
      assert.ok(jaIds.includes(id), `missing impl guardrail: ${id}`);
      const g = jaGuardrails.find((x) => x.id === id);
      assert.ok(g.meta.phase.includes("impl"), `${id} should have impl phase`);
    }
  });

  it("has all required impl+review guardrails", () => {
    const dualIds = [
      "no-container-get",
      "no-direct-form-building-in-controller",
      "trans-filter-required",
    ];
    const jaIds = jaGuardrails.map((g) => g.id);
    for (const id of dualIds) {
      assert.ok(jaIds.includes(id), `missing dual guardrail: ${id}`);
      const g = jaGuardrails.find((x) => x.id === id);
      assert.ok(g.meta.phase.includes("impl"), `${id} should have impl phase`);
      assert.ok(g.meta.phase.includes("review"), `${id} should have review phase`);
    }
  });

  it("has all required review-only guardrails", () => {
    const reviewIds = [
      "detect-raw-filter-usage",
      "detect-stimulus-name-mismatch",
      "detect-turbo-frame-id-mismatch",
      "detect-live-prop-state-dependency",
      "verify-ux-icons-lock",
    ];
    const jaIds = jaGuardrails.map((g) => g.id);
    for (const id of reviewIds) {
      assert.ok(jaIds.includes(id), `missing review guardrail: ${id}`);
      const g = jaGuardrails.find((x) => x.id === id);
      assert.ok(g.meta.phase.includes("review"), `${id} should have review phase`);
    }
  });

  it("ja and en have matching ids", () => {
    const jaIds = jaGuardrails.map((g) => g.id).sort();
    const enIds = enGuardrails.map((g) => g.id).sort();
    assert.deepEqual(jaIds, enIds);
  });

  it("all entries have required fields", () => {
    for (const g of jaGuardrails) {
      assert.ok(g.id, `guardrail missing id`);
      assert.ok(g.title, `${g.id} missing title`);
      assert.ok(g.body, `${g.id} missing body`);
      assert.ok(Array.isArray(g.meta.phase), `${g.id} missing phase array`);
      assert.ok(g.meta.phase.length > 0, `${g.id} has empty phase array`);
    }
  });

  it("UX guardrails have conditional prefix in body", () => {
    const uxIds = [
      "ux-package-selection-criteria",
      "live-component-performance-design",
      "stimulus-controller-name-match",
      "stimulus-no-dom-assumption-on-connect",
      "turbo-frame-id-match",
      "turbo-cache-js-reinit",
      "turbo-stream-redirect-loss",
      "twig-component-prop-leak",
      "live-prop-required-for-state",
      "live-prop-no-complex-objects",
      "ux-icons-lock-before-deploy",
      "ux-map-height-required",
      "detect-stimulus-name-mismatch",
      "detect-turbo-frame-id-mismatch",
      "detect-live-prop-state-dependency",
      "verify-ux-icons-lock",
    ];
    for (const id of uxIds) {
      const g = jaGuardrails.find((x) => x.id === id);
      assert.ok(g, `missing UX guardrail: ${id}`);
      assert.ok(
        /を(使用する|採用している)/.test(g.body),
        `${id} body should contain conditional prefix: ${g.body.slice(0, 50)}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// coding-rule guardrail.json
// ---------------------------------------------------------------------------

describe("coding-rule guardrail.json", () => {
  const jaGuardrails = loadGuardrails(CODING_RULE_JA);
  const enGuardrails = loadGuardrails(CODING_RULE_EN);

  it("has 5 total guardrails (3 existing + 2 new)", () => {
    assert.equal(jaGuardrails.length, 5);
    assert.equal(enGuardrails.length, 5);
  });

  it("preserves existing 3 guardrails", () => {
    const existingIds = ["no-weakening-security", "no-unnecessary-indirection", "spec-includes-design-rationale"];
    const jaIds = jaGuardrails.map((g) => g.id);
    for (const id of existingIds) {
      assert.ok(jaIds.includes(id), `missing existing guardrail: ${id}`);
    }
  });

  it("has new strict-comparison-only and no-else-after-return", () => {
    const jaIds = jaGuardrails.map((g) => g.id);
    assert.ok(jaIds.includes("strict-comparison-only"));
    assert.ok(jaIds.includes("no-else-after-return"));
  });

  it("ja and en have matching ids", () => {
    const jaIds = jaGuardrails.map((g) => g.id).sort();
    const enIds = enGuardrails.map((g) => g.id).sort();
    assert.deepEqual(jaIds, enIds);
  });
});

// ---------------------------------------------------------------------------
// NOTICE file
// ---------------------------------------------------------------------------

describe("Symfony NOTICE file", () => {
  it("exists and references all three sources", () => {
    const notice = readFileSync(
      join(WORKTREE, "src/presets/symfony/NOTICE"),
      "utf8"
    );
    assert.ok(notice.includes("awesome-copilot"));
    assert.ok(notice.includes("symfony-ux-skills"));
    assert.ok(notice.includes("EasyAdminBundle"));
    assert.ok(notice.includes("MIT"));
    assert.ok(notice.includes("inspired"));
  });
});

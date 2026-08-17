import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUARDRAIL_PATH = resolve(__dirname, "../../../src/presets/nextjs/guardrail.json");
const NOTICE_PATH = resolve(__dirname, "../../../src/presets/nextjs/NOTICE");

const EXPECTED_NEW_IDS = [
  "server-components-by-default",
  "route-handler-vs-server-action",
  "use-nextjs-optimized-components",
  "await-async-request-apis",
  "suspense-boundary-for-search-params",
  "parallel-route-default-required",
  "error-boundary-client-component",
  "no-dynamic-ssr-false-in-server-components",
  "no-route-page-coexistence",
];

const EXISTING_IDS = [
  "no-server-code-in-client-bundle",
  "audit-next-public-env-vars",
  "verify-against-official-docs",
];

describe("nextjs guardrail.json spec verification", () => {
  let guardrails;

  it("loads guardrail.json without error", () => {
    const raw = readFileSync(GUARDRAIL_PATH, "utf8");
    const data = JSON.parse(raw);
    guardrails = data.guardrails;
    assert.ok(Array.isArray(guardrails));
  });

  it("has exactly 12 entries (3 existing + 9 new)", () => {
    assert.equal(guardrails.length, 12);
  });

  it("preserves all 3 existing guardrails", () => {
    const ids = guardrails.map((g) => g.id);
    for (const id of EXISTING_IDS) {
      assert.ok(ids.includes(id), `existing guardrail missing: ${id}`);
    }
  });

  it("includes all 9 new guardrails", () => {
    const ids = guardrails.map((g) => g.id);
    for (const id of EXPECTED_NEW_IDS) {
      assert.ok(ids.includes(id), `new guardrail missing: ${id}`);
    }
  });

  it("each entry has required fields: id, title, body, meta.phase", () => {
    for (const g of guardrails) {
      assert.ok(typeof g.id === "string" && g.id.length > 0, `missing id: ${JSON.stringify(g)}`);
      assert.ok(typeof g.title === "string" && g.title.length > 0, `missing title: ${g.id}`);
      assert.ok(typeof g.body === "string" && g.body.length > 0, `missing body: ${g.id}`);
      assert.ok(g.meta && Array.isArray(g.meta.phase) && g.meta.phase.length > 0, `missing meta.phase: ${g.id}`);
    }
  });

  it("await-async-request-apis body mentions Next.js 15", () => {
    const g = guardrails.find((g) => g.id === "await-async-request-apis");
    assert.ok(g, "await-async-request-apis not found");
    assert.ok(
      g.body.includes("Next.js 15"),
      `body should mention "Next.js 15", got: ${g.body}`
    );
  });
});

describe("nextjs NOTICE file spec verification", () => {
  let notice;

  it("NOTICE file exists and is readable", () => {
    notice = readFileSync(NOTICE_PATH, "utf8");
    assert.ok(notice.length > 0);
  });

  it("NOTICE lists all 9 new guardrail article names", () => {
    const expectedTitles = [
      "Server Components by Default",
      "Route Handler vs Server Action",
      "Use Next.js Optimized Components",
      "Await Async Request APIs",
      "Suspense Boundary for useSearchParams",
      "Parallel Route Slots Require default.tsx",
      "error.tsx Must Be Client Component",
      "No dynamic() with ssr:false in Server Components",
      "No route.ts and page.tsx Coexistence",
    ];
    for (const title of expectedTitles) {
      assert.ok(notice.includes(title), `NOTICE missing article: ${title}`);
    }
  });

  it("NOTICE includes both source licenses", () => {
    assert.ok(notice.includes("github/awesome-copilot"), "NOTICE missing github/awesome-copilot");
    assert.ok(notice.includes("PatrickJS/awesome-cursorrules"), "NOTICE missing PatrickJS/awesome-cursorrules");
    assert.ok(notice.includes("MIT"), "NOTICE missing MIT license");
    assert.ok(notice.includes("CC0"), "NOTICE missing CC0 license");
  });
});

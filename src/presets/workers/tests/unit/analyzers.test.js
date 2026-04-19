import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import { analyzeBindings } from "../analyzers.js";

describe("Workers analyzeBindings — wrangler.toml with KV, R2, D1 bindings", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses KV namespaces", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[[kv_namespaces]]
binding = "MY_KV"
id = "abc123"

[[kv_namespaces]]
binding = "SESSIONS"
id = "def456"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 2);
    assert.equal(result.bindings[0].name, "MY_KV");
    assert.equal(result.bindings[0].type, "KV Namespace");
    assert.equal(result.bindings[0].id, "abc123");
    assert.equal(result.bindings[1].name, "SESSIONS");
    assert.equal(result.summary.totalBindings, 2);
  });

  it("parses R2 buckets", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket-prod"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0].name, "MY_BUCKET");
    assert.equal(result.bindings[0].type, "R2 Bucket");
    assert.equal(result.bindings[0].id, "my-bucket-prod");
  });

  it("parses D1 databases", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[[d1_databases]]
binding = "DB"
database_id = "xxxx-yyyy-zzzz"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0].name, "DB");
    assert.equal(result.bindings[0].type, "D1 Database");
    assert.equal(result.bindings[0].id, "xxxx-yyyy-zzzz");
  });

  it("parses service bindings", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[[services]]
binding = "AUTH_SERVICE"
service = "auth-worker"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0].name, "AUTH_SERVICE");
    assert.equal(result.bindings[0].type, "Service");
    assert.equal(result.bindings[0].id, "auth-worker");
  });

  it("parses Durable Object bindings", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[durable_objects]

[[durable_objects.bindings]]
name = "COUNTER"
class_name = "CounterObject"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0].name, "COUNTER");
    assert.equal(result.bindings[0].type, "Durable Object");
    assert.equal(result.bindings[0].id, "CounterObject");
  });

  it("parses mixed binding types", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[[kv_namespaces]]
binding = "CACHE"
id = "kv-001"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "assets-bucket"

[[d1_databases]]
binding = "DB"
database_id = "d1-001"

[[services]]
binding = "API"
service = "api-worker"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 4);
    assert.equal(result.summary.totalBindings, 4);
    const types = result.bindings.map((b) => b.type);
    assert.ok(types.includes("KV Namespace"));
    assert.ok(types.includes("R2 Bucket"));
    assert.ok(types.includes("D1 Database"));
    assert.ok(types.includes("Service"));
  });
});

describe("Workers analyzeBindings — env vars", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses string env vars from [vars] section", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[vars]
API_KEY = "secret-key"
ENVIRONMENT = "production"
MAX_RETRIES = 3
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.env.length, 3);
    assert.equal(result.summary.totalEnvVars, 3);

    const apiKey = result.env.find((e) => e.name === "API_KEY");
    assert.ok(apiKey);
    assert.equal(apiKey.value, "secret-key");
    assert.equal(apiKey.type, "string");

    const maxRetries = result.env.find((e) => e.name === "MAX_RETRIES");
    assert.ok(maxRetries);
    assert.equal(maxRetries.value, "3");
    assert.equal(maxRetries.type, "number");
  });

  it("returns empty env when no vars section", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.env.length, 0);
  });
});

describe("Workers analyzeBindings — entry points and cron triggers", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses main entry point", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.entryPoints.length, 1);
    assert.equal(result.entryPoints[0].path, "src/index.ts");
    assert.equal(result.entryPoints[0].trigger, "fetch");
    assert.equal(result.entryPoints[0].file, "src/index.ts");
    assert.equal(result.summary.totalEntryPoints, 1);
  });

  it("parses route patterns", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
routes = ["example.com/api/*", "example.com/health"]
`);
    const result = analyzeBindings(tmp);
    // 1 main + 2 routes
    assert.equal(result.entryPoints.length, 3);
    const routeEntries = result.entryPoints.filter((e) => e.trigger === "route");
    assert.equal(routeEntries.length, 2);
    assert.equal(routeEntries[0].route, "example.com/api/*");
    assert.equal(routeEntries[1].route, "example.com/health");
  });

  it("parses single route string", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
route = "example.com/*"
`);
    const result = analyzeBindings(tmp);
    const routeEntries = result.entryPoints.filter((e) => e.trigger === "route");
    assert.equal(routeEntries.length, 1);
    assert.equal(routeEntries[0].route, "example.com/*");
  });

  it("parses cron triggers", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"

[triggers]
crons = ["*/5 * * * *", "0 0 * * *"]
`);
    const result = analyzeBindings(tmp);
    const cronEntries = result.entryPoints.filter((e) => e.trigger === "cron");
    assert.equal(cronEntries.length, 2);
    assert.equal(cronEntries[0].route, "*/5 * * * *");
    assert.equal(cronEntries[1].route, "0 0 * * *");
  });

  it("parses combined entry points, routes, and crons", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
routes = ["example.com/api/*"]

[triggers]
crons = ["0 * * * *"]
`);
    const result = analyzeBindings(tmp);
    // 1 main + 1 route + 1 cron
    assert.equal(result.entryPoints.length, 3);
    assert.equal(result.summary.totalEntryPoints, 3);
  });
});

describe("Workers analyzeBindings — constraints", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses compatibility_date", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-09-23"
`);
    const result = analyzeBindings(tmp);
    const dateCon = result.constraints.find((c) => c.name === "compatibility_date");
    assert.ok(dateCon);
    assert.equal(dateCon.value, "2024-09-23");
  });

  it("parses compatibility_flags", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
compatibility_flags = ["nodejs_compat", "streams_enable_constructors"]
`);
    const result = analyzeBindings(tmp);
    const flagsCon = result.constraints.find((c) => c.name === "compatibility_flags");
    assert.ok(flagsCon);
    assert.equal(flagsCon.value, "nodejs_compat, streams_enable_constructors");
  });

  it("parses node_compat", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "my-worker"
main = "src/index.ts"
node_compat = true
`);
    const result = analyzeBindings(tmp);
    const nodeCompat = result.constraints.find((c) => c.name === "node_compat");
    assert.ok(nodeCompat);
    assert.equal(nodeCompat.value, "true");
  });
});

describe("Workers analyzeBindings — wrangler.json format", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses JSON config with bindings and vars", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.json", JSON.stringify({
      name: "my-worker",
      main: "src/index.ts",
      compatibility_date: "2024-09-23",
      kv_namespaces: [{ binding: "KV", id: "kv-001" }],
      d1_databases: [{ binding: "DB", database_id: "d1-001" }],
      vars: { NODE_ENV: "production" },
      triggers: { crons: ["0 * * * *"] },
    }));
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 2);
    assert.equal(result.env.length, 1);
    assert.equal(result.env[0].name, "NODE_ENV");
    // 1 main + 1 cron
    assert.equal(result.entryPoints.length, 2);
    assert.equal(result.constraints.length, 1);
  });

  it("parses wrangler.jsonc with comments", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.jsonc", `{
  // This is a comment
  "name": "my-worker",
  "main": "src/index.ts",
  // Another comment
  "kv_namespaces": [
    { "binding": "CACHE", "id": "kv-cache" }
  ]
}
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0].name, "CACHE");
    assert.equal(result.bindings[0].type, "KV Namespace");
  });

  it("prefers wrangler.toml over wrangler.json when both exist", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "toml-worker"
main = "src/index.ts"

[[kv_namespaces]]
binding = "FROM_TOML"
id = "toml-id"
`);
    writeFile(tmp, "wrangler.json", JSON.stringify({
      name: "json-worker",
      main: "src/index.ts",
      kv_namespaces: [{ binding: "FROM_JSON", id: "json-id" }],
    }));
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings[0].name, "FROM_TOML");
  });
});

describe("Workers analyzeBindings — empty/missing config", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty result when no wrangler file exists", () => {
    tmp = createTmpDir();
    const result = analyzeBindings(tmp);
    assert.deepEqual(result.bindings, []);
    assert.deepEqual(result.env, []);
    assert.deepEqual(result.entryPoints, []);
    assert.deepEqual(result.constraints, []);
    assert.equal(result.summary.totalBindings, 0);
    assert.equal(result.summary.totalEnvVars, 0);
    assert.equal(result.summary.totalEntryPoints, 0);
  });

  it("returns empty arrays when wrangler.toml has no bindings", () => {
    tmp = createTmpDir();
    writeFile(tmp, "wrangler.toml", `name = "minimal-worker"
main = "src/index.ts"
`);
    const result = analyzeBindings(tmp);
    assert.equal(result.bindings.length, 0);
    assert.equal(result.env.length, 0);
    // Only main entry point
    assert.equal(result.entryPoints.length, 1);
  });
});

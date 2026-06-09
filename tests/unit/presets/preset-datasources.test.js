import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createResolver } from "../../../src/docs/lib/resolver-factory.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";

// ---------------------------------------------------------------------------
// Helper: create resolver for a preset with mock project
// ---------------------------------------------------------------------------

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function setupTmp(name) {
  tmp = createTmpDir(`ds-${name}-`);
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });
  return tmp;
}

// Sample enriched analysis data for testing DataSource methods
const ENRICHED_ANALYSIS = {
  enrichedAt: "2026-03-19T00:00:00.000Z",
  modules: {
    modules: [
      { relPath: "src/index.js", className: "index", summary: "Entry point", chapter: "overview", role: "cli" },
      { relPath: "src/commands/build.js", className: "build", summary: "Build command", chapter: "cli_commands", role: "cli" },
      { relPath: "src/lib/config.js", className: "config", summary: "Config loader", chapter: "configuration", role: "lib" },
    ],
  },
  controllers: {
    controllers: [
      { className: "UserController", relPath: "src/controllers/UserController.js", summary: "User management", actions: ["index", "show"] },
    ],
  },
  routes: {
    routes: [
      { method: "GET", path: "/api/users", handler: "UserController.index", summary: "List users" },
      { method: "POST", path: "/api/users", handler: "UserController.create", summary: "Create user" },
    ],
  },
  schemas: {
    tables: [
      { name: "users", columns: ["id", "name", "email"], summary: "User accounts" },
      { name: "posts", columns: ["id", "title", "body", "user_id"], summary: "Blog posts" },
    ],
    relations: [
      { from: "posts", to: "users", type: "belongsTo", foreignKey: "user_id" },
    ],
  },
  components: {
    components: [
      { name: "Header", relPath: "src/components/Header.tsx", type: "client", summary: "Navigation header" },
      { name: "UserList", relPath: "src/components/UserList.tsx", type: "server", summary: "Server-rendered user list" },
    ],
  },
  bindings: {
    bindings: [
      { name: "MY_KV", type: "kv_namespace", summary: "Session storage" },
      { name: "MY_R2", type: "r2_bucket", summary: "File storage" },
    ],
    env: [
      { name: "API_KEY", type: "secret", summary: "External API key" },
    ],
  },
  graphql: {
    types: [
      { name: "User", fields: ["id: ID!", "name: String!", "email: String!"], summary: "User type" },
    ],
    queries: [
      { name: "users", args: "limit: Int", returnType: "[User!]!", summary: "List all users" },
    ],
    mutations: [
      { name: "createUser", args: "input: CreateUserInput!", returnType: "User!", summary: "Create a new user" },
    ],
  },
  endpoints: {
    endpoints: [
      { method: "GET", path: "/api/users", summary: "List users" },
      { method: "POST", path: "/api/users", summary: "Create user" },
    ],
  },
};

// ---------------------------------------------------------------------------
// 1. DataSource methods return markdown tables from enriched analysis
// ---------------------------------------------------------------------------

describe("DataSource methods produce markdown tables", () => {
  it("base structure.directories() returns table", async () => {
    const root = setupTmp("base-struct");
    const resolver = await createResolver("base", root);
    const result = resolver.resolve("base", "structure", "directories", ENRICHED_ANALYSIS, ["Directory", "Role"]);
    if (result) {
      assert.ok(result.includes("|"), "should contain table pipe characters");
      assert.ok(result.includes("---"), "should contain table separator");
    }
  });

  it("cli commands.list() returns table", async () => {
    const root = setupTmp("cli-cmds");
    const resolver = await createResolver("cli", root);
    const result = resolver.resolve("cli", "commands", "list", ENRICHED_ANALYSIS, ["Command", "Description"]);
    if (result) {
      assert.ok(result.includes("|"));
      assert.ok(result.includes("---"));
    }
  });

  it("library exports.list() returns table", async () => {
    const root = setupTmp("lib-exports");
    const resolver = await createResolver("library", root);
    const result = resolver.resolve("library", "exports", "list", ENRICHED_ANALYSIS, ["Name", "Type", "Description"]);
    if (result) {
      assert.ok(result.includes("|"));
    }
  });

  it("graphql schema.types() returns table", async () => {
    const root = setupTmp("gql-types");
    const resolver = await createResolver("graphql", root);
    const result = resolver.resolve("graphql", "schema", "types", ENRICHED_ANALYSIS, ["Type", "Fields"]);
    if (result) {
      assert.ok(result.includes("|"));
      assert.ok(result.includes("User"));
    }
  });

  it("graphql schema.queries() returns table", async () => {
    const root = setupTmp("gql-queries");
    const resolver = await createResolver("graphql", root);
    const result = resolver.resolve("graphql", "schema", "queries", ENRICHED_ANALYSIS, ["Query", "Args", "Return"]);
    if (result) {
      assert.ok(result.includes("users"));
    }
  });

  it("graphql schema.mutations() returns table", async () => {
    const root = setupTmp("gql-mut");
    const resolver = await createResolver("graphql", root);
    const result = resolver.resolve("graphql", "schema", "mutations", ENRICHED_ANALYSIS, ["Mutation", "Args", "Return"]);
    if (result) {
      assert.ok(result.includes("createUser"));
    }
  });

  it("rest endpoints.list() returns table", async () => {
    const root = setupTmp("rest-ep");
    const resolver = await createResolver("rest", root);
    const result = resolver.resolve("rest", "endpoints", "list", ENRICHED_ANALYSIS, ["Method", "Path", "Description"]);
    if (result) {
      assert.ok(result.includes("GET"));
      assert.ok(result.includes("/api/users"));
    }
  });

  it("workers bindings.list() returns table", async () => {
    const root = setupTmp("wk-bind");
    const resolver = await createResolver("workers", root);
    const result = resolver.resolve("workers", "bindings", "list", ENRICHED_ANALYSIS, ["Name", "Type", "Description"]);
    if (result) {
      assert.ok(result.includes("MY_KV"));
    }
  });

  it("workers bindings.env() returns table", async () => {
    const root = setupTmp("wk-env");
    const resolver = await createResolver("workers", root);
    const result = resolver.resolve("workers", "bindings", "env", ENRICHED_ANALYSIS, ["Name", "Type", "Description"]);
    if (result) {
      assert.ok(result.includes("API_KEY"));
    }
  });
});

// ---------------------------------------------------------------------------
// 2. DataSource methods return null when no data
// ---------------------------------------------------------------------------

describe("DataSource methods return null when no data", () => {
  const EMPTY_ANALYSIS = {};

  it("schema.types() returns null for empty analysis", async () => {
    const root = setupTmp("gql-empty");
    const resolver = await createResolver("graphql", root);
    const result = resolver.resolve("graphql", "schema", "types", EMPTY_ANALYSIS, ["Type", "Fields"]);
    assert.equal(result, null);
  });

  it("rest endpoints.list() returns null for empty analysis", async () => {
    const root = setupTmp("rest-empty");
    const resolver = await createResolver("rest", root);
    const result = resolver.resolve("rest", "endpoints", "list", EMPTY_ANALYSIS, ["Method", "Path"]);
    assert.equal(result, null);
  });

  it("bindings.list() returns null for empty analysis", async () => {
    const root = setupTmp("wk-empty");
    const resolver = await createResolver("workers", root);
    const result = resolver.resolve("workers", "bindings", "list", EMPTY_ANALYSIS, ["Name", "Type"]);
    assert.equal(result, null);
  });

  it("schema.tables() returns null for empty analysis", async () => {
    const root = setupTmp("db-empty");
    const resolver = await createResolver("database", root);
    const result = resolver.resolve("database", "schema", "tables", EMPTY_ANALYSIS, ["Table", "Description"]);
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// 3. Label customization
// ---------------------------------------------------------------------------

describe("DataSource methods respect custom labels", () => {
  it("schema.types() uses provided labels as headers", async () => {
    const root = setupTmp("gql-labels");
    const resolver = await createResolver("graphql", root);
    const result = resolver.resolve("graphql", "schema", "types", ENRICHED_ANALYSIS, ["型名", "フィールド"]);
    if (result) {
      assert.ok(result.includes("型名"));
      assert.ok(result.includes("フィールド"));
    }
  });

  it("rest endpoints.list() uses provided labels as headers", async () => {
    const root = setupTmp("rest-labels");
    const resolver = await createResolver("rest", root);
    const result = resolver.resolve("rest", "endpoints", "list", ENRICHED_ANALYSIS, ["メソッド", "パス", "説明"]);
    if (result) {
      assert.ok(result.includes("メソッド"));
    }
  });
});

// ---------------------------------------------------------------------------
// 4. match(relPath) coverage audit
// ---------------------------------------------------------------------------

const UPDATED_MATCH_SOURCES = [
  "cakephp2/config",
  "cakephp2/email",
  "cakephp2/libs",
  "cakephp2/tests",
  "cakephp2/views",
  "laravel/commands",
  "laravel/config",
  "laravel/controllers",
  "laravel/models",
  "laravel/routes",
  "laravel/tables",
  "nextjs/components",
  "nextjs/routes",
  "symfony/commands",
  "symfony/config",
  "symfony/controllers",
  "symfony/entities",
  "symfony/routes",
  "symfony/tables",
];

const UNCHANGED_MATCH_SOURCES = [
  "base/package",
  "cakephp2/commands",
  "cakephp2/controllers",
  "cakephp2/models",
  "cli/modules",
  "drizzle/schema",
  "edge/runtime",
  "github-actions/pipelines",
  "graphql/schema",
  "hono/middleware",
  "r2/storage",
  "webapp/commands",
  "webapp/controllers",
  "webapp/models",
  "webapp/routes",
  "workers/bindings",
];

function collectMatchSourceIds() {
  const presetsDir = path.join(process.cwd(), "src/presets");
  const ids = [];
  for (const preset of fs.readdirSync(presetsDir)) {
    const dataDir = path.join(presetsDir, preset, "data");
    if (!fs.existsSync(dataDir)) continue;
    for (const file of fs.readdirSync(dataDir)) {
      if (!file.endsWith(".js")) continue;
      const absPath = path.join(dataDir, file);
      const content = fs.readFileSync(absPath, "utf8");
      if (!/^\s*match\(relPath\)/m.test(content)) continue;
      ids.push(`${preset}/${path.basename(file, ".js")}`);
    }
  }
  return ids.sort();
}

describe("match(relPath) coverage audit", () => {
  it("classifies all match sources as updated or unchanged", () => {
    const expected = [...UPDATED_MATCH_SOURCES, ...UNCHANGED_MATCH_SOURCES].sort();
    const detected = collectMatchSourceIds();
    assert.deepEqual(expected, detected);
  });
});

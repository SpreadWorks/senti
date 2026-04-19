import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { container, initContainer } from "../../../src/lib/container.js";
import { loadDataSources } from "../../../src/docs/lib/data-source-loader.js";

initContainer();
// Factory-form presets (e.g. cakephp2 leaves) may call container.getPreset("webapp").
// Pre-load webapp's data/ so its classes are registered before we invoke factories below.
const __dirname = path.dirname(new URL(import.meta.url).pathname);
await loadDataSources(path.resolve(__dirname, "../../../src/presets/webapp/data"), { presetKey: "webapp" });

import cakephp2Config from "../../../src/presets/cakephp2/data/config.js";
import cakephp2Email from "../../../src/presets/cakephp2/data/email.js";
import cakephp2Libs from "../../../src/presets/cakephp2/data/libs.js";
import cakephp2Tests from "../../../src/presets/cakephp2/data/tests.js";
import cakephp2Views from "../../../src/presets/cakephp2/data/views.js";

import laravelCommands from "../../../src/presets/laravel/data/commands.js";
import laravelConfig from "../../../src/presets/laravel/data/config.js";
import laravelControllers from "../../../src/presets/laravel/data/controllers.js";
import laravelModels from "../../../src/presets/laravel/data/models.js";
import laravelRoutes from "../../../src/presets/laravel/data/routes.js";
import laravelTables from "../../../src/presets/laravel/data/tables.js";

import nextjsComponents from "../../../src/presets/nextjs/data/components.js";
import nextjsRoutes from "../../../src/presets/nextjs/data/routes.js";

import symfonyCommands from "../../../src/presets/symfony/data/commands.js";
import symfonyConfig from "../../../src/presets/symfony/data/config.js";
import symfonyControllers from "../../../src/presets/symfony/data/controllers.js";
import symfonyEntities from "../../../src/presets/symfony/data/entities.js";
import symfonyRoutes from "../../../src/presets/symfony/data/routes.js";
import symfonyTables from "../../../src/presets/symfony/data/tables.js";

const CASES = [
  ["cakephp2/config", cakephp2Config, "app/Config/bootstrap.php", "packages/shop/app/Config/bootstrap.php"],
  ["cakephp2/email", cakephp2Email, "app/View/Emails/text/welcome.ctp", "packages/shop/app/View/Emails/text/welcome.ctp"],
  ["cakephp2/libs", cakephp2Libs, "app/Lib/Utils/Formatter.php", "packages/shop/app/Lib/Utils/Formatter.php"],
  ["cakephp2/tests", cakephp2Tests, "app/Test/Case/Model/UserTest.php", "packages/shop/app/Test/Case/Model/UserTest.php"],
  ["cakephp2/views", cakephp2Views, "app/View/Users/index.ctp", "packages/shop/app/View/Users/index.ctp"],
  ["laravel/commands", laravelCommands, "app/Console/Commands/CleanupCommand.php", "apps/api/app/Console/Commands/CleanupCommand.php"],
  ["laravel/config", laravelConfig, "config/app.php", "apps/api/config/app.php"],
  ["laravel/controllers", laravelControllers, "app/Http/Controllers/UserController.php", "apps/api/app/Http/Controllers/UserController.php"],
  ["laravel/models", laravelModels, "app/Models/User.php", "apps/api/app/Models/User.php"],
  ["laravel/routes", laravelRoutes, "routes/web.php", "apps/api/routes/web.php"],
  ["laravel/tables", laravelTables, "database/migrations/2024_01_01_000000_create_users_table.php", "apps/api/database/migrations/2024_01_01_000000_create_users_table.php"],
  ["nextjs/components", nextjsComponents, "app/components/Button.tsx", "packages/web/app/components/Button.tsx"],
  ["nextjs/routes", nextjsRoutes, "app/users/page.tsx", "packages/web/app/users/page.tsx"],
  ["symfony/commands", symfonyCommands, "src/Command/CleanupCommand.php", "apps/backend/src/Command/CleanupCommand.php"],
  ["symfony/config", symfonyConfig, "config/services.yaml", "apps/backend/config/services.yaml"],
  ["symfony/controllers", symfonyControllers, "src/Controller/UserController.php", "apps/backend/src/Controller/UserController.php"],
  ["symfony/entities", symfonyEntities, "src/Entity/User.php", "apps/backend/src/Entity/User.php"],
  ["symfony/routes", symfonyRoutes, "config/routes.yaml", "apps/backend/config/routes.yaml"],
  ["symfony/tables", symfonyTables, "migrations/Version20240101000000.php", "apps/backend/migrations/Version20240101000000.php"],
];

const NEGATIVE_CASES = [
  ["cakephp2/views", cakephp2Views, "packages/shop/app/ViewX/Users/index.ctp"],
  ["laravel/controllers", laravelControllers, "apps/api/app/Http/ControllerX/UserController.php"],
  ["nextjs/routes", nextjsRoutes, "packages/web/appx/users/page.tsx"],
  ["symfony/controllers", symfonyControllers, "apps/backend/src/ControllerX/UserController.php"],
  ["symfony/entities", symfonyEntities, "apps/backend/src/EntityX/User.php"],
];

const UPDATED_SOURCES = [
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

const UNCHANGED_SOURCES = [
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

function createSource(source) {
  if (source && typeof source.match === "function") return source;
  if (typeof source === "function") {
    const isClass = /^\s*class\b/.test(Function.prototype.toString.call(source));
    const Cls = isClass ? source : source(container);
    return new Cls();
  }
  throw new TypeError("unsupported DataSource export");
}

function collectMatchSourceIds() {
  const presetsDir = path.resolve("src/presets");
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

describe("preset match() supports monorepo nested paths", () => {
  it("keeps nested path matches equivalent to root-level positive samples", () => {
    for (const [name, source, rootPath, nestedPath] of CASES) {
      const dataSource = createSource(source);
      assert.equal(dataSource.match(rootPath), true, `${name}: root sample must match`);
      assert.equal(dataSource.match(nestedPath), true, `${name}: nested monorepo path must also match`);
    }
  });

  it("rejects look-alike non-target segments", () => {
    for (const [name, source, invalidPath] of NEGATIVE_CASES) {
      const dataSource = createSource(source);
      assert.equal(dataSource.match(invalidPath), false, `${name}: look-alike path must not match`);
    }
  });

  it("covers all presets with match(relPath) and documents unchanged sources", () => {
    const detected = collectMatchSourceIds();
    const classified = [...UPDATED_SOURCES, ...UNCHANGED_SOURCES].sort();
    assert.deepEqual(classified, detected, "updated + unchanged source list must cover all match(relPath) definitions");
  });
});

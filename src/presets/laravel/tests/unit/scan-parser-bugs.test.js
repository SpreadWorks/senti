import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import { analyzeRoutes, analyzeConfig } from "../analyzers.js";

const PRESETS_DIR = join(import.meta.dirname, "..", "..", "..");

describe("Route::resource URI parameters (R1)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("adds {thread} parameter to show/edit/update/destroy URIs", () => {
    tmp = createTmpDir();
    writeFile(tmp, "routes/web.php", `<?php
Route::resource('threads', ThreadController::class);
`);
    const result = analyzeRoutes(tmp);
    const show = result.routes.find((r) => r.action === "show");
    assert.equal(show.uri, "/threads/{thread}");
    const edit = result.routes.find((r) => r.action === "edit");
    assert.equal(edit.uri, "/threads/{thread}/edit");
    const update = result.routes.find((r) => r.action === "update");
    assert.equal(update.uri, "/threads/{thread}");
    const destroy = result.routes.find((r) => r.action === "destroy");
    assert.equal(destroy.uri, "/threads/{thread}");
    const index = result.routes.find((r) => r.action === "index");
    assert.equal(index.uri, "/threads");
  });

  it("adds {thread} parameter to apiResource URIs", () => {
    tmp = createTmpDir();
    writeFile(tmp, "routes/api.php", `<?php
Route::apiResource('threads', ThreadController::class);
`);
    const result = analyzeRoutes(tmp);
    const show = result.routes.find((r) => r.action === "show");
    assert.equal(show.uri, "/api/threads/{thread}");
    const destroy = result.routes.find((r) => r.action === "destroy");
    assert.equal(destroy.uri, "/api/threads/{thread}");
  });
});

describe("Route::resource only/except (R2)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("only() limits actions to specified list", () => {
    tmp = createTmpDir();
    writeFile(tmp, "routes/web.php", `<?php
Route::resource('threads', ThreadController::class)->only(['index', 'show']);
`);
    const result = analyzeRoutes(tmp);
    const actions = result.routes.map((r) => r.action);
    assert.deepEqual(actions.sort(), ["index", "show"]);
  });

  it("except() excludes specified actions", () => {
    tmp = createTmpDir();
    writeFile(tmp, "routes/web.php", `<?php
Route::resource('threads', ThreadController::class)->except(['destroy']);
`);
    const result = analyzeRoutes(tmp);
    const actions = result.routes.map((r) => r.action);
    assert.ok(!actions.includes("destroy"));
    assert.equal(actions.length, 6); // 7 - 1
  });
});

describe("Nested resource routes (R3)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("expands threads.posts to nested URI", () => {
    tmp = createTmpDir();
    writeFile(tmp, "routes/web.php", `<?php
Route::resource('threads.posts', PostController::class);
`);
    const result = analyzeRoutes(tmp);
    const index = result.routes.find((r) => r.action === "index");
    assert.equal(index.uri, "/threads/{thread}/posts");
    const show = result.routes.find((r) => r.action === "show");
    assert.equal(show.uri, "/threads/{thread}/posts/{post}");
  });
});

describe("Laravel 11 middleware via bootstrap/app.php (R4)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses withMiddleware append/alias/group", () => {
    tmp = createTmpDir();
    writeFile(tmp, "bootstrap/app.php", `<?php
use Illuminate\\Foundation\\Application;
use Illuminate\\Foundation\\Configuration\\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware \$middleware) {
        \$middleware->append(TrustProxies::class);
        \$middleware->alias([
            'auth' => Authenticate::class,
            'verified' => EnsureEmailIsVerified::class,
        ]);
        \$middleware->group('web', [
            EncryptCookies::class,
            StartSession::class,
        ]);
    })
    ->create();
`);
    const result = analyzeConfig(tmp);
    assert.ok(result.middlewareRegistration);
    assert.ok(result.middlewareRegistration.global.length > 0);
    assert.ok(Object.keys(result.middlewareRegistration.aliases).length > 0);
    assert.ok(result.middlewareRegistration.groups.web);
  });
});

describe("Laravel 10 Kernel.php middleware (R5)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses $middlewareGroups and $middlewareAliases", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/Http/Kernel.php", `<?php
namespace App\\Http;

use Illuminate\\Foundation\\Http\\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    protected \$middleware = [
        TrustProxies::class,
        HandleCors::class,
    ];

    protected \$middlewareGroups = [
        'web' => [
            EncryptCookies::class,
            StartSession::class,
        ],
        'api' => [
            ThrottleRequests::class,
        ],
    ];

    protected \$middlewareAliases = [
        'auth' => Authenticate::class,
        'guest' => RedirectIfAuthenticated::class,
    ];
}
`);
    const result = analyzeConfig(tmp);
    assert.ok(result.middlewareRegistration);
    assert.equal(result.middlewareRegistration.global.length, 2);
    assert.ok(result.middlewareRegistration.groups.web);
    assert.equal(result.middlewareRegistration.groups.web.length, 2);
    assert.ok(result.middlewareRegistration.groups.api);
    assert.ok(result.middlewareRegistration.aliases.auth);
    assert.ok(result.middlewareRegistration.aliases.guest);
  });

  it("returns empty when neither file exists", () => {
    tmp = createTmpDir();
    const result = analyzeConfig(tmp);
    assert.deepEqual(result.middlewareRegistration, { global: [], groups: {}, aliases: {} });
  });
});

describe("Symfony business_logic.md template override (R6)", () => {
  it("symfony ja template overrides model-relations block with entities.relations", () => {
    const templatePath = join(PRESETS_DIR, "symfony/templates/ja/business_logic.md");
    const content = readFileSync(templatePath, "utf8");
    assert.ok(content.includes('{%extends%}'));
    assert.ok(content.includes('{%block "model-relations"%}'));
    assert.ok(content.includes('symfony.entities.relations'));
    assert.ok(!content.includes('webapp.models.relations'));
  });

  it("symfony en template overrides model-relations block with entities.relations", () => {
    const templatePath = join(PRESETS_DIR, "symfony/templates/en/business_logic.md");
    const content = readFileSync(templatePath, "utf8");
    assert.ok(content.includes('{%extends%}'));
    assert.ok(content.includes('{%block "model-relations"%}'));
    assert.ok(content.includes('symfony.entities.relations'));
    assert.ok(!content.includes('webapp.models.relations'));
  });
});

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import {
  analyzeControllers,
  analyzeModels,
  analyzeRoutes,
  analyzeMigrations,
  analyzeConfig,
} from "../analyzers.js";

describe("Laravel analyze-controllers", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses controller class", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/Http/Controllers/UserController.php", `<?php
namespace App\\Http\\Controllers;

class UserController extends Controller
{
    public function __construct(UserService \$service)
    {
        \$this->middleware('auth');
    }

    public function index() {}
    public function show(\$id) {}
    public function store(Request \$request) {}
}
`);
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 1);
    assert.equal(result.controllers[0].className, "UserController");
    assert.deepEqual(result.controllers[0].actions, ["index", "show", "store"]);
    assert.deepEqual(result.controllers[0].diDeps, ["UserService"]);
    assert.deepEqual(result.controllers[0].middleware, ["auth"]);
  });

  it("returns empty when no controllers dir", () => {
    tmp = createTmpDir();
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 0);
  });

  it("scans nested directories", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/Http/Controllers/Api/PostController.php", `<?php
class PostController extends Controller
{
    public function index() {}
}
`);
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 1);
    assert.match(result.controllers[0].file, /Api/);
  });
});

describe("Laravel analyze-models", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses Eloquent model", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/Models/Post.php", `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class Post extends Model
{
    protected \$table = 'blog_posts';
    protected \$fillable = ['title', 'body', 'user_id'];
    protected \$casts = ['published_at' => 'datetime'];

    public function user()
    {
        return \$this->belongsTo(User::class);
    }

    public function comments()
    {
        return \$this->hasMany(Comment::class);
    }

    public function scopePublished(\$query)
    {
        return \$query->whereNotNull('published_at');
    }

    public function getTitleAttribute(\$value)
    {
        return ucfirst(\$value);
    }
}
`);
    const result = analyzeModels(tmp);
    assert.equal(result.summary.total, 1);
    const model = result.models[0];
    assert.equal(model.className, "Post");
    assert.equal(model.tableName, "blog_posts");
    assert.deepEqual(model.fillable, ["title", "body", "user_id"]);
    assert.deepEqual(model.casts, { published_at: "datetime" });
    assert.ok(model.relations.belongsTo);
    assert.equal(model.relations.belongsTo[0].model, "User");
    assert.ok(model.relations.hasMany);
    assert.equal(model.relations.hasMany[0].model, "Comment");
    assert.deepEqual(model.scopes, ["Published"]);
    assert.deepEqual(model.accessors, ["Title"]);
  });

  it("infers table name from class name", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/Models/User.php", `<?php
namespace App\\Models;
use Illuminate\\Database\\Eloquent\\Model;
class User extends Model
{
    use HasFactory;
}
`);
    const result = analyzeModels(tmp);
    assert.equal(result.models[0].tableName, "users");
  });

  it("returns empty when no models dir", () => {
    tmp = createTmpDir();
    const result = analyzeModels(tmp);
    assert.equal(result.summary.total, 0);
  });
});

describe("Laravel analyze-routes", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses web.php and api.php routes", () => {
    tmp = createTmpDir();
    writeFile(tmp, "routes/web.php", `<?php
Route::get('/', [HomeController::class, 'index']);
Route::post('/login', 'AuthController@login');
`);
    writeFile(tmp, "routes/api.php", `<?php
Route::get('/users', [UserController::class, 'index']);
Route::apiResource('posts', PostController::class);
`);

    const result = analyzeRoutes(tmp);
    assert.ok(result.summary.total > 0);
    assert.ok(result.summary.webRoutes > 0);
    assert.ok(result.summary.apiRoutes > 0);

    // Check web route
    const homeRoute = result.routes.find((r) => r.uri === "/" && r.routeType === "web");
    assert.ok(homeRoute);
    assert.equal(homeRoute.controller, "HomeController");

    // Check API resource routes
    const apiRoutes = result.routes.filter((r) => r.routeType === "api");
    assert.ok(apiRoutes.length > 1);
  });

  it("returns empty when no route files", () => {
    tmp = createTmpDir();
    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.total, 0);
  });
});

describe("Laravel analyze-migrations", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses create table migration", () => {
    tmp = createTmpDir();
    writeFile(tmp, "database/migrations/2024_01_01_000000_create_users_table.php", `<?php
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint \$table) {
            \$table->id();
            \$table->string('name');
            \$table->string('email')->unique();
            \$table->timestamp('email_verified_at')->nullable();
            \$table->string('password');
            \$table->rememberToken();
            \$table->timestamps();
        });
    }
};
`);

    const result = analyzeMigrations(tmp);
    assert.equal(result.summary.total, 1);
    const users = result.tables[0];
    assert.equal(users.name, "users");
    assert.ok(users.columns.length >= 5);
    // Check specific columns
    const nameCol = users.columns.find((c) => c.name === "name");
    assert.ok(nameCol);
    assert.equal(nameCol.type, "string");
    const emailVerified = users.columns.find((c) => c.name === "email_verified_at");
    assert.ok(emailVerified);
    assert.equal(emailVerified.nullable, true);
  });

  it("parses foreign keys", () => {
    tmp = createTmpDir();
    writeFile(tmp, "database/migrations/2024_01_02_000000_create_posts_table.php", `<?php
Schema::create('posts', function (Blueprint \$table) {
    \$table->id();
    \$table->string('title');
    \$table->foreignId('user_id')->constrained();
    \$table->timestamps();
});
`);

    const result = analyzeMigrations(tmp);
    assert.equal(result.tables[0].foreignKeys.length, 1);
    assert.equal(result.tables[0].foreignKeys[0].column, "user_id");
    assert.equal(result.tables[0].foreignKeys[0].on, "users");
  });

  it("returns empty when no migrations dir", () => {
    tmp = createTmpDir();
    const result = analyzeMigrations(tmp);
    assert.equal(result.summary.total, 0);
  });
});

describe("Laravel analyze-config", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses composer.json", () => {
    tmp = createTmpDir();
    writeFile(tmp, "composer.json", JSON.stringify({
      require: { "laravel/framework": "^11.0", "php": "^8.2" },
      "require-dev": { "phpunit/phpunit": "^11.0" },
    }));
    const result = analyzeConfig(tmp);
    assert.ok(result.composerDeps);
    assert.equal(result.composerDeps.require["laravel/framework"], "^11.0");
    assert.equal(result.composerDeps.requireDev["phpunit/phpunit"], "^11.0");
  });

  it("parses .env.example", () => {
    tmp = createTmpDir();
    writeFile(tmp, ".env.example", `APP_NAME=Laravel
APP_ENV=local
APP_KEY=
DB_CONNECTION=mysql
# This is a comment
DB_HOST=127.0.0.1
`);
    const result = analyzeConfig(tmp);
    assert.ok(result.envKeys.length >= 4);
    const appName = result.envKeys.find((e) => e.key === "APP_NAME");
    assert.ok(appName);
    assert.equal(appName.defaultValue, "Laravel");
  });

  it("parses service providers", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/Providers/AppServiceProvider.php", `<?php
class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}
    public function boot(): void {}
}
`);
    const result = analyzeConfig(tmp);
    assert.equal(result.providers.length, 1);
    assert.equal(result.providers[0].className, "AppServiceProvider");
    assert.equal(result.providers[0].hasRegister, true);
    assert.equal(result.providers[0].hasBoot, true);
  });

  it("returns defaults when files missing", () => {
    tmp = createTmpDir();
    const result = analyzeConfig(tmp);
    assert.deepEqual(result.composerDeps, { require: {}, requireDev: {} });
    assert.deepEqual(result.envKeys, []);
    assert.deepEqual(result.providers, []);
  });
});

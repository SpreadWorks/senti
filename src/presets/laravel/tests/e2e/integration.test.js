import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../../../tests/helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "scan"];

describe("Laravel scan integration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("scans a Laravel project with --stdout", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "laravel",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });

    // Minimal Laravel project structure
    writeFile(tmp, "artisan", "#!/usr/bin/env php\n");
    writeFile(tmp, "composer.json", JSON.stringify({
      require: { "laravel/framework": "^11.0" },
    }));
    writeFile(tmp, ".env.example", "APP_NAME=TestApp\nAPP_ENV=local\n");
    writeFile(tmp, "app/Http/Controllers/Controller.php", `<?php
namespace App\\Http\\Controllers;
class Controller {}
`);
    writeFile(tmp, "app/Http/Controllers/UserController.php", `<?php
namespace App\\Http\\Controllers;
class UserController extends Controller {
    public function index() {}
    public function show(\$id) {}
}
`);
    writeFile(tmp, "app/Models/User.php", `<?php
namespace App\\Models;
use Illuminate\\Database\\Eloquent\\Model;
class User extends Model {
    protected \$fillable = ['name', 'email'];
    public function posts() {
        return \$this->hasMany(Post::class);
    }
}
`);
    writeFile(tmp, "routes/web.php", `<?php
Route::get('/', [HomeController::class, 'index']);
Route::get('/users', [UserController::class, 'index']);
`);
    writeFile(tmp, "routes/api.php", `<?php
Route::get('/users', [UserController::class, 'index']);
`);
    writeFile(tmp, "database/migrations/2024_01_01_create_users.php", `<?php
Schema::create('users', function (Blueprint \$table) {
    \$table->id();
    \$table->string('name');
    \$table->string('email')->unique();
    \$table->timestamps();
});
`);

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt);

    // New pipeline: all entries are in analysis[cat].entries
    assert.ok(analysis.controllers?.entries?.length > 0, "should have controller entries");
    assert.ok(analysis.models?.entries?.length > 0, "should have model entries");
    assert.ok(analysis.routes?.entries?.length > 0, "should have route entries");
    assert.ok(analysis.tables?.entries?.length > 0, "should have table entries");
    assert.ok(analysis.config?.entries?.length > 0, "should have config entries");

    // Verify controller entry structure
    const ctrl = analysis.controllers.entries[0];
    assert.equal(ctrl.className, "UserController");
    assert.ok(Array.isArray(ctrl.actions));

    // Verify model entry structure
    const model = analysis.models.entries[0];
    assert.equal(model.className, "User");

    // Verify composer data in package category (from base PackageSource)
    assert.ok(analysis.package?.entries?.length > 0, "should have package entries");
    const composerEntry = analysis.package.entries.find((e) => e.composerDeps);
    assert.ok(composerEntry, "should have composer package entry");
    assert.ok(composerEntry.composerDeps.require, "composer entry should have deps");

    // Verify config entries contain env data
    const configEntries = analysis.config.entries;
    const envEntry = configEntries.find((e) => e.kind === "env");
    assert.ok(envEntry, "should have env config entry");
    assert.ok(envEntry.envKeys?.length > 0, "env entry should have keys");
  });

  it("type alias 'laravel' resolves correctly", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "laravel",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeFile(tmp, "artisan", "#!/usr/bin/env php\n");
    writeFile(tmp, "composer.json", "{}");

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt);
  });
});

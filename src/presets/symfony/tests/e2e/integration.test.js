import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../../../tests/helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "scan"];

describe("Symfony scan integration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("scans a Symfony project with --stdout", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "symfony",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });

    // Minimal Symfony project structure
    writeFile(tmp, "composer.json", JSON.stringify({
      require: { "symfony/framework-bundle": "^7.0" },
    }));
    writeFile(tmp, ".env", "APP_ENV=dev\nAPP_SECRET=test\n");
    writeFile(tmp, "config/bundles.php", `<?php
return [
    Symfony\\Bundle\\FrameworkBundle\\FrameworkBundle::class => ['all' => true],
];
`);
    writeFile(tmp, "config/services.yaml", `services:
    _defaults:
        autowire: true
        autoconfigure: true
`);
    writeFile(tmp, "config/routes.yaml", `app_home:
    path: /
    controller: App\\Controller\\HomeController::index
`);
    writeFile(tmp, "src/Controller/UserController.php", `<?php
namespace App\\Controller;

use Symfony\\Component\\Routing\\Attribute\\Route;

#[Route('/users')]
class UserController extends AbstractController
{
    #[Route('/', name: 'user_index', methods: ['GET'])]
    public function index(): Response {}

    #[Route('/{id}', name: 'user_show', methods: ['GET'])]
    public function show(int \$id): Response {}
}
`);
    writeFile(tmp, "src/Entity/User.php", `<?php
namespace App\\Entity;
use Doctrine\\ORM\\Mapping as ORM;

#[ORM\\Entity(repositoryClass: UserRepository::class)]
class User
{
    #[ORM\\Id]
    #[ORM\\GeneratedValue]
    #[ORM\\Column(type: 'integer')]
    private ?int \$id = null;

    #[ORM\\Column(type: 'string', length: 255)]
    private string \$name;
}
`);
    writeFile(tmp, "migrations/Version20240101000000.php", `<?php
namespace DoctrineMigrations;
use Doctrine\\Migrations\\AbstractMigration;

final class Version20240101000000 extends AbstractMigration
{
    public function up(Schema \$schema): void
    {
        \$this->addSql('CREATE TABLE user (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
    }
}
`);
    writeFile(tmp, "src/Kernel.php", `<?php
namespace App;
use Symfony\\Component\\HttpKernel\\Kernel as BaseKernel;
class Kernel extends BaseKernel {}
`);

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt);

    // DataSource results use entries-based structure
    assert.equal(analysis.extras, undefined, "extras should not exist");
    assert.ok(analysis.controllers?.entries?.length > 0, "should have controller entries");
    assert.ok(analysis.entities?.entries?.length > 0, "should have entity entries");
    assert.ok(analysis.routes?.entries?.length > 0, "should have route entries");
    assert.ok(analysis.tables?.entries?.length > 0, "should have table entries");
    assert.ok(analysis.config?.entries?.length > 0, "should have config entries");
  });

  it("type alias 'symfony' resolves correctly", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "symfony",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeFile(tmp, "composer.json", "{}");
    writeFile(tmp, "src/Kernel.php", `<?php
class Kernel {}
`);

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt);
  });
});

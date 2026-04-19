import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import {
  analyzeControllers,
  analyzeEntities,
  analyzeRoutes,
  analyzeMigrations,
  analyzeConfig,
} from "../analyzers.js";

describe("Symfony analyze-controllers", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses controller class with Route attributes", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/UserController.php", `<?php
namespace App\\Controller;

use Symfony\\Component\\Routing\\Attribute\\Route;

#[Route('/users')]
class UserController extends AbstractController
{
    public function __construct(
        private readonly UserRepository \$userRepo,
        private readonly LoggerInterface \$logger
    ) {}

    #[Route('/', name: 'user_index', methods: ['GET'])]
    public function index(): Response {}

    #[Route('/{id}', name: 'user_show', methods: ['GET'])]
    public function show(int \$id): Response {}

    #[Route('/', name: 'user_create', methods: ['POST'])]
    public function create(Request \$request): Response {}
}
`);
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 1);
    assert.equal(result.controllers[0].className, "UserController");
    assert.equal(result.controllers[0].parentClass, "AbstractController");
    assert.equal(result.controllers[0].classRoutePrefix, "/users");
    assert.ok(result.controllers[0].actions.length >= 3);
    assert.deepEqual(result.controllers[0].diDeps, ["UserRepository", "LoggerInterface"]);
  });

  it("returns empty when no controllers dir", () => {
    tmp = createTmpDir();
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 0);
  });

  it("scans nested directories", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/Api/PostController.php", `<?php
class PostController extends AbstractController
{
    public function index(): Response {}
}
`);
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 1);
    assert.match(result.controllers[0].file, /Api/);
  });

  it("handles Route attributes with curly-brace path params without hanging", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/PostController.php", `<?php
namespace App\\Controller;

use Symfony\\Component\\Routing\\Attribute\\Route;

#[Route('/threads/{threadId}/posts')]
class PostController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface \$em,
    ) {}

    #[Route('', name: 'post_store', methods: ['POST'])]
    public function store(Request \$request): Response {}

    #[Route('/{id}/edit', name: 'post_edit', methods: ['GET', 'POST'])]
    public function edit(Request \$request, Post \$post): Response {}

    #[Route('/{id}', name: 'post_delete', methods: ['DELETE'])]
    public function delete(Post \$post): Response {}
}
`);
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 1);
    assert.equal(result.controllers[0].className, "PostController");
    assert.equal(result.controllers[0].classRoutePrefix, "/threads/{threadId}/posts");
    const actionNames = result.controllers[0].actions.map((a) => a.name);
    assert.ok(actionNames.includes("store"));
    assert.ok(actionNames.includes("edit"));
    assert.ok(actionNames.includes("delete"));
  });

  it("handles multiple path params in a single Route attribute", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/DeepController.php", `<?php
namespace App\\Controller;

use Symfony\\Component\\Routing\\Attribute\\Route;

#[Route('/orgs/{orgId}/projects/{projectId}/threads/{threadId}')]
class DeepController extends AbstractController
{
    #[Route('/posts/{postId}/comments/{commentId}', name: 'deep_comment', methods: ['GET'])]
    public function show(): Response {}
}
`);
    const result = analyzeControllers(tmp);
    assert.equal(result.summary.total, 1);
    assert.equal(result.controllers[0].actions.length, 1);
    assert.equal(result.controllers[0].actions[0].name, "show");
  });
});

describe("Symfony analyze-entities", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses Doctrine entity", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Entity/Post.php", `<?php
namespace App\\Entity;

use Doctrine\\ORM\\Mapping as ORM;

#[ORM\\Entity(repositoryClass: PostRepository::class)]
#[ORM\\Table(name: 'blog_post')]
class Post
{
    #[ORM\\Id]
    #[ORM\\GeneratedValue]
    #[ORM\\Column(type: 'integer')]
    private ?int \$id = null;

    #[ORM\\Column(type: 'string', length: 255)]
    private string \$title;

    #[ORM\\Column(type: 'text', nullable: true)]
    private ?string \$body = null;

    #[ORM\\ManyToOne(targetEntity: User::class)]
    private ?User \$author = null;

    #[ORM\\OneToMany(targetEntity: Comment::class)]
    private Collection \$comments;
}
`);
    const result = analyzeEntities(tmp);
    assert.equal(result.summary.total, 1);
    const entity = result.entities[0];
    assert.equal(entity.className, "Post");
    assert.equal(entity.tableName, "blog_post");
    assert.equal(entity.repositoryClass, "PostRepository");
    assert.ok(entity.columns.length >= 3);
    // Check ID column
    const idCol = entity.columns.find((c) => c.name === "id");
    assert.ok(idCol);
    assert.equal(idCol.id, true);
    // Check nullable column
    const bodyCol = entity.columns.find((c) => c.name === "body");
    assert.ok(bodyCol);
    assert.equal(bodyCol.nullable, true);
    // Check relations
    assert.ok(entity.relations.ManyToOne);
    assert.equal(entity.relations.ManyToOne[0].target, "User");
    assert.ok(entity.relations.OneToMany);
    assert.equal(entity.relations.OneToMany[0].target, "Comment");
  });

  it("infers table name from class name", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Entity/User.php", `<?php
namespace App\\Entity;
use Doctrine\\ORM\\Mapping as ORM;

#[ORM\\Entity]
class User
{
    #[ORM\\Id]
    #[ORM\\Column]
    private ?int \$id = null;
}
`);
    const result = analyzeEntities(tmp);
    assert.equal(result.entities[0].tableName, "user");
  });

  it("returns empty when no entity dir", () => {
    tmp = createTmpDir();
    const result = analyzeEntities(tmp);
    assert.equal(result.summary.total, 0);
  });
});

describe("Symfony analyze-routes", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses YAML route definitions", () => {
    tmp = createTmpDir();
    writeFile(tmp, "config/routes.yaml", `app_home:
    path: /
    controller: App\\Controller\\HomeController::index
    methods: GET

app_login:
    path: /login
    controller: App\\Controller\\SecurityController::login
    methods: GET|POST
`);
    const result = analyzeRoutes(tmp);
    assert.ok(result.summary.yamlRoutes >= 2);
    const homeRoute = result.routes.find((r) => r.path === "/");
    assert.ok(homeRoute);
    assert.equal(homeRoute.source, "yaml");
  });

  it("parses attribute routes from controllers", () => {
    tmp = createTmpDir();
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
    const result = analyzeRoutes(tmp);
    assert.ok(result.summary.attributeRoutes >= 2);
    const routes = result.routes.filter((r) => r.source === "attribute");
    assert.ok(routes.length >= 2);
  });

  it("parses attribute routes with curly-brace path params without hanging", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/PostController.php", `<?php
namespace App\\Controller;

use Symfony\\Component\\Routing\\Attribute\\Route;

#[Route('/threads/{threadId}/posts')]
class PostController extends AbstractController
{
    #[Route('/{id}', name: 'post_show', methods: ['GET'])]
    public function show(): Response {}
}
`);
    const result = analyzeRoutes(tmp);
    const attrRoutes = result.routes.filter((r) => r.source === "attribute");
    assert.ok(attrRoutes.length >= 1);
    assert.equal(attrRoutes[0].controller, "PostController::show");
    assert.match(attrRoutes[0].path, /\{threadId\}/);
  });

  it("returns empty when no route files", () => {
    tmp = createTmpDir();
    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.total, 0);
  });
});

describe("Symfony analyze-migrations", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses Doctrine migration SQL", () => {
    tmp = createTmpDir();
    writeFile(tmp, "migrations/Version20240101000000.php", `<?php
declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\\DBAL\\Schema\\Schema;
use Doctrine\\Migrations\\AbstractMigration;

final class Version20240101000000 extends AbstractMigration
{
    public function up(Schema \$schema): void
    {
        \$this->addSql('CREATE TABLE user (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, email VARCHAR(180) NOT NULL, created_at DATETIME NOT NULL, PRIMARY KEY(id))');
    }
}
`);

    const result = analyzeMigrations(tmp);
    assert.equal(result.summary.total, 1);
    const users = result.tables[0];
    assert.equal(users.name, "user");
    assert.ok(users.columns.length >= 3);
    const nameCol = users.columns.find((c) => c.name === "name");
    assert.ok(nameCol);
    assert.equal(nameCol.type, "VARCHAR");
  });

  it("parses ALTER TABLE with foreign keys", () => {
    tmp = createTmpDir();
    writeFile(tmp, "migrations/Version20240102000000.php", `<?php
namespace DoctrineMigrations;

use Doctrine\\Migrations\\AbstractMigration;

final class Version20240102000000 extends AbstractMigration
{
    public function up(Schema \$schema): void
    {
        \$this->addSql('CREATE TABLE post (id INT AUTO_INCREMENT NOT NULL, title VARCHAR(255) NOT NULL, user_id INT NOT NULL, PRIMARY KEY(id))');
        \$this->addSql('ALTER TABLE post ADD CONSTRAINT FK_POST_USER FOREIGN KEY (user_id) REFERENCES user (id)');
    }
}
`);

    const result = analyzeMigrations(tmp);
    const post = result.tables.find((t) => t.name === "post");
    assert.ok(post);
    assert.equal(post.foreignKeys.length, 1);
    assert.equal(post.foreignKeys[0].column, "user_id");
    assert.equal(post.foreignKeys[0].on, "user");
  });

  it("returns empty when no migrations dir", () => {
    tmp = createTmpDir();
    const result = analyzeMigrations(tmp);
    assert.equal(result.summary.total, 0);
  });
});

describe("Symfony analyze-config", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses composer.json", () => {
    tmp = createTmpDir();
    writeFile(tmp, "composer.json", JSON.stringify({
      require: { "symfony/framework-bundle": "^7.0", "php": ">=8.2" },
      "require-dev": { "phpunit/phpunit": "^11.0" },
    }));
    const result = analyzeConfig(tmp);
    assert.ok(result.composerDeps);
    assert.equal(result.composerDeps.require["symfony/framework-bundle"], "^7.0");
    assert.equal(result.composerDeps.requireDev["phpunit/phpunit"], "^11.0");
  });

  it("parses .env file", () => {
    tmp = createTmpDir();
    writeFile(tmp, ".env", `APP_ENV=dev
APP_SECRET=changeme
DATABASE_URL=mysql://user:pass@localhost/db
# This is a comment
MESSENGER_TRANSPORT_DSN=doctrine://default
`);
    const result = analyzeConfig(tmp);
    assert.ok(result.envKeys.length >= 3);
    const appEnv = result.envKeys.find((e) => e.key === "APP_ENV");
    assert.ok(appEnv);
    assert.equal(appEnv.defaultValue, "dev");
  });

  it("parses config/packages/ yaml files", () => {
    tmp = createTmpDir();
    writeFile(tmp, "config/packages/doctrine.yaml", `doctrine:
    dbal:
        url: '%env(resolve:DATABASE_URL)%'
    orm:
        auto_generate_proxy_classes: true
`);
    const result = analyzeConfig(tmp);
    assert.equal(result.configFiles.length, 1);
    assert.equal(result.configFiles[0].file, "doctrine.yaml");
    assert.ok(result.configFiles[0].keys.includes("doctrine"));
  });

  it("parses config/services.yaml", () => {
    tmp = createTmpDir();
    writeFile(tmp, "config/services.yaml", `services:
    _defaults:
        autowire: true
        autoconfigure: true
`);
    const result = analyzeConfig(tmp);
    assert.equal(result.services.autowire, true);
    assert.equal(result.services.autoconfigure, true);
  });

  it("parses config/bundles.php", () => {
    tmp = createTmpDir();
    writeFile(tmp, "config/bundles.php", `<?php
return [
    Symfony\\Bundle\\FrameworkBundle\\FrameworkBundle::class => ['all' => true],
    Doctrine\\Bundle\\DoctrineBundle\\DoctrineBundle::class => ['all' => true],
    Symfony\\Bundle\\SecurityBundle\\SecurityBundle::class => ['all' => true],
];
`);
    const result = analyzeConfig(tmp);
    assert.equal(result.bundles.length, 3);
    assert.equal(result.bundles[0].shortName, "FrameworkBundle");
    assert.equal(result.bundles[1].shortName, "DoctrineBundle");
  });

  it("parses src/Kernel.php", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Kernel.php", `<?php
namespace App;

use Symfony\\Bundle\\FrameworkBundle\\Kernel\\MicroKernelTrait;
use Symfony\\Component\\HttpKernel\\Kernel as BaseKernel;

class Kernel extends BaseKernel
{
    use MicroKernelTrait;
}
`);
    const result = analyzeConfig(tmp);
    assert.ok(result.kernel);
    assert.equal(result.kernel.className, "Kernel");
    assert.equal(result.kernel.parentClass, "BaseKernel");
  });

  it("returns defaults when files missing", () => {
    tmp = createTmpDir();
    const result = analyzeConfig(tmp);
    assert.deepEqual(result.composerDeps, { require: {}, requireDev: {} });
    assert.deepEqual(result.envKeys, []);
    assert.deepEqual(result.configFiles, []);
    assert.deepEqual(result.bundles, []);
  });
});

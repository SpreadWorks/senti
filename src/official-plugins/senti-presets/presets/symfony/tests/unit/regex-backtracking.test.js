import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import { analyzeControllers, analyzeRoutes } from "../analyzers.js";

// ---------------------------------------------------------------------------
// Shared helper: collectAttributeBlock
// ---------------------------------------------------------------------------

describe("collectAttributeBlock (via controllers.js)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("extracts single Route attribute before method", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/TestController.php", `<?php
#[Route('/prefix')]
class TestController
{
    #[Route('/test', name: 'test_index', methods: ['GET'])]
    public function index(): Response {}
}
`);
    const result = analyzeControllers(tmp);
    const ctrl = result.controllers[0];
    assert.equal(ctrl.actions.length, 1);
    assert.equal(ctrl.actions[0].name, "index");
    assert.equal(ctrl.actions[0].routes.length, 1);
    assert.equal(ctrl.actions[0].routes[0].path, "/prefix/test");
  });

  it("extracts multiple attributes before method", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/TestController.php", `<?php
class TestController
{
    #[Route('/admin', name: 'admin_index', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    public function index(): Response {}
}
`);
    const result = analyzeControllers(tmp);
    const ctrl = result.controllers[0];
    assert.equal(ctrl.actions.length, 1);
    assert.equal(ctrl.actions[0].name, "index");
    assert.equal(ctrl.actions[0].routes.length, 1);
  });

  it("handles curly braces in route path", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/TestController.php", `<?php
#[Route('/api')]
class TestController
{
    #[Route('/threads/{threadId}/posts/{postId}', name: 'post_show', methods: ['GET'])]
    public function show(int $threadId, int $postId): Response {}
}
`);
    const result = analyzeControllers(tmp);
    const ctrl = result.controllers[0];
    assert.equal(ctrl.actions[0].name, "show");
    assert.equal(ctrl.actions[0].routes[0].path, "/api/threads/{threadId}/posts/{postId}");
  });

  it("handles method without attributes", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/TestController.php", `<?php
class TestController
{
    public function healthCheck(): Response {}
}
`);
    const result = analyzeControllers(tmp);
    const ctrl = result.controllers[0];
    assert.equal(ctrl.actions.length, 1);
    assert.equal(ctrl.actions[0].name, "healthCheck");
    assert.equal(ctrl.actions[0].routes.length, 0);
  });

  it("completes in <100ms with pathological input (20+ attributes, no function)", () => {
    tmp = createTmpDir();
    let content = "<?php\nclass TestController\n{\n";
    for (let i = 0; i < 30; i++) {
      content += `    #[Route('/api/{id}/sub/${i}', name: 'route_${i}', methods: ['GET'])]\n`;
    }
    content += "    // no public function here\n}\n";
    writeFile(tmp, "src/Controller/TestController.php", content);

    const start = Date.now();
    const result = analyzeControllers(tmp);
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 100, `Expected <100ms, got ${elapsed}ms`);
    // Should parse without hanging, actions list should be empty
    assert.equal(result.controllers[0].actions.length, 0);
  });
});

// ---------------------------------------------------------------------------
// routes.js: extractAttributeRoutes
// ---------------------------------------------------------------------------

describe("extractAttributeRoutes backtracking fix", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("completes in <100ms with pathological input in route scanner", () => {
    tmp = createTmpDir();
    let content = "<?php\nclass TestController\n{\n";
    for (let i = 0; i < 30; i++) {
      content += `    #[Route('/api/{orgId}/teams/{teamId}/members/${i}', methods: ['GET', 'HEAD'])]\n`;
    }
    content += "    // orphaned attributes\n}\n";
    writeFile(tmp, "src/Controller/TestController.php", content);

    const start = Date.now();
    const result = analyzeRoutes(tmp);
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 100, `Expected <100ms, got ${elapsed}ms`);
  });

  it("extracts routes with curly braces correctly", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/Controller/ApiController.php", `<?php
#[Route('/api/v1')]
class ApiController
{
    #[Route('/{org}/teams/{teamId}/members', name: 'get_members', methods: ['GET'])]
    public function getMembers(string $org, int $teamId): Response {}
}
`);
    const result = analyzeRoutes(tmp);
    const routes = result.routes.filter((r) => r.source === "attribute");
    assert.ok(routes.length >= 1);
    assert.ok(routes[0].path.includes("{org}"));
    assert.ok(routes[0].path.includes("{teamId}"));
  });
});

/**
 * I/O tests for security.js scan parsers.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
} from "../../../../../tests/helpers/tmp-dir.js";
import {
  analyzePermissionComponent,
  analyzeAcl,
} from "../analyzers.js";

// =========================================================================
// analyzePermissionComponent
// =========================================================================
describe("analyzePermissionComponent", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns null when file does not exist", () => {
    tmp = createTmpDir();
    assert.equal(analyzePermissionComponent(tmp), null);
  });

  it("parses methods excluding dunder methods", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Controller/Component/PermissionComponent.php",
      `<?php
class PermissionComponent extends Component {
    public function __construct() {}
    public function checkAccess($controller, $action) {}
    public function isAdmin() {}
    function legacyMethod() {}
    private function __internalHelper() {}
}
`,
    );

    const result = analyzePermissionComponent(tmp);
    assert.equal(
      result.file,
      "app/Controller/Component/PermissionComponent.php",
    );
    assert.deepStrictEqual(result.methods, [
      "checkAccess",
      "isAdmin",
      "legacyMethod",
    ]);
  });
});

// =========================================================================
// analyzeAcl
// =========================================================================
describe("analyzeAcl", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns null when file does not exist", () => {
    tmp = createTmpDir();
    assert.equal(analyzeAcl(tmp), null);
  });

  it("parses aliases, roles, allow, and deny rules", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/acl.php",
      `<?php
$config['alias'] = array(
    'Role/admin' => 'Role/1',
    'Role/editor' => 'Role/2',
    'Role/viewer' => 'Role/3'
);

$config['roles'] = array(
    'Role/admin' => null,
    'Role/editor' => 'Role/admin',
    'Role/viewer' => 'Role/editor'
);

$config['rules'] = array(
    'allow' => array(
        'controllers/Users/index' => 'Role/admin',
        'controllers/Posts/*' => 'Role/editor'
    ),
    'deny' => array(
        'controllers/Admin/*' => 'Role/viewer'
    )
);
`,
    );

    const result = analyzeAcl(tmp);
    assert.equal(result.aliases.length, 3);
    assert.equal(result.aliases[0].key, "Role/admin");
    assert.equal(result.aliases[0].value, "Role/1");

    assert.equal(result.roles.length, 3);
    assert.equal(result.roles[0].role, "Role/admin");
    assert.equal(result.roles[0].inherits, null);
    assert.equal(result.roles[1].role, "Role/editor");
    assert.equal(result.roles[1].inherits, "Role/admin");

    assert.equal(result.allow.length, 2);
    assert.equal(result.allow[0].resource, "controllers/Users/index");
    assert.equal(result.allow[0].roles, "Role/admin");

    assert.equal(result.deny.length, 1);
    assert.equal(result.deny[0].resource, "controllers/Admin/*");
    assert.equal(result.deny[0].roles, "Role/viewer");
  });

  it("handles empty sections", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/acl.php",
      `<?php
// minimal config with no aliases, roles, or rules
$config['other'] = 'value';
`,
    );

    const result = analyzeAcl(tmp);
    assert.deepStrictEqual(result.aliases, []);
    assert.deepStrictEqual(result.roles, []);
    assert.deepStrictEqual(result.allow, []);
    assert.deepStrictEqual(result.deny, []);
  });
});

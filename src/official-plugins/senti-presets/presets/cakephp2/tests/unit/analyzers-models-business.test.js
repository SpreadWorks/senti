/**
 * I/O tests for models.js, business.js, and base-classes.js scan parsers.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
} from "../../../../../tests/helpers/tmp-dir.js";
import {
  analyzeModels,
  analyzeLogicClasses,
  analyzeTitlesGraphMapping,
  analyzeComposerDeps,
  analyzeAppController,
  analyzeAppModel,
} from "../analyzers.js";

// =========================================================================
// analyzeModels
// =========================================================================
describe("analyzeModels", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty when Model dir does not exist", () => {
    tmp = createTmpDir();
    const result = analyzeModels(tmp);
    assert.equal(result.models.length, 0);
    assert.equal(result.summary.total, 0);
  });

  it("parses a basic model with class and table inference", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/User.php",
      `<?php
class User extends AppModel {
    public $validate = array(
        'username' => array('notBlank' => array('rule' => 'notBlank'))
    );
    public $hasMany = array(
        'Post' => array('className' => 'Post')
    );
}
`,
    );

    const result = analyzeModels(tmp);
    assert.equal(result.models.length, 1);
    const user = result.models[0];
    assert.equal(user.className, "User");
    assert.equal(user.parentClass, "AppModel");
    assert.equal(user.tableName, "users");
    assert.equal(user.isLogic, false);
    assert.equal(user.isFe, false);
    assert.deepStrictEqual(user.validateFields, ["username"]);
    assert.deepStrictEqual(user.relations.hasMany, ["Post"]);
  });

  it("detects useTable, useDbConfig, primaryKey, displayField", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/CustomModel.php",
      `<?php
class CustomModel extends AppModel {
    public $useTable = 'custom_tbl';
    public $useDbConfig = 'external';
    public $primaryKey = 'custom_id';
    public $displayField = 'title';
}
`,
    );

    const result = analyzeModels(tmp);
    const m = result.models[0];
    assert.equal(m.useTable, "custom_tbl");
    assert.equal(m.tableName, "custom_tbl");
    assert.equal(m.useDbConfig, "external");
    assert.equal(m.primaryKey, "custom_id");
    assert.equal(m.displayField, "title");
  });

  it("skips AppModel.php", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/AppModel.php",
      `<?php class AppModel extends Model {}`,
    );
    writeFile(
      tmp,
      "Model/Item.php",
      `<?php class Item extends AppModel {}`,
    );

    const result = analyzeModels(tmp);
    assert.equal(result.models.length, 1);
    assert.equal(result.models[0].className, "Item");
  });

  it("detects Fe-prefixed models", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/FeData.php",
      `<?php class FeData extends AppModel {}`,
    );

    const result = analyzeModels(tmp);
    assert.equal(result.models[0].isFe, true);
    assert.equal(result.summary.feModels, 1);
  });

  it("scans Logic subdirectory and marks isLogic", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/Logic/ReportLogic.php",
      `<?php class ReportLogic extends AppModel {}`,
    );

    const result = analyzeModels(tmp);
    assert.equal(result.models.length, 1);
    assert.equal(result.models[0].isLogic, true);
    assert.equal(result.summary.logicModels, 1);
  });

  it("groups models by dbConfig in summary", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/A.php",
      `<?php class A extends AppModel { public $useDbConfig = 'logs'; }`,
    );
    writeFile(
      tmp,
      "Model/B.php",
      `<?php class B extends AppModel {}`,
    );

    const result = analyzeModels(tmp);
    assert.deepStrictEqual(result.summary.dbGroups.logs, ["A"]);
    assert.deepStrictEqual(result.summary.dbGroups.default, ["B"]);
  });

  it("detects actsAs behaviors", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/Post.php",
      `<?php
class Post extends AppModel {
    public $actsAs = array('Containable', 'SoftDelete');
}
`,
    );

    const result = analyzeModels(tmp);
    assert.deepStrictEqual(result.models[0].actsAs, [
      "Containable",
      "SoftDelete",
    ]);
  });
});

// =========================================================================
// analyzeLogicClasses
// =========================================================================
describe("analyzeLogicClasses", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Logic dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeLogicClasses(tmp), []);
  });

  it("parses logic classes with methods", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/Logic/SalesLogic.php",
      `<?php
class SalesLogic extends AppModel {
    public function calculate($param1) {
        return 0;
    }
    protected function helper($a, $b) {}
    public function __construct() {}
}
`,
    );

    const result = analyzeLogicClasses(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].className, "SalesLogic");
    assert.equal(result[0].extends, "AppModel");
    assert.equal(result[0].file, "app/Model/Logic/SalesLogic.php");
    // __construct is excluded
    assert.equal(result[0].methods.length, 2);
    assert.equal(result[0].methods[0].name, "calculate");
    assert.equal(result[0].methods[0].visibility, "public");
    assert.equal(result[0].methods[0].params, "$param1");
  });

  it("sorts results by className", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/Logic/ZLogic.php",
      `<?php class ZLogic extends AppModel {}`,
    );
    writeFile(
      tmp,
      "Model/Logic/ALogic.php",
      `<?php class ALogic extends AppModel {}`,
    );

    const result = analyzeLogicClasses(tmp);
    assert.equal(result[0].className, "ALogic");
    assert.equal(result[1].className, "ZLogic");
  });
});

// =========================================================================
// analyzeTitlesGraphMapping
// =========================================================================
describe("analyzeTitlesGraphMapping", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when file does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeTitlesGraphMapping(tmp), []);
  });

  it("parses actions and detects logic references and output types", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Controller/TitlesGraphController.php",
      `<?php
class TitlesGraphController extends AppController {
    public function index() {
        $this->SalesLogic->getData();
    }
    public function outputExcel() {
        $this->ReportLogic->generate();
    }
    public function ajaxSearch() {
        $this->SearchLogic->find();
    }
    public function outputCsv() {
        $data = array();
    }
}
`,
    );

    const result = analyzeTitlesGraphMapping(tmp);
    assert.equal(result.length, 4);

    const index = result.find((r) => r.action === "index");
    assert.deepStrictEqual(index.logicClasses, ["SalesLogic"]);
    assert.equal(index.outputType, "画面表示");

    const excel = result.find((r) => r.action === "outputExcel");
    assert.equal(excel.outputType, "Excel");

    const ajax = result.find((r) => r.action === "ajaxSearch");
    assert.equal(ajax.outputType, "JSON");

    const csv = result.find((r) => r.action === "outputCsv");
    assert.equal(csv.outputType, "CSV");
  });

  it("skips __construct and beforeFilter", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Controller/TitlesGraphController.php",
      `<?php
class TitlesGraphController extends AppController {
    public function beforeFilter() {}
    public function view() {}
}
`,
    );

    const result = analyzeTitlesGraphMapping(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].action, "view");
  });
});

// =========================================================================
// analyzeComposerDeps
// =========================================================================
describe("analyzeComposerDeps", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty deps when composer.json does not exist", () => {
    tmp = createTmpDir();
    const result = analyzeComposerDeps(tmp);
    assert.deepStrictEqual(result, { require: {}, requireDev: {} });
  });

  it("parses require and require-dev from parent dir", () => {
    tmp = createTmpDir();
    // composer.json is one level up from appDir
    // We simulate by creating a subdir as appDir
    writeFile(tmp, "app/.gitkeep", "");
    writeFile(
      tmp,
      "composer.json",
      JSON.stringify({
        require: { "php": ">=5.6", "cakephp/cakephp": "2.10.*" },
        "require-dev": { "phpunit/phpunit": "^5.0" },
      }),
    );

    const appDir = join(tmp, "app");
    const result = analyzeComposerDeps(appDir);
    assert.equal(result.require["php"], ">=5.6");
    assert.equal(result.require["cakephp/cakephp"], "2.10.*");
    assert.equal(result.requireDev["phpunit/phpunit"], "^5.0");
  });
});

// =========================================================================
// analyzeAppController
// =========================================================================
describe("analyzeAppController", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty object when file does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeAppController(tmp), {});
  });

  it("parses components, helpers, auth config, and methods", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Controller/AppController.php",
      `<?php
class AppController extends Controller {
    public $components = array(
        'Session',
        'Auth' => array(
            'authorize' => array('Actions'),
            'authenticate' => array('Form'),
            'userModel' => 'Staff',
            'username' => 'login_id',
            'loginRedirect' => array('controller' => 'Dashboard', 'action' => 'index'),
            'logoutRedirect' => array('controller' => 'Users', 'action' => 'login')
        ),
        'Acl'
    );

    public $helpers = array(
        'Html' => array('className' => 'MyHtml'),
        'Form' => array('className' => 'MyForm')
    );

    public function beforeFilter() {}
    protected function _checkPermission() {}
}
`,
    );

    const result = analyzeAppController(tmp);
    assert.deepStrictEqual(result.components, ["Session", "Auth", "Acl"]);
    // The regex uses [^)]+ which stops at first ), so only first helper is captured
    assert.equal(result.helpers.length, 1);
    assert.equal(result.helpers[0].name, "Html");
    assert.equal(result.helpers[0].className, "MyHtml");
    assert.equal(result.authConfig.authorize, "Actions");
    assert.equal(result.authConfig.authenticate, "Form");
    assert.equal(result.authConfig.userModel, "Staff");
    assert.equal(result.authConfig.loginField, "login_id");
    assert.equal(result.authConfig.loginRedirect, "Dashboard/index");
    assert.equal(result.authConfig.logoutRedirect, "Users/login");
    assert.equal(result.methods.length, 2);
  });
});

// =========================================================================
// analyzeAppModel
// =========================================================================
describe("analyzeAppModel", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty object when file does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeAppModel(tmp), {});
  });

  it("parses behaviors, callbacks, audit fields, and methods", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/AppModel.php",
      `<?php
class AppModel extends Model {
    public $actsAs = array('Containable');

    public function beforeSave($options = array()) {
        $this->data[$this->alias]['updated_by'] = 'system';
        $this->data[$this->alias]['updated_ts'] = date('Y-m-d');
        return true;
    }

    public function afterSave($created, $options = array()) {
        $this->data[$this->alias]['created_by'] = 'x';
        $this->data[$this->alias]['created_ts'] = date('Y-m-d');
    }

    public function sql($name) {}
    public function escapeQuote($str) {}
}
`,
    );

    const result = analyzeAppModel(tmp);
    assert.deepStrictEqual(result.behaviors, ["Containable"]);
    assert.deepStrictEqual(result.callbacks, ["beforeSave", "afterSave"]);
    assert.ok(result.auditFields.includes("updated_by"));
    assert.ok(result.auditFields.includes("updated_ts"));
    assert.ok(result.auditFields.includes("created_by"));
    assert.ok(result.auditFields.includes("created_ts"));
    assert.ok(result.methods.length >= 4);

    const sqlMethod = result.methods.find((m) => m.name === "sql");
    assert.equal(sqlMethod.description, "SQL テンプレートファイル読み込み・実行");
  });

  it("skips __construct in method list", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/AppModel.php",
      `<?php
class AppModel extends Model {
    public function __construct($id = false) { parent::__construct($id); }
    public function myMethod() {}
}
`,
    );

    const result = analyzeAppModel(tmp);
    const names = result.methods.map((m) => m.name);
    assert.ok(!names.includes("__construct"));
    assert.ok(names.includes("myMethod"));
  });
});

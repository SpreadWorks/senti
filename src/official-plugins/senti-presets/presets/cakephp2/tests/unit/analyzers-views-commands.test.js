/**
 * I/O tests for views.js, commands-detail.js, testing.js, and notifications.js scan parsers.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
} from "../../../../../tests/helpers/tmp-dir.js";
import {
  analyzeHelpers,
  analyzeLibraries,
  analyzeBehaviors,
  analyzeSqlFiles,
  analyzeLayouts,
  analyzeElements,
  analyzeCommandDetails,
  analyzeTestStructure,
  analyzeEmailNotifications,
} from "../analyzers.js";

// =========================================================================
// analyzeHelpers
// =========================================================================
describe("analyzeHelpers", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Helper dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeHelpers(tmp), []);
  });

  it("parses helper class with methods and dependencies", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "View/Helper/DateHelper.php",
      `<?php
class DateHelper extends AppHelper {
    public $helpers = array('Html', 'Form');

    public function formatDate($date) {}
    public function formatTime($time) {}
    public function __construct() {}
}
`,
    );

    const result = analyzeHelpers(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].className, "DateHelper");
    assert.equal(result[0].extends, "AppHelper");
    assert.equal(result[0].file, "app/View/Helper/DateHelper.php");
    // __construct is excluded
    assert.deepStrictEqual(result[0].methods, ["formatDate", "formatTime"]);
    assert.deepStrictEqual(result[0].dependsOn, ["Html", "Form"]);
  });
});

// =========================================================================
// analyzeLibraries
// =========================================================================
describe("analyzeLibraries", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Lib dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeLibraries(tmp), []);
  });

  it("parses library with static and regular methods, detects CakeEmail", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Lib/Mailer.php",
      `<?php
class Mailer {
    public static function send($to) {}
    public static function queue($to) {}
    public function prepare($data) {}
    // Uses CakeEmail internally
    private $email;
    public function __construct() {
        $this->email = new CakeEmail();
    }
}
`,
    );

    const result = analyzeLibraries(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].className, "Mailer");
    assert.equal(result[0].file, "app/Lib/Mailer.php");
    assert.deepStrictEqual(result[0].staticMethods, ["send", "queue"]);
    assert.ok(result[0].hasMail);
  });

  it("detects library without CakeEmail", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Lib/Utils.php",
      `<?php
class Utils {
    public static function format($val) {}
}
`,
    );

    const result = analyzeLibraries(tmp);
    assert.equal(result[0].hasMail, false);
  });
});

// =========================================================================
// analyzeBehaviors
// =========================================================================
describe("analyzeBehaviors", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Behavior dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeBehaviors(tmp), []);
  });

  it("parses behavior class, excludes __construct and setup", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/Behavior/SoftDeleteBehavior.php",
      `<?php
class SoftDeleteBehavior extends ModelBehavior {
    public function setup(Model $model, $config = array()) {}
    public function __construct() {}
    public function softDelete(Model $model, $id) {}
    public function restore(Model $model, $id) {}
}
`,
    );

    const result = analyzeBehaviors(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].className, "SoftDeleteBehavior");
    assert.equal(result[0].file, "app/Model/Behavior/SoftDeleteBehavior.php");
    assert.deepStrictEqual(result[0].methods, ["softDelete", "restore"]);
  });
});

// =========================================================================
// analyzeSqlFiles
// =========================================================================
describe("analyzeSqlFiles", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Sql dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeSqlFiles(tmp), []);
  });

  it("parses SQL files detecting params and tables", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Model/Sql/report.sql",
      `SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = /*status*/''
  AND u.id = /*user_id*/0
`,
    );

    const result = analyzeSqlFiles(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].file, "report.sql");
    assert.ok(result[0].lines > 0);
    assert.deepStrictEqual(result[0].params.sort(), ["status", "user_id"]);
    assert.ok(result[0].tables.includes("users"));
    assert.ok(result[0].tables.includes("orders"));
  });

  it("sorts files alphabetically", () => {
    tmp = createTmpDir();
    writeFile(tmp, "Model/Sql/z_query.sql", "SELECT 1");
    writeFile(tmp, "Model/Sql/a_query.sql", "SELECT 2");

    const result = analyzeSqlFiles(tmp);
    assert.equal(result[0].file, "a_query.sql");
    assert.equal(result[1].file, "z_query.sql");
  });
});

// =========================================================================
// analyzeLayouts
// =========================================================================
describe("analyzeLayouts", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Layouts dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeLayouts(tmp), []);
  });

  it("finds .ctp files recursively", () => {
    tmp = createTmpDir();
    writeFile(tmp, "View/Layouts/default.ctp", "<html>");
    writeFile(tmp, "View/Layouts/email/html/default.ctp", "<html>");
    writeFile(tmp, "View/Layouts/ajax.ctp", "");

    const result = analyzeLayouts(tmp);
    assert.equal(result.length, 3);
    assert.ok(result.includes("default.ctp"));
    assert.ok(result.includes("ajax.ctp"));
    assert.ok(result.includes("email/html/default.ctp"));
  });

  it("ignores non-ctp files", () => {
    tmp = createTmpDir();
    writeFile(tmp, "View/Layouts/default.ctp", "");
    writeFile(tmp, "View/Layouts/readme.txt", "");

    const result = analyzeLayouts(tmp);
    assert.equal(result.length, 1);
  });
});

// =========================================================================
// analyzeElements
// =========================================================================
describe("analyzeElements", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Elements dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeElements(tmp), []);
  });

  it("lists .ctp files sorted", () => {
    tmp = createTmpDir();
    writeFile(tmp, "View/Elements/sidebar.ctp", "");
    writeFile(tmp, "View/Elements/header.ctp", "");
    writeFile(tmp, "View/Elements/footer.ctp", "");

    const result = analyzeElements(tmp);
    assert.deepStrictEqual(result, [
      "footer.ctp",
      "header.ctp",
      "sidebar.ctp",
    ]);
  });
});

// =========================================================================
// analyzeCommandDetails
// =========================================================================
describe("analyzeCommandDetails", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty array when Command dir does not exist", () => {
    tmp = createTmpDir();
    assert.deepStrictEqual(analyzeCommandDetails(tmp), []);
  });

  it("parses shell with flow detection", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Console/Command/ImportShell.php",
      `<?php
class ImportShell extends AppShell {
    public function main() {
        $data = $this->Model->find('all');
        $file = file_get_contents('/tmp/data.csv');
        $this->Model->getDataSource()->begin();
        $this->Model->save($data);
        $this->Model->getDataSource()->commit();
        rename('/tmp/old', '/tmp/backup');
    }
}
`,
    );

    const result = analyzeCommandDetails(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].className, "ImportShell");
    assert.equal(result[0].file, "app/Console/Command/ImportShell.php");
    assert.equal(result[0].hasMail, false);
    assert.equal(result[0].hasFileOps, true);
    assert.equal(result[0].hasTransaction, true);
    assert.ok(result[0].flowSteps.includes("対象データ取得"));
    assert.ok(result[0].flowSteps.includes("ファイル読込"));
    assert.ok(result[0].flowSteps.includes("トランザクション管理"));
    assert.ok(result[0].flowSteps.includes("ファイルバックアップ"));
  });

  it("skips AppShell class", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Console/Command/AppShell.php",
      `<?php class AppShell extends Shell {}`,
    );
    writeFile(
      tmp,
      "Console/Command/CronShell.php",
      `<?php class CronShell extends AppShell {}`,
    );

    const result = analyzeCommandDetails(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].className, "CronShell");
  });

  it("detects CakeEmail usage", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Console/Command/NotifyShell.php",
      `<?php
class NotifyShell extends AppShell {
    public function main() {
        $email = new CakeEmail();
        $email->send();
    }
}
`,
    );

    const result = analyzeCommandDetails(tmp);
    assert.equal(result[0].hasMail, true);
    assert.ok(result[0].flowSteps.includes("メール通知"));
  });

  it("only matches files ending with Shell.php", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Console/Command/TaskShell.php",
      `<?php class TaskShell extends AppShell {}`,
    );
    writeFile(
      tmp,
      "Console/Command/Helper.php",
      `<?php class Helper {}`,
    );

    const result = analyzeCommandDetails(tmp);
    assert.equal(result.length, 1);
  });
});

// =========================================================================
// analyzeTestStructure
// =========================================================================
describe("analyzeTestStructure", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns null when Test dir does not exist", () => {
    tmp = createTmpDir();
    assert.equal(analyzeTestStructure(tmp), null);
  });

  it("counts controller tests, model tests, and fixtures", () => {
    tmp = createTmpDir();
    writeFile(tmp, "Test/Case/Controller/UsersControllerTest.php", "");
    writeFile(tmp, "Test/Case/Controller/PostsControllerTest.php", "");
    writeFile(tmp, "Test/Case/Model/UserTest.php", "");
    writeFile(tmp, "Test/Fixture/UserFixture.php", "");
    writeFile(tmp, "Test/Fixture/PostFixture.php", "");
    writeFile(tmp, "Test/Fixture/CommentFixture.php", "");

    const result = analyzeTestStructure(tmp);
    assert.equal(result.controllerTests, 2);
    assert.equal(result.modelTests, 1);
    assert.equal(result.fixtures, 3);
  });

  it("returns zeroes when Test dir exists but is empty", () => {
    tmp = createTmpDir();
    writeFile(tmp, "Test/.gitkeep", "");

    const result = analyzeTestStructure(tmp);
    assert.equal(result.controllerTests, 0);
    assert.equal(result.modelTests, 0);
    assert.equal(result.fixtures, 0);
  });

  it("only counts files matching naming conventions", () => {
    tmp = createTmpDir();
    writeFile(tmp, "Test/Case/Controller/UsersControllerTest.php", "");
    writeFile(tmp, "Test/Case/Controller/bootstrap.php", ""); // not a test
    writeFile(tmp, "Test/Fixture/UserFixture.php", "");
    writeFile(tmp, "Test/Fixture/README.md", ""); // not a fixture

    const result = analyzeTestStructure(tmp);
    assert.equal(result.controllerTests, 1);
    assert.equal(result.fixtures, 1);
  });
});

// =========================================================================
// analyzeEmailNotifications
// =========================================================================
describe("analyzeEmailNotifications", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty config and usages when no files exist", () => {
    tmp = createTmpDir();
    const result = analyzeEmailNotifications(tmp);
    assert.deepStrictEqual(result, { config: {}, usages: [] });
  });

  it("parses email config from email.php", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/email.php",
      `<?php
class EmailConfig {
    public $default = array(
        'transport' => 'Smtp',
        'from' => 'noreply@example.com',
        'host' => 'localhost'
    );
}
`,
    );

    const result = analyzeEmailNotifications(tmp);
    assert.equal(result.config.transport, "Smtp");
    assert.equal(result.config.defaultFrom, "noreply@example.com");
  });

  it("detects CakeEmail usages in Console/Command and Lib", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Console/Command/AlertShell.php",
      `<?php
class AlertShell extends AppShell {
    public function main() {
        $email = new CakeEmail();
        $email->subject('Alert: ' . Configure::read('SITE_TITLE'));
        $email->cc(array('admin@example.com'));
        $email->send();
    }
}
`,
    );
    writeFile(
      tmp,
      "Lib/NotificationLib.php",
      `<?php
class NotificationLib {
    public function notify() {
        $email = new CakeEmail();
        $email->subject('Notification');
        $email->send();
    }
}
`,
    );

    const result = analyzeEmailNotifications(tmp);
    assert.equal(result.usages.length, 2);

    const shell = result.usages.find((u) =>
      u.file.includes("AlertShell"),
    );
    assert.equal(shell.file, "app/Console/Command/AlertShell.php");
    assert.ok(shell.subjects.length > 0);
    assert.equal(shell.hasCc, true);

    const lib = result.usages.find((u) =>
      u.file.includes("NotificationLib"),
    );
    assert.equal(lib.file, "app/Lib/NotificationLib.php");
    assert.equal(lib.hasCc, false);
  });

  it("skips files without CakeEmail", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Console/Command/CleanupShell.php",
      `<?php
class CleanupShell extends AppShell {
    public function main() { /* no email */ }
}
`,
    );

    const result = analyzeEmailNotifications(tmp);
    assert.equal(result.usages.length, 0);
  });

  it("replaces Configure::read in subject strings", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Lib/Sender.php",
      `<?php
class Sender {
    public function send() {
        $email = new CakeEmail();
        $email->subject(Configure::read('SITE_TITLE') . ' - Alert');
        $email->send();
    }
}
`,
    );

    const result = analyzeEmailNotifications(tmp);
    const usage = result.usages[0];
    // Configure::read('SITE_TITLE') is replaced with {SITE_TITLE}
    assert.ok(usage.subjects[0].includes("{SITE_TITLE}"));
  });
});

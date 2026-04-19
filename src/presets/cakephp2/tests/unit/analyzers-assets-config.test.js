/**
 * I/O tests for assets.js and config.js scan parsers.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
} from "../../../../../tests/helpers/tmp-dir.js";
import { analyzeAssets, analyzeConstants, analyzeBootstrap } from "../analyzers.js";

// =========================================================================
// analyzeAssets
// =========================================================================
describe("analyzeAssets", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty arrays when webroot dirs do not exist", () => {
    tmp = createTmpDir();
    const result = analyzeAssets(tmp);
    assert.deepStrictEqual(result, { js: [], css: [] });
  });

  it("lists JS files with size and detects libraries", () => {
    tmp = createTmpDir();
    writeFile(tmp, "webroot/js/jquery-3.6.0.min.js", "/* jquery */");
    writeFile(tmp, "webroot/js/app.js", "var x = 1;");

    const result = analyzeAssets(tmp);
    assert.equal(result.js.length, 2);

    const jquery = result.js.find((f) => f.file.includes("jquery"));
    assert.equal(jquery.library, "jQuery");
    assert.equal(jquery.version, "3.6.0");

    const app = result.js.find((f) => f.file === "app.js");
    assert.equal(app.type, "custom");
    assert.equal(typeof app.size, "number");
  });

  it("detects multiple JS library patterns", () => {
    tmp = createTmpDir();
    writeFile(tmp, "webroot/js/jquery-ui.min.js", "");
    writeFile(tmp, "webroot/js/highcharts.js", "");

    const result = analyzeAssets(tmp);
    const ui = result.js.find((f) => f.file.includes("jquery-ui"));
    assert.equal(ui.library, "jQuery UI");
    const hc = result.js.find((f) => f.file === "highcharts.js");
    assert.equal(hc.library, "Highcharts");
  });

  it("lists CSS files and classifies library vs custom", () => {
    tmp = createTmpDir();
    writeFile(tmp, "webroot/css/cake.generic.css", "body{}");
    writeFile(tmp, "webroot/css/style.css", "div{}");
    writeFile(tmp, "webroot/css/jquery.fancybox.css", ".fb{}");

    const result = analyzeAssets(tmp);
    assert.equal(result.css.length, 3);

    const cake = result.css.find((f) => f.file === "cake.generic.css");
    assert.equal(cake.type, "library");
    const style = result.css.find((f) => f.file === "style.css");
    assert.equal(style.type, "custom");
    const fb = result.css.find((f) => f.file === "jquery.fancybox.css");
    assert.equal(fb.type, "library");
  });

  it("sorts files alphabetically", () => {
    tmp = createTmpDir();
    writeFile(tmp, "webroot/js/z.js", "");
    writeFile(tmp, "webroot/js/a.js", "");
    writeFile(tmp, "webroot/js/m.js", "");

    const result = analyzeAssets(tmp);
    assert.deepStrictEqual(
      result.js.map((f) => f.file),
      ["a.js", "m.js", "z.js"],
    );
  });

  it("ignores non-js/css files", () => {
    tmp = createTmpDir();
    writeFile(tmp, "webroot/js/readme.txt", "");
    writeFile(tmp, "webroot/js/app.js", "x");
    writeFile(tmp, "webroot/css/img.png", "");
    writeFile(tmp, "webroot/css/main.css", "x");

    const result = analyzeAssets(tmp);
    assert.equal(result.js.length, 1);
    assert.equal(result.css.length, 1);
  });
});

// =========================================================================
// analyzeConstants
// =========================================================================
describe("analyzeConstants", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty when file does not exist", () => {
    tmp = createTmpDir();
    const result = analyzeConstants(tmp);
    assert.deepStrictEqual(result, { scalars: [], selectOptions: [] });
  });

  it("parses scalar constants", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/const.php",
      `<?php
$config['APP_VERSION'] = '1.2.3';
$config['DEBUG_MODE'] = true;
`,
    );

    const result = analyzeConstants(tmp);
    assert.equal(result.scalars.length, 2);
    assert.equal(result.scalars[0].name, "APP_VERSION");
    assert.equal(result.scalars[0].value, "1.2.3");
  });

  it("parses array select options", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/const.php",
      `<?php
$config['STATUS'] = array(
  '1' => 'Active',
  '2' => 'Inactive'
);
`,
    );

    const result = analyzeConstants(tmp);
    assert.equal(result.selectOptions.length, 1);
    assert.equal(result.selectOptions[0].name, "STATUS");
    assert.equal(result.selectOptions[0].options.length, 2);
    assert.equal(result.selectOptions[0].options[0].key, "1");
    assert.equal(result.selectOptions[0].options[0].label, "Active");
  });

  it("parses mixed scalars and arrays", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/const.php",
      `<?php
$config['SITE_NAME'] = 'MyApp';
$config['ROLES'] = array(
  'admin' => 'Administrator',
  'user' => 'Regular User'
);
$config['MAX_ITEMS'] = 100;
`,
    );

    const result = analyzeConstants(tmp);
    assert.equal(result.scalars.length, 2);
    assert.equal(result.selectOptions.length, 1);
  });
});

// =========================================================================
// analyzeBootstrap
// =========================================================================
describe("analyzeBootstrap", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty object when file does not exist", () => {
    tmp = createTmpDir();
    const result = analyzeBootstrap(tmp);
    assert.deepStrictEqual(result, {});
  });

  it("parses site title from Configure::write", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/bootstrap.php",
      `<?php
Configure::write('SITE_TITLE', 'My Application');
`,
    );

    const result = analyzeBootstrap(tmp);
    assert.equal(result.siteTitle, "My Application");
  });

  it("parses plugins, log channels, and environments", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/bootstrap.php",
      `<?php
Configure::write('CAKE_ENV', 'production');
Configure::write('CAKE_ENV', 'staging');
CakePlugin::load('DebugKit');
CakePlugin::load('Migrations');
CakeLog::config('error', array('engine' => 'FileLog'));
CakeLog::config('debug', array('engine' => 'FileLog'));
`,
    );

    const result = analyzeBootstrap(tmp);
    assert.deepStrictEqual(result.environments, ["production", "staging"]);
    assert.deepStrictEqual(result.plugins, ["DebugKit", "Migrations"]);
    assert.deepStrictEqual(result.logChannels, ["error", "debug"]);
  });

  it("parses App::build class paths", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/bootstrap.php",
      `<?php
App::build(array(
  'Model' => array(APP . 'Model/Logic/'),
  'Controller' => array(APP . 'Controller/Api/')
));
`,
    );

    const result = analyzeBootstrap(tmp);
    assert.equal(result.classPaths.length, 2);
    assert.deepStrictEqual(result.classPaths[0], {
      type: "Model",
      path: "Model/Logic/",
    });
  });

  it("parses Configure::write entries", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/bootstrap.php",
      `<?php
Configure::write('SITE_TITLE', 'TestApp');
Configure::write('debug', 0);
`,
    );

    const result = analyzeBootstrap(tmp);
    assert.ok(result.configureWrites.length >= 2);
    const siteEntry = result.configureWrites.find(
      (e) => e.key === "SITE_TITLE",
    );
    assert.equal(siteEntry.value, "TestApp");
  });

  it("ignores commented-out plugins and lines", () => {
    tmp = createTmpDir();
    writeFile(
      tmp,
      "Config/bootstrap.php",
      `<?php
CakePlugin::load('Active');
// CakePlugin::load('Disabled');
# CakePlugin::load('AlsoDisabled');
`,
    );

    const result = analyzeBootstrap(tmp);
    assert.deepStrictEqual(result.plugins, ["Active"]);
  });
});

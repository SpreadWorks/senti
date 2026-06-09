/**
 * ConfigSource — CakePHP 2.x configuration DataSource.
 *
 * CakePHP-only category: extends webapp-data-source.
 *
 * Matches many different config-related files. Each file becomes one
 * ConfigEntry with relevant fields populated; resolve methods aggregate
 * across entries.
 */

import fs from "fs";
import path from "path";

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const stripBlockComments = container.get("phpParser.stripBlockComments");
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const hasSegmentPath = container.get("pathMatch.hasSegmentPath");
  const WebappDataSource = container.getPreset("webapp").dataSources["webapp-data-source"];

  class ConfigEntry extends AnalysisEntry {
    configType = null;
    constants = null;
    bootstrap = null;
    appController = null;
    appModel = null;
    assets = null;
    acl = null;
    permissionComponent = null;
    logicClasses = null;
    titlesGraphMapping = null;
    composerDeps = null;
    commandDetails = null;
    static summary = {};
  }

  function parseConstants(content) {
    const scalars = [];
    const selectOptions = [];

    const allRe = /\$config\s*\[?\s*["']([^"']+)["']\s*\]?\s*=\s*/g;
    let m;
    while ((m = allRe.exec(content)) !== null) {
      const name = m[1];
      const rest = content.slice(m.index + m[0].length);

      if (/^\s*array\s*\(/.test(rest)) {
        const openIdx = rest.indexOf("(");
        let depth = 1;
        let i = openIdx + 1;
        while (i < rest.length && depth > 0) {
          if (rest[i] === "(") depth++;
          else if (rest[i] === ")") depth--;
          i++;
        }
        if (depth === 0) {
          const body = rest.slice(openIdx + 1, i - 1);
          const options = [];
          const optRe = /["']([^"']+)["']\s*=>\s*["']([^"']+)["']/g;
          let om;
          while ((om = optRe.exec(body)) !== null) {
            options.push({ key: om[1], label: om[2] });
          }
          selectOptions.push({ name, options });
        }
      } else {
        const valMatch = rest.match(/^(.+?)\s*;/);
        if (valMatch) {
          let value = valMatch[1].trim();
          value = value.replace(/^["']|["']$/g, "");
          scalars.push({ name, value });
        }
      }
    }

    return { scalars, selectOptions };
  }

  function parseBootstrap(content) {
    const src = stripBlockComments(content);
    const active = src.replace(/(?:^|\n)\s*(?:\/\/|#).*$/gm, "");
    const result = {
      siteTitle: "",
      environments: [],
      plugins: [],
      logChannels: [],
      classPaths: [],
      configureWrites: [],
    };

    const titleMatch = active.match(/Configure::write\s*\(\s*['"]SITE_TITLE['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    if (titleMatch) result.siteTitle = titleMatch[1];

    const envRe = /CAKE_ENV['"]\s*,\s*['"](\w+)['"]/g;
    const envSet = new Set();
    let em;
    while ((em = envRe.exec(active)) !== null) envSet.add(em[1]);
    result.environments = [...envSet].sort();

    const pluginRe = /CakePlugin::load\s*\(\s*['"](\w+)['"]/g;
    while ((em = pluginRe.exec(active)) !== null) result.plugins.push(em[1]);

    const logRe = /CakeLog::config\s*\(\s*['"]([^'"]+)['"]/g;
    while ((em = logRe.exec(active)) !== null) result.logChannels.push(em[1]);

    const buildRe = /['"](\w+)['"]\s*=>\s*array\s*\(\s*APP\s*\.\s*['"]([^'"]+)['"]/g;
    while ((em = buildRe.exec(active)) !== null) {
      result.classPaths.push({ type: em[1], path: em[2] });
    }

    const cwRe = /Configure\s*::\s*write\s*\(\s*['"]([^'"]+)["']\s*,\s*(.+?)\s*\)/g;
    while ((em = cwRe.exec(active)) !== null) {
      let value = em[2].trim();
      if (value.startsWith("array")) value = "array(...)";
      value = value.replace(/^["']|["']$/g, "");
      result.configureWrites.push({ key: em[1], value });
    }

    return result;
  }

  function parseAppController(content) {
    const src = stripBlockComments(content);
    const result = { components: [], helpers: [], authConfig: {}, methods: [] };

    const compSection = src.match(/\$components\s*=\s*array\s*\(/);
    if (compSection) {
      const startIdx = compSection.index + compSection[0].length;
      let depth = 1;
      let i = startIdx;
      while (i < src.length && depth > 0) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") depth--;
        i++;
      }
      const compBody = src.slice(startIdx, i - 1);
      let d = 0;
      let last = 0;
      const segments = [];
      for (let j = 0; j < compBody.length; j++) {
        if (compBody[j] === "(" || compBody[j] === "[") d++;
        else if (compBody[j] === ")" || compBody[j] === "]") d--;
        else if (compBody[j] === "," && d === 0) {
          segments.push(compBody.slice(last, j).trim());
          last = j + 1;
        }
      }
      segments.push(compBody.slice(last).trim());
      for (const seg of segments) {
        if (!seg) continue;
        const nameMatch = seg.match(/^['"](\w+)['"]/);
        if (nameMatch) result.components.push(nameMatch[1]);
      }
    }

    const helperMatch = src.match(/\$helpers\s*=\s*array\s*\(([^)]+)\)/);
    if (helperMatch) {
      const helperRe = /['"](\w+)['"]\s*=>\s*array\s*\(\s*['"]className['"]\s*=>\s*['"](\w+)['"]/g;
      let hm;
      while ((hm = helperRe.exec(helperMatch[1])) !== null) {
        result.helpers.push({ name: hm[1], className: hm[2] });
      }
    }

    const authSection = src.match(/'Auth'\s*=>\s*array\s*\(([\s\S]*?)\),\s*'Acl'/);
    if (authSection) {
      const authBody = authSection[1];
      const authorizeMatch = authBody.match(/['"]authorize['"]\s*=>\s*array\s*\(\s*['"](\w+)['"]/);
      if (authorizeMatch) result.authConfig.authorize = authorizeMatch[1];
      const authMatch = authBody.match(/['"]authenticate['"]\s*=>\s*array\s*\(\s*['"](\w+)['"]/);
      if (authMatch) result.authConfig.authenticate = authMatch[1];
      const userModelMatch = authBody.match(/['"]userModel['"]\s*=>\s*['"](\w+)['"]/);
      if (userModelMatch) result.authConfig.userModel = userModelMatch[1];
      const fieldMatch = authBody.match(/['"]username['"]\s*=>\s*['"](\w+)['"]/);
      if (fieldMatch) result.authConfig.loginField = fieldMatch[1];
      const loginRedirMatch = authBody.match(/['"]loginRedirect['"]\s*=>\s*array\s*\(\s*['"]controller['"]\s*=>\s*['"](\w+)['"]/);
      if (loginRedirMatch) result.authConfig.loginRedirect = loginRedirMatch[1] + "/index";
      const logoutRedirMatch = authBody.match(/['"]logoutRedirect['"]\s*=>\s*array\s*\(\s*['"]controller['"]\s*=>\s*['"](\w+)['"][^)]*['"]action['"]\s*=>\s*['"](\w+)['"]/);
      if (logoutRedirMatch) result.authConfig.logoutRedirect = logoutRedirMatch[1] + "/" + logoutRedirMatch[2];
    }

    const fnRe = /(public|protected|private)\s+function\s+(\w+)\s*\(/g;
    let fm;
    while ((fm = fnRe.exec(src)) !== null) {
      result.methods.push({ name: fm[2], visibility: fm[1] });
    }

    return result;
  }

  function parseAppModel(content) {
    const src = stripBlockComments(content);
    const result = { behaviors: [], callbacks: [], auditFields: [], methods: [] };

    const actsAsMatch = src.match(/\$actsAs\s*=\s*array\s*\(\s*["'](\w+)["']/);
    if (actsAsMatch) result.behaviors.push(actsAsMatch[1]);

    if (/function\s+beforeSave\s*\(/.test(src)) result.callbacks.push("beforeSave");
    if (/function\s+afterSave\s*\(/.test(src)) result.callbacks.push("afterSave");

    const auditFields = ["created_by", "created_ts", "updated_by", "updated_ts"];
    for (const field of auditFields) {
      if (src.includes(`'${field}'`)) result.auditFields.push(field);
    }

    const fnRe = /(public\s+)?function\s+(\w+)\s*\(/g;
    let fm;
    while ((fm = fnRe.exec(src)) !== null) {
      const name = fm[2];
      if (name === "__construct") continue;
      result.methods.push({ name, description: name });
    }

    return result;
  }

  function parseAssets(absPath) {
    const fileName = path.basename(absPath);
    const JS_LIBRARY_PATTERNS = [
      { pattern: /jquery-(\d+\.\d+\.\d+)/i, library: "jQuery" },
      { pattern: /jquery[-.]ui/i, library: "jQuery UI" },
      { pattern: /jquery[-.]cookie/i, library: "jQuery Cookie" },
      { pattern: /jquery[-.]datePicker/i, library: "jQuery DatePicker" },
      { pattern: /jquery[-.]datetimePicker/i, library: "jQuery DateTimePicker" },
      { pattern: /jquery[-.]fancybox/i, library: "FancyBox" },
      { pattern: /jquery[-.]tablefix/i, library: "jQuery TableFix" },
      { pattern: /highcharts/i, library: "Highcharts" },
    ];

    if (absPath.includes("/webroot/js/") && fileName.endsWith(".js")) {
      const stat = fs.statSync(absPath);
      const entry = { file: fileName, size: stat.size };
      for (const { pattern, library } of JS_LIBRARY_PATTERNS) {
        const m = fileName.match(pattern);
        if (m) {
          entry.library = library;
          if (m[1]) entry.version = m[1];
          break;
        }
      }
      if (!entry.library) entry.type = "custom";
      return { js: [entry], css: [] };
    }

    if (absPath.includes("/webroot/css/") && fileName.endsWith(".css")) {
      const stat = fs.statSync(absPath);
      const isLib = /jquery|fancybox|datepicker|datetimepicker/i.test(fileName) || fileName === "cake.generic.css";
      return {
        js: [],
        css: [{ file: fileName, size: stat.size, type: isLib ? "library" : "custom" }],
      };
    }

    return null;
  }

  function parseAcl(content) {
    const raw = stripBlockComments(content);

    const aliases = [];
    const aliasSection = raw.match(/\$config\['alias'\]\s*=\s*array\s*\(([\s\S]*?)\)\s*;/);
    if (aliasSection) {
      const re = /['"]([^'"]+)['"]\s*=>\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(aliasSection[1])) !== null) {
        aliases.push({ key: m[1], value: m[2] });
      }
    }

    const roles = [];
    const rolesSection = raw.match(/\$config\['roles'\]\s*=\s*array\s*\(([\s\S]*?)\)\s*;/);
    if (rolesSection) {
      const re = /['"]([^'"]+)['"]\s*=>\s*(null|['"][^'"]*['"])/g;
      let m;
      while ((m = re.exec(rolesSection[1])) !== null) {
        roles.push({ role: m[1], inherits: m[2] === "null" ? null : m[2].replace(/['"]/g, "") });
      }
    }

    const allowRules = [];
    const denyRules = [];
    const rulesSection = raw.match(/\$config\['rules'\]\s*=\s*array\s*\(([\s\S]*?)\)\s*;/);
    if (rulesSection) {
      const body = rulesSection[1];
      const allowSec = body.match(/'allow'\s*=>\s*array\s*\(([\s\S]*?)\)/);
      if (allowSec) {
        const re = /['"]([^'"]*)['"]\s*=>\s*['"]([^'"]+)['"]/g;
        let m;
        while ((m = re.exec(allowSec[1])) !== null) {
          allowRules.push({ resource: m[1], roles: m[2] });
        }
      }
      const denySec = body.match(/'deny'\s*=>\s*array\s*\(([\s\S]*?)\)\s*,?\s*$/);
      if (denySec) {
        const re = /['"]([^'"]*)['"]\s*=>\s*['"]([^'"]+)['"]/g;
        let m;
        while ((m = re.exec(denySec[1])) !== null) {
          denyRules.push({ resource: m[1], roles: m[2] });
        }
      }
    }

    return { aliases, roles, allow: allowRules, deny: denyRules };
  }

  function parsePermissionComponent(content) {
    const src = stripBlockComments(content);
    const methods = [];
    const fnRe = /(?:public\s+)?function\s+(\w+)\s*\(/g;
    let fm;
    while ((fm = fnRe.exec(src)) !== null) {
      if (!fm[1].startsWith("__")) methods.push(fm[1]);
    }
    return { methods };
  }

  function parseLogicClasses(content) {
    const src = stripBlockComments(content);
    const classMatch = src.match(/class\s+(\w+)\s+extends\s+(\w+)/);
    if (!classMatch) return null;

    const methods = [];
    const fnRe = /(public|protected|private)\s+function\s+(\w+)\s*\(([^)]*)\)/g;
    let fm;
    while ((fm = fnRe.exec(src)) !== null) {
      if (fm[2].startsWith("__")) continue;
      methods.push({ name: fm[2], visibility: fm[1], params: fm[3].trim() });
    }

    return {
      className: classMatch[1],
      extends: classMatch[2],
      methods,
    };
  }

  function parseTitlesGraphMapping(content) {
    const src = stripBlockComments(content);
    const actionRe = /public\s+function\s+(\w+)\s*\(\)/g;
    const results = [];
    let am;

    while ((am = actionRe.exec(src)) !== null) {
      const actionName = am[1];
      if (actionName.startsWith("__") || actionName === "beforeFilter") continue;

      const bodyStart = am.index + am[0].length;
      const nextFn = src.indexOf("public function", bodyStart + 1);
      const body = src.slice(bodyStart, nextFn > 0 ? nextFn : undefined);

      const logicRe = /\$this->(\w+Logic)->/g;
      const logics = new Set();
      let lm;
      while ((lm = logicRe.exec(body)) !== null) logics.add(lm[1]);

      let outputType = "画面表示";
      if (/OutputExcel|Excel/i.test(actionName)) outputType = "Excel";
      else if (/OutputCsv|Csv/i.test(actionName)) outputType = "CSV";
      else if (/ajax/i.test(actionName)) outputType = "JSON";

      results.push({ action: actionName, logicClasses: [...logics], outputType });
    }

    return results;
  }

  function parseComposerDeps(content) {
    const json = JSON.parse(content);
    return {
      require: json.require || {},
      requireDev: json["require-dev"] || {},
    };
  }

  function parseCommandDetails(content) {
    const src = stripBlockComments(content);
    const classMatch = src.match(/class\s+(\w+)\s+extends\s+(\w+)/);
    if (!classMatch || classMatch[1] === "AppShell") return null;

    const raw = content;
    const hasMail = /CakeEmail/.test(raw);
    const hasFileOps = /rename\s*\(|file_get_contents|fopen|unlink|file_put_contents/.test(raw);
    const hasTransaction = /begin\s*\(\)|rollback\s*\(\)|commit\s*\(/.test(raw);

    const flowSteps = [];
    if (/getTarget|find\s*\(/.test(src)) flowSteps.push("対象データ取得");
    if (/readdir|scandir|glob\(|file_get_contents/.test(src)) flowSteps.push("ファイル読込");
    if (/import/i.test(src)) flowSteps.push("データインポート");
    if (hasTransaction) flowSteps.push("トランザクション管理");
    if (/createViewReports/.test(src)) flowSteps.push("レポート生成");
    if (hasMail) flowSteps.push("メール通知");
    if (/rename\s*\(/.test(src)) flowSteps.push("ファイルバックアップ");
    if (/unlink\s*\(/.test(src)) flowSteps.push("ファイル削除");

    return {
      className: classMatch[1],
      hasMail,
      hasFileOps,
      hasTransaction,
      flowSteps,
    };
  }

  class CakephpConfigSource extends WebappDataSource {
    static Entry = ConfigEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "app/Config/")
        || hasSegmentPath(relPath, "app/Controller/AppController.php")
        || hasSegmentPath(relPath, "app/Model/AppModel.php")
        || hasSegmentPath(relPath, "app/Controller/Component/PermissionComponent.php")
        || (hasPathPrefix(relPath, "app/Model/Logic/") && /\w+\.php$/.test(relPath))
        || hasSegmentPath(relPath, "app/Controller/TitlesGraphController.php")
        || hasPathPrefix(relPath, "app/webroot/js/")
        || hasPathPrefix(relPath, "app/webroot/css/")
        || (hasPathPrefix(relPath, "app/Console/Command/") && /\w+Shell\.php$/.test(relPath))
        || hasSegmentPath(relPath, "composer.json");
    }

    parse(absPath) {
      const entry = new ConfigEntry();
      const content = fs.readFileSync(absPath, "utf8");
      const fileName = path.basename(absPath);

      if (absPath.endsWith("/Config/const.php")) {
        entry.configType = "constants";
        entry.constants = parseConstants(content);
      } else if (absPath.endsWith("/Config/bootstrap.php")) {
        entry.configType = "bootstrap";
        entry.bootstrap = parseBootstrap(content);
      } else if (absPath.endsWith("/Config/acl.php")) {
        entry.configType = "acl";
        entry.acl = parseAcl(content);
      } else if (absPath.endsWith("/Config/email.php")) {
        entry.configType = "emailConfig";
        entry.bootstrap = null;
        entry.constants = null;
      } else if (absPath.endsWith("/Controller/AppController.php")) {
        entry.configType = "appController";
        entry.appController = parseAppController(content);
      } else if (absPath.endsWith("/Model/AppModel.php")) {
        entry.configType = "appModel";
        entry.appModel = parseAppModel(content);
      } else if (absPath.endsWith("/Controller/Component/PermissionComponent.php")) {
        entry.configType = "permissionComponent";
        entry.permissionComponent = parsePermissionComponent(content);
      } else if (/\/Model\/Logic\/\w+\.php$/.test(absPath)) {
        entry.configType = "logicClass";
        const lc = parseLogicClasses(content);
        entry.logicClasses = lc ? [lc] : [];
      } else if (absPath.endsWith("/Controller/TitlesGraphController.php")) {
        entry.configType = "titlesGraphMapping";
        entry.titlesGraphMapping = parseTitlesGraphMapping(content);
      } else if (fileName === "composer.json") {
        entry.configType = "composerDeps";
        entry.composerDeps = parseComposerDeps(content);
      } else if (/\/webroot\/(js|css)\//.test(absPath)) {
        entry.configType = "assets";
        entry.assets = parseAssets(absPath);
      } else if (/\/Console\/Command\/\w+Shell\.php$/.test(absPath)) {
        entry.configType = "commandDetails";
        const cd = parseCommandDetails(content);
        entry.commandDetails = cd ? [cd] : [];
      }

      return entry;
    }

    _collectField(analysis, field) {
      return (analysis.config?.entries || [])
        .filter((e) => e[field] != null)
        .map((e) => e[field]);
    }

    _firstField(analysis, field) {
      const items = this._collectField(analysis, field);
      return items.length > 0 ? items[0] : null;
    }

    stack(analysis, labels) {
      const rows = [];
      const deps = this._firstField(analysis, "composerDeps");
      if (deps?.require?.php) {
        rows.push(["Language", "PHP", deps.require.php]);
      }
      rows.push(["Framework", "CakePHP", "2.x"]);
      const bootstrap = this._firstField(analysis, "bootstrap");
      if (bootstrap?.plugins?.length > 0) {
        rows.push(["Plugins", bootstrap.plugins.join(", "), "—"]);
      }
      const assetsAll = this._collectField(analysis, "assets");
      const jsAssets = assetsAll.flatMap((a) => a.js || []).filter((a) => a.library);
      for (const a of jsAssets) {
        rows.push(["Frontend", a.library, a.version || "—"]);
      }
      if (rows.length === 0) return null;
      const hdr = labels.length >= 3 ? labels : ["Category", "Technology", "Version"];
      return this.toMarkdownTable(rows, hdr);
    }

    db(analysis, labels) {
      const bootstrap = this._firstField(analysis, "bootstrap");
      if (!bootstrap?.environments) return null;
      const envs = bootstrap.environments;
      if (envs.length === 0) return null;
      const rows = this.toRows(envs, (env) => [env, "—", ""]);
      return this.toMarkdownTable(rows, labels);
    }

    composer(analysis, labels) {
      const deps = this._firstField(analysis, "composerDeps");
      if (!deps) return null;
      const rows = [];
      for (const [pkg, ver] of Object.entries(deps.require)) {
        rows.push([pkg, ver, this.desc("composerDeps", pkg)]);
      }
      for (const [pkg, ver] of Object.entries(deps.requireDev)) {
        rows.push([`${pkg} (dev)`, ver, this.desc("composerDeps", pkg)]);
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    bootstrap(analysis, labels) {
      const b = this._firstField(analysis, "bootstrap");
      if (!b) return null;
      const rows = [];
      if (b.siteTitle) rows.push(["サイトタイトル", b.siteTitle]);
      if (b.environments?.length > 0) rows.push(["環境", b.environments.join(", ")]);
      if (b.plugins?.length > 0) rows.push(["プラグイン", b.plugins.join(", ")]);
      if (b.logChannels?.length > 0) rows.push(["ログチャネル", b.logChannels.join(", ")]);
      if (b.classPaths?.length > 0) {
        const paths = b.classPaths.map((p) => `${p.type}: ${p.path}`).join(", ");
        rows.push(["クラスパス追加", paths]);
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    constants(analysis, labels) {
      const constantsData = this._firstField(analysis, "constants");
      if (!constantsData?.scalars) return null;
      const seen = new Set();
      const items = this.mergeDesc(
        constantsData.scalars.filter((s) => {
          if (seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        }),
        "constants", "name",
      );
      if (items.length === 0) return null;
      const rows = this.toRows(items, (s) => [
        s.name, s.value, s.summary || "—",
      ]);
      return this.toMarkdownTable(rows, labels);
    }

    constantsSelect(analysis, labels) {
      const constantsData = this._firstField(analysis, "constants");
      if (!constantsData?.selectOptions) return null;
      const items = this.mergeDesc(constantsData.selectOptions, "selectConstants", "name");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (s) => {
        const opts = s.options.map((o) => `${o.key}=${o.label}`).join(", ");
        return [s.name, `${s.summary || "—"}: ${opts}`];
      });
      return this.toMarkdownTable(rows, labels);
    }

    auth(analysis, labels) {
      const ac = this._firstField(analysis, "appController");
      if (!ac) return null;
      const rows = [];
      if (ac.components?.length > 0) rows.push(["コンポーネント", ac.components.join(", ")]);
      if (ac.authConfig?.authorize) rows.push(["認可方式", ac.authConfig.authorize]);
      if (ac.authConfig?.authenticate) rows.push(["認証方式", ac.authConfig.authenticate]);
      if (ac.authConfig?.userModel) rows.push(["ユーザーモデル", ac.authConfig.userModel]);
      if (ac.authConfig?.loginField) rows.push(["ログインフィールド", ac.authConfig.loginField]);
      if (ac.authConfig?.loginRedirect) rows.push(["ログイン後リダイレクト", ac.authConfig.loginRedirect]);
      if (ac.authConfig?.logoutRedirect) rows.push(["ログアウト後リダイレクト", ac.authConfig.logoutRedirect]);
      if (ac.helpers?.length > 0) {
        const helperStr = ac.helpers.map((h) => `${h.name} → ${h.className}`).join(", ");
        rows.push(["ヘルパー", helperStr]);
      }
      if (rows.length === 0) return null;
      return this.toMarkdownTable(rows, labels);
    }

    acl(analysis, labels) {
      const aclData = this._firstField(analysis, "acl");
      if (!aclData) return null;
      if (!aclData.aliases || aclData.aliases.length === 0) return null;
      const rows = [];
      for (const alias of aclData.aliases) {
        const groupId = alias.key.replace("Role/", "");
        const roleName = alias.value.replace("Role/", "");
        const allowRules = [...new Set(
          aclData.allow.filter((r) => r.roles.includes(roleName)).map((r) => `許可: ${r.resource}`),
        )];
        const denyRules = [...new Set(
          aclData.deny.filter((r) => r.roles.includes(roleName)).map((r) => `拒否: ${r.resource}`),
        )];
        const permissions = [...allowRules, ...denyRules].join(", ") || "デフォルト（権限定義なし）";
        rows.push([roleName, groupId, permissions]);
      }
      return this.toMarkdownTable(rows, labels);
    }

    assets(analysis, labels) {
      const assetsAll = this._collectField(analysis, "assets");
      const jsItems = assetsAll.flatMap((a) => a.js || []).filter((a) => a.library);
      if (jsItems.length === 0) return null;
      const rows = this.toRows(jsItems, (asset) => [
        asset.library, asset.version || "—", asset.file,
      ]);
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpConfigSource;
}

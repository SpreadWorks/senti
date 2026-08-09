import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../helpers/tmp-dir.js";
import { UpgradeDirectoryMigration } from "../../src/lib/upgrade-migration.js";

const CLI = path.resolve("src/senrail.js");
const MIGRATION_MODULE = pathToFileURL(path.resolve("src/lib/upgrade-migration.js")).href;

function validConfig() {
  return {
    name: "user project senti remains a project name",
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  };
}

function seedLegacyProject(root, directory) {
  writeJson(root, `${directory}/config.json`, validConfig());
  writeJson(root, `${directory}/config.local.json`, { docs: { mode: "generate" } });
  writeFile(root, `${directory}/templates/senti-note.md`, "Use senti, .senti, sentiDir, SENTI, sentiClient, SentiClient, SENTI_WORK_ROOT, and sentinel unchanged.\n");
  writeFile(root, `${directory}/output/review.md`, "historical senti log remains raw\n");
  writeFile(root, `${directory}/plugins/plugin-data.txt`, "senti plugin data is copied raw\n");
  fs.symlinkSync("../.senti/output", path.join(root, directory, "templates", "managed-output"));
  fs.symlinkSync("../senti-other/output", path.join(root, directory, "templates", "unrelated-output"));
  writeFile(root, ".gitignore", [
    "node_modules",
    `${directory}/*`,
    `!${directory}/config.json`,
    `!${directory}/templates/`,
    `!${directory}/output/`,
    `!${directory}/presets/`,
    `${directory}/output/acceptance-report-*.json`,
    "user-rule",
    "",
  ].join("\n"));
  writeFile(root, ".gitattributes", `${directory}/output/analysis.json merge=ours\n*.png binary\n`);
  for (const base of [".agents", ".claude"]) {
    writeFile(root, `${base}/skills/sdd-forge.flow/SKILL.md`, "old\n");
    writeFile(root, `${base}/skills/senti.flow/SKILL.md`, "old\n");
    writeFile(root, `${base}/skills/user.skill/SKILL.md`, "user\n");
  }
}

function runUpgrade(root, args) {
  return spawnSync(process.execPath, [CLI, "upgrade", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENRAIL_WORK_ROOT: root, SENRAIL_SOURCE_ROOT: root },
  });
}

function addPluginConfigAndSkill(root, directory) {
  const config = validConfig();
  config.plugin = {
    sources: [{ id: "fixture", type: "local", path: ".senrail/plugins/fixture" }],
    packages: [{
      id: "fixture",
      source: "fixture",
      commit: "0000000000000000000000000000000000000000",
    }],
  };
  config.fixtureSetting = "enabled";
  writeJson(root, `${directory}/config.json`, config);
  writeJson(root, `${directory}/plugins/fixture/plugin.json`, {
    name: "fixture",
    files: ["plugin.json", "skills/", "config.schema.json"],
    contributions: {
      skills: [{ name: "external.skill", path: "skills/external.skill/SKILL.md" }],
      config: { schema: "config.schema.json" },
    },
  });
  writeJson(root, `${directory}/plugins/fixture/config.schema.json`, {
    properties: {
      fixtureSetting: { type: "string", minLength: 1 },
    },
  });
  writeFile(root, `${directory}/plugins/fixture/skills/external.skill/SKILL.md`, "external plugin\n");
}

function crashAfterJournalWrite(root, writeNumber) {
  const script = `
    import fs from "node:fs";
    import path from "node:path";
    import { UpgradeDirectoryMigration } from ${JSON.stringify(MIGRATION_MODULE)};
    const originalRename = fs.renameSync;
    const originalWrite = fs.writeFileSync;
    const originalOpen = fs.openSync;
    const journalPath = path.join(${JSON.stringify(root)}, ".tmp", "senrail-upgrade-migrate.json");
    const journalReservationDescriptors = new Set();
    let journalWrites = 0;
    const crashAfterJournalWrite = () => {
      journalWrites += 1;
      if (journalWrites === ${writeNumber}) process.kill(process.pid, "SIGKILL");
    };
    fs.writeFileSync = (target, content, ...rest) => {
      const result = originalWrite(target, content, ...rest);
      if (journalReservationDescriptors.delete(target)) crashAfterJournalWrite();
      return result;
    };
    fs.openSync = (target, flags, ...rest) => {
      const descriptor = originalOpen(target, flags, ...rest);
      if (path.resolve(String(target)) === journalPath && (flags & fs.constants.O_EXCL)) {
        journalReservationDescriptors.add(descriptor);
      }
      return descriptor;
    };
    fs.renameSync = (from, to, ...rest) => {
      const result = originalRename(from, to, ...rest);
      if (String(to).endsWith(".tmp/senrail-upgrade-migrate.json")) {
        crashAfterJournalWrite();
      }
      return result;
    };
    new UpgradeDirectoryMigration(${JSON.stringify(root)}, { logger: { log() {}, error() {} } }).run();
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("upgrade --migrate", () => {
  const roots = [];
  afterEach(() => {
    for (const root of roots.splice(0)) removeTmpDir(root);
  });

  for (const legacyDirectory of [".sdd-forge", ".senti"]) {
    it(`migrates ${legacyDirectory} transactionally before running normal upgrade`, () => {
      const root = createTmpDir("senrail-upgrade-migrate-");
      roots.push(root);
      seedLegacyProject(root, legacyDirectory);
      const originalConfig = fs.readFileSync(path.join(root, legacyDirectory, "config.json"));

      const result = runUpgrade(root, ["--migrate"]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(fs.existsSync(path.join(root, legacyDirectory)), false);
      assert.equal(fs.existsSync(path.join(root, ".sdd-forge")), false);
      assert.equal(fs.existsSync(path.join(root, ".senti")), false);
      assert.equal(fs.readFileSync(path.join(root, ".senrail", "config.json"), "utf8"), originalConfig.toString("utf8"));
      assert.equal(
        fs.readFileSync(path.join(root, ".senrail", "templates", "senrail-note.md"), "utf8"),
        "Use senrail, .senrail, managedDir, SENRAIL, senrailClient, SenrailClient, SENTI_WORK_ROOT, and sentinel unchanged.\n",
      );
      assert.equal(
        fs.readFileSync(path.join(root, ".senrail", "plugins", "plugin-data.txt"), "utf8"),
        "senti plugin data is copied raw\n",
      );
      assert.equal(
        fs.readFileSync(path.join(root, ".senrail", "output", "review.md"), "utf8"),
        "historical senti log remains raw\n",
      );
      assert.equal(fs.readlinkSync(path.join(root, ".senrail", "templates", "managed-output")), "../.senrail/output");
      assert.equal(fs.readlinkSync(path.join(root, ".senrail", "templates", "unrelated-output")), "../senti-other/output");
      const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
      assert.match(ignore, /^\.senrail\/\*/m);
      assert.doesNotMatch(ignore, new RegExp(`${legacyDirectory.replace(".", "\\.")}\\/\\*`));
      assert.match(ignore, /node_modules/);
      assert.match(ignore, /user-rule/);
      const attributes = fs.readFileSync(path.join(root, ".gitattributes"), "utf8");
      assert.match(attributes, /^\.senrail\/output\/analysis\.json merge=ours/m);
      assert.match(attributes, /\*\.png binary/);
      for (const base of [".agents", ".claude"]) {
        assert.equal(fs.existsSync(path.join(root, base, "skills", "sdd-forge.flow")), false);
        assert.equal(fs.existsSync(path.join(root, base, "skills", "senti.flow")), false);
        assert.equal(fs.readFileSync(path.join(root, base, "skills", "user.skill", "SKILL.md"), "utf8"), "user\n");
        assert.ok(fs.existsSync(path.join(root, base, "skills", "senrail.flow", "SKILL.md")));
      }
    });
  }

  it("does not merge two legacy directories or create migration residue", () => {
    const root = createTmpDir("senrail-upgrade-migrate-collision-");
    roots.push(root);
    seedLegacyProject(root, ".sdd-forge");
    seedLegacyProject(root, ".senti");

    const result = runUpgrade(root, ["--migrate"]);

    assert.notEqual(result.status, 0);
    assert.ok(fs.existsSync(path.join(root, ".sdd-forge")));
    assert.ok(fs.existsSync(path.join(root, ".senti")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("does nothing when a canonical managed directory already exists", () => {
    const root = createTmpDir("senrail-upgrade-migrate-canonical-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    writeFile(root, ".senrail/keep.txt", "canonical\n");

    const result = runUpgrade(root, ["--migrate"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(fs.existsSync(path.join(root, ".senti")));
    assert.equal(fs.readFileSync(path.join(root, ".senrail", "keep.txt"), "utf8"), "canonical\n");
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("leaves a project without any managed directory and its root metadata untouched", () => {
    const root = createTmpDir("senrail-upgrade-migrate-none-");
    roots.push(root);
    writeFile(root, ".gitignore", "node_modules\n");
    writeFile(root, ".gitattributes", "*.png binary\n");
    const beforeIgnore = fs.readFileSync(path.join(root, ".gitignore"));
    const beforeAttributes = fs.readFileSync(path.join(root, ".gitattributes"));

    const result = runUpgrade(root, ["--migrate"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitignore")), beforeIgnore);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitattributes")), beforeAttributes);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("rejects an active or preparing legacy Flow before creating staging", () => {
    const root = createTmpDir("senrail-upgrade-migrate-active-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    writeFile(root, ".senti/.active-flow.pending", "{}\n");

    const result = runUpgrade(root, ["--migrate"]);

    assert.notEqual(result.status, 0);
    assert.ok(fs.existsSync(path.join(root, ".senti")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("rejects a managed writer lock and broken journals without changing source data", () => {
    const root = createTmpDir("senrail-upgrade-migrate-safety-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    const configPath = path.join(root, ".senti", "config.json");
    const before = fs.readFileSync(configPath);
    writeFile(root, ".senti/.repository-maintenance.lock", "writer\n");

    const locked = runUpgrade(root, ["--migrate"]);

    assert.notEqual(locked.status, 0);
    assert.deepEqual(fs.readFileSync(configPath), before);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
    fs.rmSync(path.join(root, ".senti", ".repository-maintenance.lock"));
    writeFile(root, ".senti/.active-flow.lock", "writer\n");

    const activeFlowLock = runUpgrade(root, ["--migrate"]);

    assert.notEqual(activeFlowLock.status, 0);
    assert.deepEqual(fs.readFileSync(configPath), before);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
    fs.rmSync(path.join(root, ".senti", ".active-flow.lock"));
    writeFile(root, ".tmp/senrail-upgrade-migrate.json", "{broken\n");

    const broken = runUpgrade(root, ["--migrate"]);

    assert.notEqual(broken.status, 0);
    assert.deepEqual(fs.readFileSync(configPath), before);
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.readFileSync(path.join(root, ".tmp", "senrail-upgrade-migrate.json"), "utf8"), "{broken\n");

    const unsafeJournal = JSON.stringify({
      version: 1,
      root,
      sourceName: ".senti",
      stagingRelative: ".tmp/senrail-upgrade-migrate-00000000-0000-4000-8000-000000000000/../outside",
      sourceIdentity: { dev: 1, ino: 1 },
      stagedSentiIdentity: { dev: 1, ino: 1 },
      metadata: [],
      tempRootCreated: false,
      phase: "staged",
    }, null, 2);
    writeFile(root, ".tmp/senrail-upgrade-migrate.json", unsafeJournal);

    const unsafe = runUpgrade(root, ["--migrate"]);

    assert.notEqual(unsafe.status, 0);
    assert.deepEqual(fs.readFileSync(configPath), before);
    assert.ok(fs.existsSync(path.join(root, ".senti")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.readFileSync(path.join(root, ".tmp", "senrail-upgrade-migrate.json"), "utf8"), unsafeJournal);
  });

  it("rejects a transformed template-name collision before creating a staging directory", () => {
    const root = createTmpDir("senrail-upgrade-migrate-template-collision-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    writeFile(root, ".senti/templates/senrail-note.md", "collision\n");

    const result = runUpgrade(root, ["--migrate"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /migration path collision/);
    assert.ok(fs.existsSync(path.join(root, ".senti")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("detects a concurrent managed-directory writer before starting commit", () => {
    const root = createTmpDir("senrail-upgrade-migrate-concurrent-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    const configPath = path.join(root, ".senti", "config.json");
    const originalCopy = fs.copyFileSync;
    let changed = false;
    fs.copyFileSync = (from, to, ...rest) => {
      const result = originalCopy(from, to, ...rest);
      if (!changed && path.resolve(from) === configPath) {
        changed = true;
        fs.writeFileSync(configPath, `${JSON.stringify({ ...validConfig(), concurrency: 2 })}\n`);
      }
      return result;
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /changed while migration staging was in progress/,
      );
    } finally {
      fs.copyFileSync = originalCopy;
    }

    assert.equal(changed, true);
    assert.ok(fs.existsSync(path.join(root, ".senti")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("rejects a staged-copy mutation before publishing a journal or changing the source", () => {
    const root = createTmpDir("senrail-upgrade-migrate-staged-verification-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    const configPath = path.join(root, ".senti", "config.json");
    const originalConfig = fs.readFileSync(configPath);
    const originalIgnore = fs.readFileSync(path.join(root, ".gitignore"));
    const originalAttributes = fs.readFileSync(path.join(root, ".gitattributes"));
    const originalCopy = fs.copyFileSync;
    let tampered = false;
    fs.copyFileSync = (from, to, ...rest) => {
      const result = originalCopy(from, to, ...rest);
      if (!tampered && path.resolve(from) === configPath) {
        tampered = true;
        fs.writeFileSync(to, "{\"tampered\":true}\n");
      }
      return result;
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /staged tree does not match the source-derived transformation/,
      );
    } finally {
      fs.copyFileSync = originalCopy;
    }

    assert.equal(tampered, true);
    assert.deepEqual(fs.readFileSync(configPath), originalConfig);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitignore")), originalIgnore);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitattributes")), originalAttributes);
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("preserves managed directory, nested directory, and file modes in the staged tree", () => {
    const root = createTmpDir("senrail-upgrade-migrate-modes-");
    roots.push(root);
    seedLegacyProject(root, ".sdd-forge");
    writeFile(root, ".sdd-forge/templates/private/note.md", "Use senti\n");
    fs.chmodSync(path.join(root, ".sdd-forge"), 0o750);
    fs.chmodSync(path.join(root, ".sdd-forge", "templates", "private"), 0o711);
    fs.chmodSync(path.join(root, ".sdd-forge", "templates", "private", "note.md"), 0o640);

    new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run();

    assert.equal(fs.lstatSync(path.join(root, ".senrail")).mode & 0o777, 0o750);
    assert.equal(fs.lstatSync(path.join(root, ".senrail", "templates", "private")).mode & 0o777, 0o711);
    assert.equal(fs.lstatSync(path.join(root, ".senrail", "templates", "private", "note.md")).mode & 0o777, 0o640);
  });

  it("rejects a competing initial journal publication without touching source or metadata", () => {
    const root = createTmpDir("senrail-upgrade-migrate-journal-race-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    const configPath = path.join(root, ".senti", "config.json");
    const beforeConfig = fs.readFileSync(configPath);
    const beforeIgnore = fs.readFileSync(path.join(root, ".gitignore"));
    const beforeAttributes = fs.readFileSync(path.join(root, ".gitattributes"));
    const journalPath = path.join(root, ".tmp", "senrail-upgrade-migrate.json");
    const originalOpen = fs.openSync;
    let competing = false;
    fs.openSync = (target, flags, ...rest) => {
      if (!competing && path.resolve(String(target)) === journalPath) {
        competing = true;
        fs.writeFileSync(journalPath, "{\"competing\":true}\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
      }
      return originalOpen(target, flags, ...rest);
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /journal was created by another migration/,
      );
    } finally {
      fs.openSync = originalOpen;
    }

    assert.equal(competing, true);
    assert.deepEqual(fs.readFileSync(configPath), beforeConfig);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitignore")), beforeIgnore);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitattributes")), beforeAttributes);
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp", "senrail-upgrade-migrate.json")), true);
    assert.equal(fs.readFileSync(journalPath, "utf8"), "{\"competing\":true}\n");
    assert.deepEqual(fs.readdirSync(path.join(root, ".tmp")), ["senrail-upgrade-migrate.json"]);
  });

  it("discards its own failed journal reservation and staging before source changes", () => {
    const root = createTmpDir("senrail-upgrade-migrate-journal-write-failure-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    const configPath = path.join(root, ".senti", "config.json");
    const beforeConfig = fs.readFileSync(configPath);
    const beforeIgnore = fs.readFileSync(path.join(root, ".gitignore"));
    const beforeAttributes = fs.readFileSync(path.join(root, ".gitattributes"));
    const journalPath = path.join(root, ".tmp", "senrail-upgrade-migrate.json");
    const originalOpen = fs.openSync;
    const originalWrite = fs.writeFileSync;
    let journalDescriptor = null;
    fs.openSync = (target, flags, ...rest) => {
      const descriptor = originalOpen(target, flags, ...rest);
      if (path.resolve(String(target)) === journalPath && (flags & fs.constants.O_EXCL)) {
        journalDescriptor = descriptor;
      }
      return descriptor;
    };
    fs.writeFileSync = (target, content, ...rest) => {
      if (target === journalDescriptor) throw new Error("injected journal authoritative write failure");
      return originalWrite(target, content, ...rest);
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /injected journal authoritative write failure/,
      );
    } finally {
      fs.openSync = originalOpen;
      fs.writeFileSync = originalWrite;
    }

    assert.notEqual(journalDescriptor, null);
    assert.deepEqual(fs.readFileSync(configPath), beforeConfig);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitignore")), beforeIgnore);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitattributes")), beforeAttributes);
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("does not overwrite a root metadata file changed during AtomicFile commit", () => {
    const root = createTmpDir("senrail-upgrade-migrate-metadata-cas-");
    roots.push(root);
    seedLegacyProject(root, ".sdd-forge");
    const configPath = path.join(root, ".sdd-forge", "config.json");
    const beforeConfig = fs.readFileSync(configPath);
    const beforeAttributes = fs.readFileSync(path.join(root, ".gitattributes"));
    const userIgnore = "user change during migration\n";
    const originalOpen = fs.openSync;
    const originalFsync = fs.fsyncSync;
    const descriptorPaths = new Map();
    let injected = false;
    fs.openSync = (target, flags, ...rest) => {
      const descriptor = originalOpen(target, flags, ...rest);
      const resolved = path.resolve(String(target));
      if (path.dirname(resolved) === root && /^\.\.gitignore\..+\.tmp$/.test(path.basename(resolved))) {
        descriptorPaths.set(descriptor, resolved);
      }
      return descriptor;
    };
    fs.fsyncSync = (descriptor, ...rest) => {
      if (!injected && descriptorPaths.has(descriptor)) {
        injected = true;
        fs.writeFileSync(path.join(root, ".gitignore"), userIgnore);
      }
      return originalFsync(descriptor, ...rest);
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /migration and rollback both failed/,
      );
    } finally {
      fs.openSync = originalOpen;
      fs.fsyncSync = originalFsync;
    }

    assert.equal(injected, true);
    assert.deepEqual(fs.readFileSync(configPath), beforeConfig);
    assert.equal(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), userIgnore);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitattributes")), beforeAttributes);
    assert.ok(fs.existsSync(path.join(root, ".sdd-forge")));
    assert.equal(fs.existsSync(path.join(root, ".senti")), false);
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.ok(fs.existsSync(path.join(root, ".tmp", "senrail-upgrade-migrate.json")));
  });

  it("is a fully read-only dry-run and reports an expected config validation failure", () => {
    const root = createTmpDir("senrail-upgrade-migrate-dry-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    writeJson(root, ".senti/config.json", {
      ...validConfig(),
      chapters: ["old-shape"],
      plugin: { repos: [] },
    });
    const before = fs.readFileSync(path.join(root, ".senti", "config.json"));

    const result = runUpgrade(root, ["--migrate", "--dry-run"]);

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout, /DRY-RUN/);
    assert.match(result.stderr, /config warning/);
    assert.match(result.stderr, /expected to fail config validation/);
    assert.deepEqual(fs.readFileSync(path.join(root, ".senti", "config.json")), before);
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("attributes effective overlay validation warnings to config.local.json", () => {
    const root = createTmpDir("senrail-upgrade-migrate-overlay-warning-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    writeJson(root, ".senti/config.local.json", { chapters: ["old-shape"] });

    const result = runUpgrade(root, ["--migrate", "--dry-run"]);

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /config\.local\.json: chapters\[0\]/);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("attributes a base nested validation error to config.json despite a sibling local overlay", () => {
    const root = createTmpDir("senrail-upgrade-migrate-overlay-base-warning-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    writeJson(root, ".senti/config.json", {
      ...validConfig(),
      docs: { languages: [], defaultLanguage: "en" },
    });
    writeJson(root, ".senti/config.local.json", { docs: { mode: "generate" } });

    const result = runUpgrade(root, ["--migrate", "--dry-run"]);

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /config\.json: docs\.languages/);
    assert.doesNotMatch(result.stderr, /config\.local\.json: docs\.languages/);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("uses legacy plugin schemas and skill contributions for an exact dry-run plan", () => {
    const root = createTmpDir("senrail-upgrade-migrate-plugin-dry-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    addPluginConfigAndSkill(root, ".senti");

    const result = runUpgrade(root, ["--migrate", "--dry-run"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /deploy enabled plugin skill external\.skill\/SKILL\.md/);
    assert.doesNotMatch(result.stderr, /config warning/);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);

    const applied = runUpgrade(root, ["--migrate"]);
    assert.equal(applied.status, 0, applied.stderr || applied.stdout);
    for (const base of [".agents", ".claude"]) {
      assert.equal(
        fs.readFileSync(path.join(root, base, "skills", "external.skill", "SKILL.md"), "utf8"),
        "external plugin\n",
      );
    }
  });

  it("keeps normal upgrade from rewriting incompatible legacy config shapes", () => {
    const root = createTmpDir("senrail-upgrade-normal-no-config-migrate-");
    roots.push(root);
    writeJson(root, ".senrail/config.json", {
      ...validConfig(),
      chapters: ["old-shape"],
      plugin: { repos: [] },
    });
    const configPath = path.join(root, ".senrail", "config.json");
    const before = fs.readFileSync(configPath);

    const result = runUpgrade(root, []);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /chapters\[0\].*must be object|plugin\.repos.*migrate/);
    assert.deepEqual(fs.readFileSync(configPath), before);
    assert.equal(fs.existsSync(path.join(root, ".senrail", "plugin-sources", "local-presets")), false);
  });

  it("preserves malformed config bytes through migration, then allows a plain-upgrade retry after repair", () => {
    const root = createTmpDir("senrail-upgrade-migrate-malformed-config-");
    roots.push(root);
    seedLegacyProject(root, ".senti");
    const malformed = "{ not json\n";
    writeFile(root, ".senti/config.json", malformed);
    writeFile(root, "package.json", "{\"name\":\"user-package\",\"scripts\":{\"x\":\"SENTI_WORK_ROOT=x\"}}\n");
    writeFile(root, "specs/001/flow.json", "historical senti data\n");
    writeFile(root, ".env", "SENTI_WORK_ROOT=project-owned\n");

    const migrated = runUpgrade(root, ["--migrate"]);

    assert.notEqual(migrated.status, 0);
    assert.equal(fs.readFileSync(path.join(root, ".senrail", "config.json"), "utf8"), malformed);
    assert.equal(fs.existsSync(path.join(root, ".senti")), false);
    assert.equal(fs.readFileSync(path.join(root, "package.json"), "utf8"), "{\"name\":\"user-package\",\"scripts\":{\"x\":\"SENTI_WORK_ROOT=x\"}}\n");
    assert.equal(fs.readFileSync(path.join(root, "specs/001/flow.json"), "utf8"), "historical senti data\n");
    assert.equal(fs.readFileSync(path.join(root, ".env"), "utf8"), "SENTI_WORK_ROOT=project-owned\n");

    const rerunMigrate = runUpgrade(root, ["--migrate"]);
    assert.equal(rerunMigrate.status, 0, rerunMigrate.stderr || rerunMigrate.stdout);
    writeJson(root, ".senrail/config.json", validConfig());
    const retriedNormal = runUpgrade(root, []);
    assert.equal(retriedNormal.status, 0, retriedNormal.stderr || retriedNormal.stdout);
  });

  it("creates missing managed root metadata and restores its absence if final rename fails", () => {
    const root = createTmpDir("senrail-upgrade-migrate-metadata-rollback-");
    roots.push(root);
    writeJson(root, ".sdd-forge/config.json", validConfig());
    const originalRename = fs.renameSync;
    fs.renameSync = (from, to, ...rest) => {
      if (path.resolve(to) === path.join(root, ".senrail")) throw new Error("injected final rename failure");
      return originalRename(from, to, ...rest);
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /injected final rename failure/,
      );
    } finally {
      fs.renameSync = originalRename;
    }
    assert.ok(fs.existsSync(path.join(root, ".sdd-forge")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".gitignore")), false);
    assert.equal(fs.existsSync(path.join(root, ".gitattributes")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);

    const migrated = runUpgrade(root, ["--migrate"]);
    assert.equal(migrated.status, 0, migrated.stderr || migrated.stdout);
    assert.match(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), /^\.senrail\/\*/m);
    assert.match(fs.readFileSync(path.join(root, ".gitattributes"), "utf8"), /^\.senrail\/output\/analysis\.json merge=ours/m);
  });

  it("rolls back a pre-final commit failure without leaving staging residue", () => {
    const root = createTmpDir("senrail-upgrade-migrate-rollback-");
    roots.push(root);
    seedLegacyProject(root, ".sdd-forge");
    const originalRename = fs.renameSync;
    fs.renameSync = (from, to, ...rest) => {
      if (path.resolve(to) === path.join(root, ".senti")) throw new Error("injected staging placement failure");
      return originalRename(from, to, ...rest);
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /injected staging placement failure/,
      );
    } finally {
      fs.renameSync = originalRename;
    }

    assert.ok(fs.existsSync(path.join(root, ".sdd-forge")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("restores both root metadata files when metadata commit fails", () => {
    const root = createTmpDir("senrail-upgrade-migrate-metadata-commit-");
    roots.push(root);
    seedLegacyProject(root, ".sdd-forge");
    const originalIgnore = fs.readFileSync(path.join(root, ".gitignore"));
    const originalAttributes = fs.readFileSync(path.join(root, ".gitattributes"));
    const originalRename = fs.renameSync;
    let injected = false;
    fs.renameSync = (from, to, ...rest) => {
      if (!injected && path.resolve(to) === path.join(root, ".gitattributes")) {
        injected = true;
        throw new Error("injected metadata update failure");
      }
      return originalRename(from, to, ...rest);
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /injected metadata update failure/,
      );
    } finally {
      fs.renameSync = originalRename;
    }

    assert.ok(fs.existsSync(path.join(root, ".sdd-forge")));
    assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitignore")), originalIgnore);
    assert.deepEqual(fs.readFileSync(path.join(root, ".gitattributes")), originalAttributes);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  it("recovers final-rename cleanup without rolling back the canonical directory", () => {
    const root = createTmpDir("senrail-upgrade-migrate-recover-");
    roots.push(root);
    seedLegacyProject(root, ".sdd-forge");
    const originalRemove = fs.rmSync;
    fs.rmSync = (target, ...rest) => {
      if (path.resolve(target) === path.join(root, ".sdd-forge")) throw new Error("injected legacy cleanup failure");
      return originalRemove(target, ...rest);
    };
    try {
      assert.throws(
        () => new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run(),
        /injected legacy cleanup failure/,
      );
    } finally {
      fs.rmSync = originalRemove;
    }
    assert.ok(fs.existsSync(path.join(root, ".senrail")));
    assert.ok(fs.existsSync(path.join(root, ".sdd-forge")));
    assert.ok(fs.existsSync(path.join(root, ".tmp", "senrail-upgrade-migrate.json")));

    new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run();

    assert.ok(fs.existsSync(path.join(root, ".senrail")));
    assert.equal(fs.existsSync(path.join(root, ".sdd-forge")), false);
    assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
  });

  for (const [legacyDirectory, writes] of [
    [".sdd-forge", [1, 2, 3, 4]],
    [".senti", [1, 2, 3, 4, 5]],
  ]) {
    for (const journalWrite of writes) {
      const phase = journalWrite === writes.at(-1) ? "final-renamed" : `pre-final-${journalWrite}`;
      it(`recovers ${legacyDirectory} journal phase ${phase}`, () => {
        const root = createTmpDir("senrail-upgrade-migrate-phase-");
        roots.push(root);
        seedLegacyProject(root, legacyDirectory);

        const crashed = crashAfterJournalWrite(root, journalWrite);

        assert.equal(crashed.signal, "SIGKILL", crashed.stderr || crashed.stdout);
        assert.ok(fs.existsSync(path.join(root, ".tmp", "senrail-upgrade-migrate.json")));
        new UpgradeDirectoryMigration(root, { logger: { log() {}, error() {} } }).run();

        if (phase === "final-renamed") {
          assert.ok(fs.existsSync(path.join(root, ".senrail")));
          assert.equal(fs.existsSync(path.join(root, legacyDirectory)), false);
        } else {
          assert.equal(fs.existsSync(path.join(root, ".senrail")), false);
          assert.ok(fs.existsSync(path.join(root, legacyDirectory)));
        }
        assert.equal(fs.existsSync(path.join(root, ".tmp")), false);
      });
    }
  }
});

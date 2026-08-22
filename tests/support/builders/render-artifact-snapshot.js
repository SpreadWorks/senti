import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export class RenderArtifactSnapshot {
  #specJsonPath;
  #specMdPath;
  #flowPath;
  #tasksDir;
  #specJson;
  #specMd;
  #flow;
  #taskEntries;
  #taskFiles;

  constructor(specDir) {
    this.#specJsonPath = path.join(specDir, "spec.json");
    this.#specMdPath = path.join(specDir, "spec.md");
    this.#flowPath = path.join(specDir, "flow.json");
    this.#tasksDir = path.join(specDir, "tasks");
    this.#specJson = fs.readFileSync(this.#specJsonPath);
    this.#specMd = fs.readFileSync(this.#specMdPath);
    this.#flow = fs.readFileSync(this.#flowPath);
    this.#taskEntries = Object.freeze(fs.readdirSync(this.#tasksDir).sort());
    this.#taskFiles = Object.freeze(this.#taskEntries.map((name) => Object.freeze([
      name,
      fs.readFileSync(path.join(this.#tasksDir, name)),
    ])));
    Object.freeze(this);
  }

  assertUnchanged(label) {
    assert.deepEqual(fs.readFileSync(this.#specJsonPath), this.#specJson, `${label}: spec.json changed`);
    assert.deepEqual(fs.readFileSync(this.#specMdPath), this.#specMd, `${label}: spec.md changed`);
    assert.deepEqual(fs.readFileSync(this.#flowPath), this.#flow, `${label}: flow.json changed`);
    assert.deepEqual(fs.readdirSync(this.#tasksDir).sort(), this.#taskEntries, `${label}: task entries changed`);
    for (const [name, bytes] of this.#taskFiles) {
      assert.deepEqual(
        fs.readFileSync(path.join(this.#tasksDir, name)),
        bytes,
        `${label}: tasks/${name} changed`,
      );
    }
  }
}

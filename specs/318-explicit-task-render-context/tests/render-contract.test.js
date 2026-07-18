// spec: R1 R2 R3 R4 R5 R6 R7 R8

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as renderSpecViewModule from "../../../src/flow/lib/render-spec-view.js";
import { syncSpecTasksToFlow } from "../../../src/flow/lib/sync-spec-tasks.js";
import { validateSchema } from "../../../src/lib/schema-validate.js";
import {
  renderSpecMarkdown,
  renderTaskMarkdown,
  runSpecRender,
} from "../../../src/spec/commands/render.js";
import {
  makeContainer,
  makeFlowManager,
  makeFlowState,
  setupFlow,
} from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const CONTRACT_MODULE = new URL("../../../src/spec/lib/render-contract.js", import.meta.url);
const CONTRACT_PATH = fileURLToPath(CONTRACT_MODULE);
const SCHEMA_PATH = fileURLToPath(new URL("../../../src/flow/schemas/spec.schema.json", import.meta.url));
const roots = [];

afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

function createRoot(label) {
  const root = createTmpDir(`issue-414-${label}-`);
  roots.push(root);
  return root;
}

function task(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    goal: `Goal ${id}`,
    parent: null,
    origin: "plan",
    added_round: 0,
    status: "pending",
    ...overrides,
  };
}

function spec(tasks) {
  return {
    goal: "Validate render contracts.",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "Issue 414 fixture.",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function setupSelectedSpec(root, specId, tasks) {
  const specDir = path.join(root, "specs", specId);
  const specJsonPath = path.join(specDir, "spec.json");
  writeJson(specJsonPath, spec(tasks));
  return { specDir, specJsonPath };
}

function setupActiveForeignFlow(root) {
  const foreignSpec = "specs/foreign-active/spec.json";
  setupFlow(root, {
    spec: foreignSpec,
    runId: "run-foreign-active",
    featureBranch: "feature/foreign-active",
    issue: 999,
  });
}

function recordFsSideEffects(testContext, events) {
  const writeFileSync = fs.writeFileSync.bind(fs);
  const mkdirSync = fs.mkdirSync.bind(fs);
  const writeFile = fs.promises.writeFile.bind(fs.promises);
  testContext.mock.method(fs, "writeFileSync", (...args) => {
    events.push({ kind: "write", path: path.resolve(args[0]) });
    return writeFileSync(...args);
  });
  testContext.mock.method(fs, "mkdirSync", (...args) => {
    events.push({ kind: "mkdir", path: path.resolve(args[0]) });
    return mkdirSync(...args);
  });
  testContext.mock.method(fs.promises, "writeFile", async (...args) => {
    events.push({ kind: "write", path: path.resolve(args[0]) });
    return writeFile(...args);
  });
}

async function loadContract() {
  assert.equal(
    fs.existsSync(CONTRACT_PATH),
    true,
    "render-contract production module must exist",
  );
  return import(CONTRACT_MODULE.href);
}

test("R1: TaskId and schema enforce the same exact identity grammar", async () => {
  const { TaskId } = await loadContract();
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const taskProperties = schema.properties.tasks.items.properties;
  const pattern = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$";

  assert.equal(taskProperties.id.pattern, pattern);
  assert.equal(taskProperties.parent.pattern, pattern);
  assert.deepEqual(validateSchema(spec([task("parent"), task("child", { parent: "parent" })]), schema), []);
  assert.ok(
    validateSchema(spec([task("child", { parent: "../escape" })]), schema)
      .some((error) => /parent/.test(error)),
    "schema validation must execute the non-null parent pattern",
  );

  for (const value of ["A", "T-1", "T_child_2", `A${"z".repeat(99)}`]) {
    assert.equal(new TaskId(value).value, value);
  }
  for (const value of [
    "",
    `A${"z".repeat(100)}`,
    "../escape",
    "a/b",
    "a\\b",
    ".",
    "..",
    "C:drive",
    "\\\\server\\share",
    " space",
    "task id",
    "task-ア",
    "A\r",
    "A\n",
    "A\u2028",
    "A\u2029",
  ]) {
    assert.throws(() => new TaskId(value), /TaskId/);
  }
  for (const value of [null, 42, {}]) {
    assert.throws(
      () => new TaskId(value),
      /TaskId/,
      `TaskId accepted non-string value: ${JSON.stringify(value)}`,
    );
  }
  for (const value of [
    "",
    `A${"z".repeat(100)}`,
    "a/b",
    "a\\b",
    ".",
    "..",
    "C:drive",
    "\\\\server\\share",
    " space",
    "task id",
    "task-ア",
    "A\r",
    "A\n",
    "A\u2028",
    "A\u2029",
  ]) {
    assert.ok(
      validateSchema(spec([task(value)]), schema).some((error) => /tasks\[0\]\.id/.test(error)),
      `schema accepted invalid task id: ${JSON.stringify(value)}`,
    );
    assert.ok(
      validateSchema(spec([task("child", { parent: value })]), schema)
        .some((error) => /tasks\[0\]\.parent/.test(error)),
      `schema accepted invalid task parent: ${JSON.stringify(value)}`,
    );
  }
  assert.deepEqual(
    validateSchema("prefix T_child-2 suffix", { type: "string", pattern: "T_child-2" }),
    [],
    "unanchored schema patterns must retain search semantics",
  );
});

test("R1: schema accepts valid TaskId boundary forms for id and non-null parent", () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  for (const value of ["A", "T_child-2", `A${"z".repeat(99)}`]) {
    assert.deepEqual(validateSchema(spec([task(value)]), schema), []);
    assert.deepEqual(
      validateSchema(spec([task("child", { parent: value })]), schema),
      [],
    );
  }
});

test("R1: schema rejects non-string identities while preserving nullable parent", () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

  for (const value of [null, 42, {}]) {
    assert.ok(
      validateSchema(spec([task(value)]), schema)
        .some((error) => /tasks\[0\]\.id/.test(error)),
      `schema accepted non-string task id: ${JSON.stringify(value)}`,
    );
  }

  assert.deepEqual(validateSchema(spec([task("child", { parent: null })]), schema), []);
  for (const value of [42, {}, [], true]) {
    assert.ok(
      validateSchema(spec([task("child", { parent: value })]), schema)
        .some((error) => /tasks\[0\]\.parent/.test(error)),
      `schema accepted non-string task parent: ${JSON.stringify(value)}`,
    );
  }
});

test("R2: TaskCollection owns size, uniqueness, and complete parent validation", async () => {
  const { TaskCollection, TaskId } = await loadContract();
  assert.equal(new TaskCollection([]).size, 0);
  const single = new TaskCollection([task("only")]);
  assert.equal(single.size, 1);
  assert.equal(single.get("only").id.value, "only");
  const maximum = Array.from({ length: 200 }, (_, index) => task(`T-${index}`));
  const bounded = new TaskCollection(maximum);
  assert.equal(bounded.size, 200);
  assert.ok([...bounded].every((entry) => entry.id instanceof TaskId));

  assert.throws(
    () => new TaskCollection([...maximum, task("T-200")]),
    /200|task collection/i,
  );
  assert.throws(
    () => new TaskCollection([task("T-1"), task("T-1")]),
    /duplicate/i,
  );
  assert.throws(
    () => new TaskCollection([task("child", { parent: "missing" })]),
    /parent|missing/i,
  );
  for (const parent of [42, {}]) {
    assert.throws(
      () => new TaskCollection([task("child", { parent })]),
      /parent|TaskId/i,
      `TaskCollection accepted non-string parent: ${JSON.stringify(parent)}`,
    );
  }

  const forward = new TaskCollection([
    task("child", { parent: "parent" }),
    task("parent"),
  ]);
  const [child] = [...forward];
  assert.ok(child.id instanceof TaskId);
  assert.ok(child.parent instanceof TaskId);
  assert.equal(child.parent.value, "parent");
  const lookupChild = forward.get("child");
  assert.ok(lookupChild.id instanceof TaskId);
  assert.ok(lookupChild.parent instanceof TaskId);
  assert.equal(lookupChild.id.value, "child");
  assert.equal(lookupChild.parent.value, "parent");
});

test("R2: over-limit rejection occurs before collection iteration or per-task access", async () => {
  const { TaskCollection } = await loadContract();
  const accesses = {
    element: 0,
    id: 0,
    lookup: 0,
    parent: 0,
    iterator: 0,
  };
  const overLimit = Array.from({ length: 201 }, (_, index) => new Proxy(task(`T-${index}`), {
    get(target, property, receiver) {
      if (property === "id") accesses.id += 1;
      if (property === "parent") accesses.parent += 1;
      return Reflect.get(target, property, receiver);
    },
  }));
  const observed = new Proxy(overLimit, {
    get(target, property, receiver) {
      if (property === Symbol.iterator) accesses.iterator += 1;
      if (typeof property === "string" && /^\d+$/.test(property)) {
        accesses.element += 1;
        accesses.lookup += 1;
      }
      return Reflect.get(target, property, receiver);
    },
  });

  assert.throws(() => new TaskCollection(observed), /200|task collection/i);
  assert.deepEqual(accesses, {
    element: 0,
    id: 0,
    lookup: 0,
    parent: 0,
    iterator: 0,
  });
});

test("R2 R3: collection and render planning access counts remain explicitly linear", async () => {
  const { TaskCollection, TaskId, TaskOutputPath, TaskRenderPlan } = await loadContract();
  const root = createRoot("linear-access-counts");
  const tasksDir = path.join(root, "specs", "selected", "tasks");

  for (const count of [0, 1, 50, 200]) {
    const accesses = { id: 0, parent: 0 };
    const selectedTasks = Array.from({ length: count }, (_, index) => new Proxy(task(`T-${index}`), {
      get(target, property, receiver) {
        if (property === "id") accesses.id += 1;
        if (property === "parent") accesses.parent += 1;
        return Reflect.get(target, property, receiver);
      },
    }));
    const collection = new TaskCollection(selectedTasks);
    const collectionEntries = [...collection];

    assert.equal(collection.size, count, `TaskCollection size at n=${count}`);
    assert.equal(collectionEntries.length, count, `TaskCollection iteration length at n=${count}`);
    assert.ok(
      collectionEntries.every((entry) => (
        entry.id instanceof TaskId && (entry.parent === null || entry.parent instanceof TaskId)
      )),
      `TaskCollection exposed an untyped entry at n=${count}`,
    );
    assert.equal(
      new Set(collectionEntries.map((entry) => entry.id.value)).size,
      count,
      `TaskCollection exposed duplicate entries at n=${count}`,
    );
    if (count === 0) {
      assert.equal(accesses.id, 0, "empty TaskCollection read an id");
      assert.equal(accesses.parent, 0, "empty TaskCollection read a parent");
    } else {
      assert.ok(accesses.id >= count, `TaskCollection skipped id reads at n=${count}`);
      assert.ok(accesses.id <= count * 2, `TaskCollection id reads exceeded two passes at n=${count}`);
      assert.ok(accesses.parent >= count, `TaskCollection skipped parent reads at n=${count}`);
      assert.ok(accesses.parent <= count * 2, `TaskCollection parent reads exceeded two passes at n=${count}`);
    }

    let rendererCalls = 0;
    const plan = new TaskRenderPlan({
      collection,
      tasksDir,
      renderTask(selectedTask) {
        rendererCalls += 1;
        return renderTaskMarkdown(selectedTask);
      },
    });
    const entries = [...plan];
    const constructedPaths = entries.filter((entry) => entry.outputPath instanceof TaskOutputPath);

    assert.equal(plan.size, count, `TaskRenderPlan size at n=${count}`);
    assert.equal(rendererCalls, count, `TaskRenderPlan renderer calls at n=${count}`);
    assert.equal(constructedPaths.length, count, `TaskRenderPlan output paths at n=${count}`);
    assert.equal(entries.length, count, `TaskRenderPlan entries at n=${count}`);
    assert.ok(
      entries.every((entry) => entry.outputPath instanceof TaskOutputPath),
      `TaskRenderPlan exposed an untyped output path at n=${count}`,
    );
    assert.equal(
      new Set(entries.map((entry) => entry.outputPath.value)).size,
      count,
      `TaskRenderPlan exposed duplicate output paths at n=${count}`,
    );
    assert.deepEqual(
      entries.map((entry) => path.basename(entry.outputPath.value)),
      selectedTasks.map((selectedTask) => `${selectedTask.id}.md`),
      `TaskRenderPlan output mapping at n=${count}`,
    );
    assert.deepEqual(
      entries.map((entry) => entry.markdown),
      selectedTasks.map(renderTaskMarkdown),
      `TaskRenderPlan body mapping at n=${count}`,
    );
  }
});

test("R3: TaskOutputPath produces exactly one confined path per validated task", async () => {
  const { TaskCollection, TaskId, TaskOutputPath } = await loadContract();
  const root = createRoot("path");
  const tasksDir = path.join(root, "specs", "selected", "tasks");
  const collection = new TaskCollection([task("T-1"), task("T-2"), task("T-3")]);
  const outputPaths = [...collection].map((entry) => new TaskOutputPath(tasksDir, entry.id));

  assert.equal(outputPaths.length, collection.size);
  for (const [index, outputPath] of outputPaths.entries()) {
    assert.equal(path.dirname(outputPath.value), path.resolve(tasksDir));
    assert.equal(outputPath.value, path.resolve(tasksDir, `T-${index + 1}.md`));
  }
  assert.throws(
    () => new TaskOutputPath(tasksDir, { value: "../escape" }),
    /TaskId|confined/i,
  );
  assert.ok(new TaskOutputPath(tasksDir, new TaskId("leaf")).value.endsWith("leaf.md"));
});

test("R3: TaskRenderPlan owns exact path and body cardinality at 0, 1, and 200 tasks", async () => {
  const { TaskCollection, TaskOutputPath, TaskRenderPlan } = await loadContract();
  const root = createRoot("render-plan-cardinality");
  const tasksDir = path.join(root, "specs", "selected", "tasks");

  for (const count of [0, 1, 200]) {
    const selectedTasks = Array.from({ length: count }, (_, index) => task(`T-${index}`));
    const collection = new TaskCollection(selectedTasks);
    let rendererCalls = 0;
    const plan = new TaskRenderPlan({
      collection,
      tasksDir,
      renderTask(selectedTask) {
        rendererCalls += 1;
        return renderTaskMarkdown(selectedTask);
      },
    });
    const entries = [...plan];

    assert.equal(plan.size, count);
    assert.equal(entries.length, count);
    assert.equal(rendererCalls, count);
    assert.ok(entries.every((entry) => entry.outputPath instanceof TaskOutputPath));
    for (const [index, entry] of entries.entries()) {
      assert.equal(entry.outputPath.value, path.resolve(tasksDir, `T-${index}.md`));
      assert.equal(entry.markdown, renderTaskMarkdown(selectedTasks[index]));
    }
  }
});

test("R3: production CLI emits exactly one task write per completely planned path", async () => {
  const root = createRoot("path-cardinality");
  setupActiveForeignFlow(root);
  const selectedTasks = [task("T-1"), task("T-2"), task("T-3")];
  const selected = setupSelectedSpec(root, "selected", selectedTasks);
  const container = makeContainer(root);
  container.register("root", root);

  await runSpecRender(["--spec", selected.specDir], container);

  const renderedTaskFiles = fs.readdirSync(path.join(selected.specDir, "tasks")).sort();
  assert.deepEqual(renderedTaskFiles, ["T-1.md", "T-2.md", "T-3.md"]);
  assert.equal(renderedTaskFiles.length, selectedTasks.length);
  for (const selectedTask of selectedTasks) {
    assert.equal(
      fs.readFileSync(path.join(selected.specDir, "tasks", `${selectedTask.id}.md`), "utf8"),
      renderTaskMarkdown(selectedTask),
    );
  }
});

test("R3: internal view validates every task before its first filesystem side effect", (t) => {
  const root = createRoot("view-plan-order");
  const selectedTasks = [task("T-1"), task("T-2"), task("T-3")];
  const selected = setupSelectedSpec(root, "selected", selectedTasks);
  const events = [];
  const observedTasks = selectedTasks.map((selectedTask) => new Proxy(selectedTask, {
    get(target, property, receiver) {
      if (property === "id" || property === "parent") {
        events.push({ kind: "read", id: target.id, property });
      }
      return Reflect.get(target, property, receiver);
    },
  }));
  recordFsSideEffects(t, events);

  renderSpecViewModule.renderSpecView({
    root,
    specPath: selected.specJsonPath,
    spec: spec(observedTasks),
    state: null,
  });

  const firstFsIndex = events.findIndex((event) => event.kind === "write" || event.kind === "mkdir");
  assert.ok(firstFsIndex > 0, "render must plan before the first filesystem side effect");
  for (const selectedTask of selectedTasks) {
    const beforeFirstFs = events.slice(0, firstFsIndex);
    assert.ok(
      beforeFirstFs.some((event) => event.kind === "read" && event.id === selectedTask.id && event.property === "id"),
      `${selectedTask.id} identity was not validated before the first filesystem side effect`,
    );
    assert.ok(
      beforeFirstFs.some((event) => event.kind === "read" && event.id === selectedTask.id && event.property === "parent"),
      `${selectedTask.id} parent was not validated before the first filesystem side effect`,
    );
  }
  const writeEvents = events.filter((event) => event.kind === "write");
  const mkdirEvents = events.filter((event) => event.kind === "mkdir");
  assert.equal(writeEvents.length, selectedTasks.length + 1);
  assert.equal(mkdirEvents.length, 1);
  assert.deepEqual(
    writeEvents.map((event) => path.basename(event.path)).sort(),
    ["spec.md", "T-1.md", "T-2.md", "T-3.md"].sort(),
  );
});

test("R3 R5: preloaded view build is side-effect free and apply uses the completed plan", (t) => {
  const root = createRoot("view-build-apply");
  const selectedTasks = [task("T-1"), task("T-2")];
  const selected = setupSelectedSpec(root, "selected", selectedTasks);
  const preloadedSpec = spec(selectedTasks);
  const events = [];
  recordFsSideEffects(t, events);

  assert.equal(
    typeof renderSpecViewModule.buildSpecViewPlan,
    "function",
    "render-spec-view must export buildSpecViewPlan",
  );
  assert.equal(
    typeof renderSpecViewModule.SpecViewRenderPlan,
    "function",
    "render-spec-view must export SpecViewRenderPlan",
  );
  assert.equal(
    typeof renderSpecViewModule.applySpecViewPlan,
    "function",
    "render-spec-view must export applySpecViewPlan",
  );
  const plan = renderSpecViewModule.buildSpecViewPlan({
    root,
    specPath: selected.specJsonPath,
    spec: preloadedSpec,
  });

  assert.ok(plan instanceof renderSpecViewModule.SpecViewRenderPlan);
  assert.deepEqual(events, []);
  preloadedSpec.goal = "must not be rendered after planning";
  const result = renderSpecViewModule.applySpecViewPlan(plan);

  assert.deepEqual(result, {
    rendered: true,
    changed: [
      "specs/selected/spec.md",
      "specs/selected/tasks/T-1.md",
      "specs/selected/tasks/T-2.md",
    ],
  });
  assert.equal(events.filter((event) => event.kind === "write").length, 3);
  assert.equal(events.filter((event) => event.kind === "mkdir").length, 1);
  const created = fs.statSync(selected.specJsonPath).mtime.toISOString().slice(0, 10);
  assert.equal(
    fs.readFileSync(path.join(selected.specDir, "spec.md"), "utf8"),
    renderSpecMarkdown(spec(selectedTasks), {
      title: "selected",
      featureBranch: "feature/selected",
      created,
      status: "Draft",
      input: "User request",
    }),
  );
});

test("R3: CLI invalid-last-task planning causes zero filesystem side effects", async (t) => {
  const root = createRoot("cli-plan-order");
  setupActiveForeignFlow(root);
  const selected = setupSelectedSpec(root, "selected", [
    task("T-1"),
    task("T-2"),
    task("child", { parent: "missing" }),
  ]);
  const container = makeContainer(root);
  container.register("root", root);
  const events = [];
  recordFsSideEffects(t, events);

  await assert.rejects(runSpecRender(["--spec", selected.specDir], container), /parent|missing/i);
  assert.deepEqual(events, []);
});

test("R4: SpecRenderContext accepts exact colocated metadata and otherwise uses selected-spec defaults", async () => {
  const { SpecRenderContext } = await loadContract();
  const absentRoot = createRoot("context-absent");
  setupActiveForeignFlow(absentRoot);
  const absent = setupSelectedSpec(absentRoot, "selected", [task("T-1")]);
  const absentContext = new SpecRenderContext({ root: absentRoot, ...absent });
  assert.equal(absentContext.toRenderMeta().featureBranch, "feature/selected");
  assert.equal(absentContext.toRenderMeta().input, "User request");
  assert.notEqual(absentContext.toRenderMeta().featureBranch, "feature/foreign-active");
  assert.notEqual(absentContext.toRenderMeta().input, "GitHub Issue #999");
  assert.equal(absentContext.toRenderMeta().title, "selected");
  assert.equal(
    absentContext.toRenderMeta().created,
    fs.statSync(absent.specJsonPath).mtime.toISOString().slice(0, 10),
  );

  const matchingRoot = createRoot("context-match");
  const matching = setupSelectedSpec(matchingRoot, "selected", [task("T-1")]);
  makeFlowManager(matchingRoot).create(makeFlowState({
    spec: "specs/selected/spec.json",
    runId: "run-selected",
    featureBranch: "feature/exact-selected",
    issue: 414,
  }));
  const matchingContext = new SpecRenderContext({ root: matchingRoot, ...matching });
  assert.equal(matchingContext.toRenderMeta().featureBranch, "feature/exact-selected");
  assert.equal(matchingContext.toRenderMeta().input, "GitHub Issue #414");

  const mismatchRoot = createRoot("context-mismatch");
  const mismatch = setupSelectedSpec(mismatchRoot, "selected", [task("T-1")]);
  const mismatchFlowPath = path.join(mismatch.specDir, "flow.json");
  writeJson(mismatchFlowPath, makeFlowState({
    spec: "specs/other/spec.json",
    runId: "run-other",
    featureBranch: "feature/other",
    issue: 999,
  }));
  const mismatchBefore = fs.readFileSync(mismatchFlowPath);
  const mismatchContext = new SpecRenderContext({ root: mismatchRoot, ...mismatch });
  assert.equal(mismatchContext.toRenderMeta().featureBranch, "feature/selected");
  assert.equal(mismatchContext.toRenderMeta().input, "User request");
  assert.equal(mismatchContext.toRenderMeta().title, "selected");
  assert.equal(
    mismatchContext.toRenderMeta().created,
    fs.statSync(mismatch.specJsonPath).mtime.toISOString().slice(0, 10),
  );
  assert.deepEqual(fs.readFileSync(mismatchFlowPath), mismatchBefore);
});

test("R5: CLI render rejects the complete invalid collection before every output write", async () => {
  const root = createRoot("cli-reject");
  setupActiveForeignFlow(root);
  const selected = setupSelectedSpec(root, "selected", [
    task("child", { parent: "missing" }),
  ]);
  const requestedOut = path.join(root, "requested.md");
  const specMdPath = path.join(selected.specDir, "spec.md");
  const tasksDir = path.join(selected.specDir, "tasks");
  const existingTaskPath = path.join(tasksDir, "existing.md");
  const orphanPath = path.join(tasksDir, "orphan.md");
  const outsidePath = path.join(root, "outside.txt");
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(specMdPath, "existing spec view\n");
  fs.writeFileSync(existingTaskPath, "existing generated task\n");
  fs.writeFileSync(orphanPath, "existing orphan task\n");
  fs.writeFileSync(requestedOut, "existing requested output\n");
  fs.writeFileSync(outsidePath, "existing outside file\n");
  const before = new Map([
    [specMdPath, fs.readFileSync(specMdPath)],
    [existingTaskPath, fs.readFileSync(existingTaskPath)],
    [orphanPath, fs.readFileSync(orphanPath)],
    [requestedOut, fs.readFileSync(requestedOut)],
    [outsidePath, fs.readFileSync(outsidePath)],
  ]);
  const beforeTaskNames = fs.readdirSync(tasksDir).sort();
  const container = makeContainer(root);
  container.register("root", root);

  await assert.rejects(
    runSpecRender(["--spec", selected.specDir, "--out", requestedOut], container),
    /parent|missing/i,
  );
  for (const [filePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(filePath), bytes, `${filePath} changed on rejection`);
  }
  assert.deepEqual(fs.readdirSync(tasksDir).sort(), beforeTaskNames);
  assert.equal(fs.existsSync(path.join(tasksDir, "child.md")), false);
});

test("R5: every invalid collection class preserves all existing CLI output bytes", async (t) => {
  class CliExit extends Error {
    constructor(code) {
      super(`CLI exit ${code}`);
      this.code = code;
    }
  }
  t.mock.method(process.stderr, "write", () => true);
  t.mock.method(process, "exit", (code) => { throw new CliExit(code); });

  for (const fixture of [
    { label: "invalid-id", tasks: [task("../escape")] },
    { label: "duplicate", tasks: [task("T-1"), task("T-1", { title: "Duplicate" })] },
    { label: "unknown-parent", tasks: [task("child", { parent: "missing" })] },
    {
      label: "over-limit",
      tasks: Array.from({ length: 201 }, (_, index) => task(`T-${index}`)),
    },
  ]) {
    const root = createRoot(`cli-reject-${fixture.label}`);
    setupActiveForeignFlow(root);
    const selected = setupSelectedSpec(root, "selected", fixture.tasks);
    const tasksDir = path.join(selected.specDir, "tasks");
    const specMdPath = path.join(selected.specDir, "spec.md");
    const generatedPath = path.join(tasksDir, "existing.md");
    const orphanPath = path.join(tasksDir, "orphan.md");
    const requestedOut = path.join(root, "requested.md");
    const outsidePath = path.join(root, "outside.txt");
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(specMdPath, "existing spec view\n");
    fs.writeFileSync(generatedPath, "existing generated task\n");
    fs.writeFileSync(orphanPath, "existing orphan task\n");
    fs.writeFileSync(requestedOut, "existing requested output\n");
    fs.writeFileSync(outsidePath, "existing outside file\n");
    const before = new Map([
      [specMdPath, fs.readFileSync(specMdPath)],
      [generatedPath, fs.readFileSync(generatedPath)],
      [orphanPath, fs.readFileSync(orphanPath)],
      [requestedOut, fs.readFileSync(requestedOut)],
      [outsidePath, fs.readFileSync(outsidePath)],
    ]);
    const beforeTaskNames = fs.readdirSync(tasksDir).sort();
    const container = makeContainer(root);
    container.register("root", root);

    await assert.rejects(
      runSpecRender(["--spec", selected.specDir, "--out", requestedOut], container),
      /CLI exit|TaskId|duplicate|parent|200|collection/i,
    );
    for (const [filePath, bytes] of before) {
      assert.deepEqual(fs.readFileSync(filePath), bytes, `${fixture.label}: ${filePath} changed`);
    }
    assert.deepEqual(fs.readdirSync(tasksDir).sort(), beforeTaskNames);
  }
});

test("R6: approval sync rejects unknown parents before changing flow.json bytes", () => {
  const root = createRoot("sync-reject");
  const specRel = "specs/selected/spec.json";
  setupFlow(root, {
    spec: specRel,
    runId: "run-selected",
    featureBranch: "feature/selected",
  });
  writeJson(path.join(root, specRel), spec([
    task("child", { parent: "missing" }),
  ]));
  const flowPath = path.join(root, "specs", "selected", "flow.json");
  const before = fs.readFileSync(flowPath);

  assert.throws(() => syncSpecTasksToFlow({ root }), /parent|missing/i);
  assert.deepEqual(fs.readFileSync(flowPath), before);
});

test("R6: approval sync rejects invalid and duplicate IDs without changing flow bytes", () => {
  for (const fixture of [
    { label: "invalid-id", tasks: [task("../escape")] },
    { label: "duplicate-id", tasks: [task("T-1"), task("T-1", { title: "Duplicate" })] },
  ]) {
    const root = createRoot(`sync-reject-${fixture.label}`);
    const specRel = "specs/selected/spec.json";
    setupFlow(root, {
      spec: specRel,
      runId: `run-${fixture.label}`,
      featureBranch: "feature/selected",
    });
    writeJson(path.join(root, specRel), spec(fixture.tasks));
    const flowPath = path.join(root, "specs", "selected", "flow.json");
    const before = fs.readFileSync(flowPath);

    assert.throws(() => syncSpecTasksToFlow({ root }), /TaskId|duplicate|invalid/i);
    assert.deepEqual(fs.readFileSync(flowPath), before);
  }
});

test("R6: valid approval sync derives appended identity, parent, and path from validated tasks", () => {
  const root = createRoot("sync-valid-values");
  const specRel = "specs/selected/spec.json";
  setupFlow(root, {
    spec: specRel,
    runId: "run-selected",
    featureBranch: "feature/selected",
  });
  writeJson(path.join(root, specRel), spec([
    task("parent"),
    task("child", { parent: "parent" }),
  ]));

  const result = syncSpecTasksToFlow({ root });
  const flow = JSON.parse(fs.readFileSync(path.join(root, "specs", "selected", "flow.json"), "utf8"));
  const parent = flow.tasks.find((entry) => entry.id === "parent");
  const child = flow.tasks.find((entry) => entry.id === "child");

  assert.deepEqual(result.added, ["parent", "child"]);
  assert.equal(parent.spec, "specs/selected/tasks/parent.md");
  assert.equal(parent.parent, null);
  assert.equal(child.spec, "specs/selected/tasks/child.md");
  assert.equal(child.parent, "parent");
});

test("R7: valid explicit render preserves deterministic bytes without ambient flow metadata", async () => {
  const root = createRoot("valid-parity");
  setupActiveForeignFlow(root);
  const selectedTasks = [task("T-1")];
  const selected = setupSelectedSpec(root, "selected", selectedTasks);
  const container = makeContainer(root);
  container.register("root", root);

  await runSpecRender(["--spec", selected.specDir], container);

  const created = fs.statSync(selected.specJsonPath).mtime.toISOString().slice(0, 10);
  const expectedMeta = {
    title: "selected",
    featureBranch: "feature/selected",
    created,
    status: "Draft",
    input: "User request",
  };
  assert.equal(
    fs.readFileSync(path.join(selected.specDir, "spec.md"), "utf8"),
    renderSpecMarkdown(spec(selectedTasks), expectedMeta),
  );
  assert.equal(
    fs.readFileSync(path.join(selected.specDir, "tasks", "T-1.md"), "utf8"),
    renderTaskMarkdown(selectedTasks[0]),
  );
});

test("R7: CLI retains relative spec/out resolution, stdout paths, and valid orphan bytes", async (t) => {
  const root = createRoot("cli-retained-surfaces");
  setupActiveForeignFlow(root);
  const selectedTasks = [task("T-1")];
  const selected = setupSelectedSpec(root, "selected", selectedTasks);
  const tasksDir = path.join(selected.specDir, "tasks");
  const orphanPath = path.join(tasksDir, "orphan.md");
  const outDir = path.join(root, "artifacts");
  const outPath = path.join(outDir, "custom.md");
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(orphanPath, "retained orphan\n");
  const orphanBefore = fs.readFileSync(orphanPath);
  const stdout = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  t.mock.method(process.stdout, "write", (chunk, ...args) => {
    const text = String(chunk);
    if (text.startsWith("rendered: ")) {
      stdout.push(text);
      return true;
    }
    return originalWrite(chunk, ...args);
  });
  const container = makeContainer(root);
  container.register("root", root);

  await runSpecRender(["--spec", "specs/selected", "--out", "artifacts/custom.md"], container);

  assert.equal(fs.existsSync(path.join(selected.specDir, "spec.md")), false);
  assert.equal(fs.existsSync(outPath), true);
  assert.match(fs.readFileSync(outPath, "utf8"), /\*\*Feature Branch\*\*: `feature\/selected`/);
  assert.deepEqual(fs.readFileSync(orphanPath), orphanBefore);
  assert.deepEqual(stdout, [
    "rendered: artifacts/custom.md\n",
    "rendered: specs/selected/tasks/T-1.md\n",
  ]);
});

test("R7: CLI retains schema diagnostics without writing generated outputs", async (t) => {
  class CliExit extends Error {
    constructor(code) {
      super(`CLI exit ${code}`);
      this.code = code;
    }
  }
  const root = createRoot("cli-schema-error");
  const selected = setupSelectedSpec(root, "selected", [task("")]);
  const stderr = [];
  t.mock.method(process.stderr, "write", (chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  t.mock.method(process, "exit", (code) => { throw new CliExit(code); });
  const container = makeContainer(root);
  container.register("root", root);

  await assert.rejects(
    runSpecRender(["--spec", selected.specDir], container),
    (error) => error instanceof CliExit && error.code === 1,
  );
  assert.match(stderr.join(""), /spec\.json failed schema validation/);
  assert.match(stderr.join(""), /tasks\[0\]\.id/);
  assert.equal(fs.existsSync(path.join(selected.specDir, "spec.md")), false);
  assert.equal(fs.existsSync(path.join(selected.specDir, "tasks")), false);
});

test("R7: internal optional-missing view returns its unchanged non-render result", (t) => {
  const root = createRoot("view-optional-missing");
  const specJsonPath = path.join(root, "specs", "missing", "spec.json");
  const events = [];
  recordFsSideEffects(t, events);

  const result = renderSpecViewModule.renderSpecView({ root, specPath: specJsonPath, optional: true });

  assert.deepEqual(result, {
    rendered: false,
    changed: [],
    reason: `spec.json not found at ${specJsonPath}`,
  });
  assert.deepEqual(events, []);
});

test("R7: valid internal view retains changed paths, deterministic bytes, and orphan content", () => {
  const root = createRoot("view-retained-surfaces");
  const selectedTasks = [task("T-1"), task("T-2")];
  const selectedSpec = spec(selectedTasks);
  const selected = setupSelectedSpec(root, "selected", selectedTasks);
  const tasksDir = path.join(selected.specDir, "tasks");
  const orphanPath = path.join(tasksDir, "orphan.md");
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(orphanPath, "retained view orphan\n");
  const orphanBefore = fs.readFileSync(orphanPath);

  const result = renderSpecViewModule.renderSpecView({ root, specPath: selected.specJsonPath, state: null });
  const created = fs.statSync(selected.specJsonPath).mtime.toISOString().slice(0, 10);
  const meta = {
    title: "selected",
    featureBranch: "feature/selected",
    created,
    status: "Draft",
    input: "User request",
  };

  assert.deepEqual(result, {
    rendered: true,
    changed: [
      "specs/selected/spec.md",
      "specs/selected/tasks/T-1.md",
      "specs/selected/tasks/T-2.md",
    ],
  });
  assert.equal(
    fs.readFileSync(path.join(selected.specDir, "spec.md"), "utf8"),
    renderSpecMarkdown(selectedSpec, meta),
  );
  for (const selectedTask of selectedTasks) {
    assert.equal(
      fs.readFileSync(path.join(tasksDir, `${selectedTask.id}.md`), "utf8"),
      renderTaskMarkdown(selectedTask),
    );
  }
  assert.deepEqual(fs.readFileSync(orphanPath), orphanBefore);
});

test("R7: first approval retains round zero assignment and leaf promotion", () => {
  const root = createRoot("sync-first-round");
  const specRel = "specs/selected/spec.json";
  setupFlow(root, {
    spec: specRel,
    runId: "run-first-round",
    featureBranch: "feature/selected",
    tasks: [],
    currentTaskId: null,
  });
  writeJson(path.join(root, specRel), spec([
    task("parent"),
    task("child", { parent: "parent" }),
  ]));

  const result = syncSpecTasksToFlow({ root });
  const flow = JSON.parse(fs.readFileSync(path.join(root, "specs", "selected", "flow.json"), "utf8"));
  const parent = flow.tasks.find((entry) => entry.id === "parent");
  const child = flow.tasks.find((entry) => entry.id === "child");

  assert.deepEqual(result.added, ["parent", "child"]);
  assert.equal(parent.added_round, 0);
  assert.equal(child.added_round, 0);
  assert.equal(parent.status, "pending");
  assert.equal(child.status, "in_progress");
  assert.equal(flow.currentTaskId, "child");
});

test("R7: valid approval sync retains filtering, round, fields, steps, and promotion", () => {
  const root = createRoot("sync-parity");
  const specRel = "specs/selected/spec.json";
  const existingTask = {
    id: "existing",
    spec: "specs/selected/tasks/existing.md",
    origin: "plan",
    parent: null,
    status: "done",
    steps: [
      { id: "task-impl", status: "done" },
      { id: "task-review", status: "done" },
      { id: "task-gate", status: "done" },
    ],
    requirements: ["R-old"],
    summary: "preserved",
    added_round: 2,
  };
  setupFlow(root, {
    spec: specRel,
    runId: "run-selected",
    featureBranch: "feature/selected",
    tasks: [existingTask],
    currentTaskId: null,
  });
  writeJson(path.join(root, specRel), spec([
    task("existing", { status: "pending" }),
    task("parent"),
    task("child", { parent: "parent" }),
  ]));

  const result = syncSpecTasksToFlow({ root });
  const flow = JSON.parse(fs.readFileSync(path.join(root, "specs", "selected", "flow.json"), "utf8"));
  const parent = flow.tasks.find((entry) => entry.id === "parent");
  const child = flow.tasks.find((entry) => entry.id === "child");

  assert.deepEqual(result.added, ["parent", "child"]);
  assert.deepEqual(flow.tasks[0], existingTask);
  assert.equal(parent.added_round, 3);
  assert.equal(child.added_round, 3);
  assert.equal(parent.origin, "plan");
  assert.equal(parent.parent, null);
  assert.equal(parent.status, "pending");
  assert.equal(child.origin, "plan");
  assert.equal(child.parent, "parent");
  assert.equal(child.status, "in_progress");
  assert.deepEqual(
    child.steps,
    ["task-impl", "task-review", "task-gate"].map((id) => ({ id, status: "pending" })),
  );
  assert.equal(flow.currentTaskId, "child");
});

test("R8: internal view rejection preserves existing generated and orphan files byte-for-byte", () => {
  const root = createRoot("view-reject");
  const duplicateTasks = [task("T-1"), task("T-1", { title: "Duplicate" })];
  const selected = setupSelectedSpec(root, "selected", duplicateTasks);
  const specMdPath = path.join(selected.specDir, "spec.md");
  const tasksDir = path.join(selected.specDir, "tasks");
  const orphanPath = path.join(tasksDir, "orphan.md");
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(specMdPath, "existing spec view\n");
  fs.writeFileSync(orphanPath, "existing orphan\n");
  const beforeSpec = fs.readFileSync(specMdPath);
  const beforeOrphan = fs.readFileSync(orphanPath);

  assert.throws(
    () => renderSpecViewModule.renderSpecView({
      root,
      specPath: selected.specJsonPath,
      state: makeFlowState({
        spec: "specs/foreign/spec.json",
        featureBranch: "feature/foreign",
        issue: 999,
      }),
    }),
    /duplicate/i,
  );
  assert.deepEqual(fs.readFileSync(specMdPath), beforeSpec);
  assert.deepEqual(fs.readFileSync(orphanPath), beforeOrphan);
  assert.equal(fs.existsSync(path.join(tasksDir, "T-1.md")), false);
});

test("R5 R8: every remaining invalid collection preserves internal view bytes and entries", () => {
  for (const fixture of [
    { label: "invalid-id", tasks: [task("../escape")] },
    { label: "unknown-parent", tasks: [task("child", { parent: "missing" })] },
    {
      label: "over-limit",
      tasks: Array.from({ length: 201 }, (_, index) => task(`T-${index}`)),
    },
  ]) {
    const root = createRoot(`view-reject-${fixture.label}`);
    const selected = setupSelectedSpec(root, "selected", fixture.tasks);
    const specMdPath = path.join(selected.specDir, "spec.md");
    const tasksDir = path.join(selected.specDir, "tasks");
    const generatedPath = path.join(tasksDir, "existing.md");
    const orphanPath = path.join(tasksDir, "orphan.md");
    const escapedPath = path.join(selected.specDir, "escape.md");
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(specMdPath, "existing spec view\n");
    fs.writeFileSync(generatedPath, "existing generated task\n");
    fs.writeFileSync(orphanPath, "existing orphan task\n");
    fs.writeFileSync(escapedPath, "existing outside-task view\n");
    const before = new Map([
      [specMdPath, fs.readFileSync(specMdPath)],
      [generatedPath, fs.readFileSync(generatedPath)],
      [orphanPath, fs.readFileSync(orphanPath)],
      [escapedPath, fs.readFileSync(escapedPath)],
    ]);
    const beforeTaskNames = fs.readdirSync(tasksDir).sort();

    assert.throws(
      () => renderSpecViewModule.renderSpecView({ root, specPath: selected.specJsonPath, state: null }),
      /TaskId|parent|missing|200|collection/i,
    );
    for (const [filePath, bytes] of before) {
      assert.deepEqual(fs.readFileSync(filePath), bytes, `${fixture.label}: ${filePath} changed`);
    }
    assert.deepEqual(fs.readdirSync(tasksDir).sort(), beforeTaskNames);
  }
});

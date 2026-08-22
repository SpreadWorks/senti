import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
  MINIMUM_TEST_TMPFS_BYTES,
  TestTemporaryRoot,
} from "../test-temporary-root.js";

const TMPFS_MAGIC = 0x01021994n;

test("test temporary root selects writable tmpfs with sufficient available space", () => {
  let createdPrefix = null;
  const root = TestTemporaryRoot.createOnTmpfs({
    access: () => {},
    statfs: () => ({ type: TMPFS_MAGIC, bavail: 2n, bsize: MINIMUM_TEST_TMPFS_BYTES }),
    create: (prefix) => {
      createdPrefix = prefix;
      return "/dev/shm/sennel-test-example";
    },
    remove: () => {},
  });

  assert.ok(root instanceof TestTemporaryRoot);
  assert.equal(root.path, "/dev/shm/sennel-test-example");
  assert.equal(createdPrefix, "/dev/shm/sennel-test-");
});

test("test temporary root rejects non-tmpfs and insufficient available space", () => {
  let createCount = 0;
  const create = () => {
    createCount += 1;
    return "/dev/shm/should-not-exist";
  };
  const nonTmpfs = TestTemporaryRoot.createOnTmpfs({
    access: () => {},
    statfs: () => ({ type: 0xef53n, bavail: 2n, bsize: MINIMUM_TEST_TMPFS_BYTES }),
    create,
  });
  const tooSmall = TestTemporaryRoot.createOnTmpfs({
    access: () => {},
    statfs: () => ({ type: TMPFS_MAGIC, bavail: MINIMUM_TEST_TMPFS_BYTES - 1n, bsize: 1n }),
    create,
  });

  assert.equal(nonTmpfs, null);
  assert.equal(tooSmall, null);
  assert.equal(createCount, 0);
});

test("test temporary root falls back when the candidate cannot be inspected", () => {
  const root = TestTemporaryRoot.createOnTmpfs({
    access: () => { throw new Error("not writable"); },
    statfs: () => { throw new Error("must not run"); },
    create: () => { throw new Error("must not run"); },
  });

  assert.equal(root, null);
});

test("system temporary root creates the same cleanup boundary on fallback storage", () => {
  let createdPrefix = null;
  const root = TestTemporaryRoot.createOnSystem({
    directory: "/disk/tmp",
    create: (prefix) => {
      createdPrefix = prefix;
      return "/disk/tmp/sennel-test-example";
    },
    remove: () => {},
  });

  assert.equal(root.path, "/disk/tmp/sennel-test-example");
  assert.equal(createdPrefix, "/disk/tmp/sennel-test-");
});

test("test temporary root restores TMPDIR and removes its complete tree after success or failure", async () => {
  for (const shouldFail of [false, true]) {
    const removals = [];
    const environment = { TMPDIR: "/disk/tmp" };
    const processEvents = new EventEmitter();
    const root = new TestTemporaryRoot("/dev/shm/sennel-test-example", {
      remove: (...args) => removals.push(args),
    });

    const result = root.use(async () => {
      assert.equal(environment.TMPDIR, "/dev/shm/sennel-test-example");
      if (shouldFail) throw new Error("test failure");
      return "passed";
    }, { environment, processEvents });

    if (shouldFail) await assert.rejects(result, /test failure/);
    else assert.equal(await result, "passed");
    assert.equal(environment.TMPDIR, "/disk/tmp");
    assert.deepEqual(removals, [[
      "/dev/shm/sennel-test-example",
      { recursive: true, force: true },
    ]]);
    assert.equal(processEvents.listenerCount("exit"), 0);
    assert.equal(processEvents.listenerCount("SIGINT"), 0);
    assert.equal(processEvents.listenerCount("SIGTERM"), 0);
  }
});

test("test temporary root exit cleanup is idempotent", async () => {
  const removals = [];
  const environment = {};
  const processEvents = new EventEmitter();
  const root = new TestTemporaryRoot("/dev/shm/sennel-test-example", {
    remove: (...args) => removals.push(args),
  });

  await root.use(async () => {
    processEvents.emit("exit");
  }, { environment, processEvents });

  assert.equal("TMPDIR" in environment, false);
  assert.equal(removals.length, 1);
});

test("test temporary root removes itself before preserving an interrupt signal", async () => {
  const events = [];
  const processEvents = new EventEmitter();
  const root = new TestTemporaryRoot("/dev/shm/sennel-test-example", {
    remove: () => events.push("removed"),
  });

  await root.use(async () => {
    processEvents.emit("SIGINT");
  }, {
    environment: {},
    processEvents,
    terminate: (signal) => events.push(signal),
  });

  assert.deepEqual(events, ["removed", "SIGINT"]);
  assert.equal(processEvents.listenerCount("SIGINT"), 0);
});

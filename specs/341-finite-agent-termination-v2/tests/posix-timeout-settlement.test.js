// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ChildProcessSupervisor } from "../../../src/lib/agent.js";

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.signals = [];
  }

  kill(signal) {
    this.signals.push(signal);
    return true;
  }
}

function linuxStat({ pid, comm, state, pgrp, startFingerprint }) {
  const fieldsAfterCommand = Array.from({ length: 20 }, () => "0");
  fieldsAfterCommand[0] = state;
  fieldsAfterCommand[1] = "1";
  fieldsAfterCommand[2] = String(pgrp);
  fieldsAfterCommand[19] = String(startFingerprint);
  return `${pid} (${comm}) ${fieldsAfterCommand.join(" ")}`;
}

function installProcFixture(t, { child, readMember, onSignal = () => {}, procEntries = () => [String(child.pid)] }) {
  const originalKill = process.kill;
  const originalReaddirSync = fs.readdirSync;
  const originalReadFileSync = fs.readFileSync;

  process.kill = (target, signal) => {
    if (target !== -child.pid) return originalKill(target, signal);
    onSignal(signal);
    return true;
  };
  fs.readdirSync = (target, ...args) => {
    if (target === "/proc") return procEntries();
    return originalReaddirSync(target, ...args);
  };
  fs.readFileSync = (target, ...args) => {
    const match = String(target).match(/^\/proc\/(\d+)\/stat$/);
    if (match) return readMember(Number(match[1]));
    return originalReadFileSync(target, ...args);
  };
  t.after(() => {
    process.kill = originalKill;
    fs.readdirSync = originalReaddirSync;
    fs.readFileSync = originalReadFileSync;
  });
}

async function captureRejectionWithin(promise, timeoutMs) {
  return Promise.race([
    promise.then(() => {
      throw new Error("expected timeout rejection");
    }, (error) => error),
    new Promise((resolve) => setTimeout(
      () => resolve(new Error(`supervisor did not settle within ${timeoutMs}ms`)),
      timeoutMs,
    )),
  ]);
}

function createSupervisor(child, events) {
  return new ChildProcessSupervisor({
    child,
    timeoutMs: 5,
    graceMs: 5,
    platform: "linux",
    onEvent: (event) => events.push(event),
  });
}

test("R1: final deadline settles a stubborn POSIX process tree", { concurrency: false }, async (t) => {
  const child = new FakeChild(41001);
  const events = [];
  const signals = [];
  installProcFixture(t, {
    child,
    readMember: (pid) => linuxStat({
      pid,
      comm: "stubborn child",
      state: "S",
      pgrp: child.pid,
      startFingerprint: 101,
    }),
    onSignal(signal) {
      if (signal !== 0) signals.push(signal);
      if (signal === "SIGKILL") queueMicrotask(() => child.emit("close", null, "SIGKILL"));
    },
  });

  const supervisor = createSupervisor(child, events);
  t.after(() => supervisor._cleanup());
  const error = await captureRejectionWithin(supervisor.wait(), 300);

  assert.equal(error.code, "AGENT_TIMEOUT");
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(events.filter((event) => event.type === "settled").length, 1);
  const cleanupEvent = events.find((event) => event.type === "cleanup");
  assert.equal(cleanupEvent.activeTimers, 0);
});

test("R1: an unreadable original member keeps POSIX tree liveness unknown", { concurrency: false }, (t) => {
  const child = new FakeChild(41007);
  const events = [];
  let unreadable = false;
  installProcFixture(t, {
    child,
    readMember: (pid) => {
      if (unreadable) {
        const error = new Error("permission denied");
        error.code = "EACCES";
        throw error;
      }
      return linuxStat({
        pid,
        comm: "protected worker",
        state: "S",
        pgrp: child.pid,
        startFingerprint: 107,
      });
    },
  });

  const supervisor = createSupervisor(child, events);
  supervisor._captureOriginalPosixMembers();
  unreadable = true;

  assert.equal(supervisor._isPosixTreeDead(), false);
  assert.deepEqual(events.at(-1), { type: "tree-members-unavailable", code: "EACCES" });
});

test("R1: a live member added after capture keeps the POSIX tree alive", { concurrency: false }, (t) => {
  const child = new FakeChild(41008);
  const addedPid = 41009;
  let originalIsZombie = false;
  let includeAddedMember = false;
  installProcFixture(t, {
    child,
    procEntries: () => includeAddedMember ? [String(child.pid), String(addedPid)] : [String(child.pid)],
    readMember: (pid) => linuxStat({
      pid,
      comm: pid === child.pid ? "original worker" : "forked worker",
      state: pid === child.pid && originalIsZombie ? "Z" : "S",
      pgrp: child.pid,
      startFingerprint: pid === child.pid ? 108 : 109,
    }),
  });

  const supervisor = createSupervisor(child, []);
  supervisor._captureOriginalPosixMembers();
  originalIsZombie = true;
  includeAddedMember = true;

  assert.equal(supervisor._isPosixTreeDead(), false);
});

test("R2: parenthesized comm parsing keeps zombie state and pgrp aligned", { concurrency: false }, (t) => {
  const child = new FakeChild(41002);
  installProcFixture(t, {
    child,
    readMember: (pid) => linuxStat({
      pid,
      comm: "worker name",
      state: "Z",
      pgrp: child.pid,
      startFingerprint: 202,
    }),
  });

  const supervisor = createSupervisor(child, []);
  assert.equal(supervisor._isPosixTreeDead(), true);
});

test("R3: a PID-reused member is not kept as an original live member", { concurrency: false }, async (t) => {
  const child = new FakeChild(41003);
  const events = [];
  let reused = false;
  let treeDeadAfterReuse = null;
  let supervisor;
  installProcFixture(t, {
    child,
    readMember: (pid) => linuxStat({
      pid,
      comm: "reused worker",
      state: "S",
      pgrp: child.pid,
      startFingerprint: reused ? 3032 : 3031,
    }),
    onSignal(signal) {
      if (signal === "SIGTERM") {
        reused = true;
        return;
      }
      if (signal === "SIGKILL") {
        treeDeadAfterReuse = supervisor._isPosixTreeDead();
        queueMicrotask(() => child.emit("close", null, "SIGKILL"));
      }
    },
  });

  supervisor = createSupervisor(child, events);
  t.after(() => supervisor._cleanup());
  const error = await captureRejectionWithin(supervisor.wait(), 300);

  assert.equal(error.code, "AGENT_TIMEOUT");
  assert.equal(treeDeadAfterReuse, true);
  assert.deepEqual(error.unterminatedMembers, []);
});

test("R3: a disappeared original PID does not keep a zombie-only group alive", { concurrency: false }, (t) => {
  const child = new FakeChild(41010);
  const zombiePid = 41011;
  let originalDisappeared = false;
  installProcFixture(t, {
    child,
    procEntries: () => originalDisappeared ? [String(child.pid), String(zombiePid)] : [String(child.pid)],
    readMember: (pid) => {
      if (pid === child.pid && originalDisappeared) {
        const error = new Error("process disappeared");
        error.code = "ENOENT";
        throw error;
      }
      return linuxStat({
        pid,
        comm: pid === child.pid ? "original worker" : "zombie worker",
        state: pid === child.pid ? "S" : "Z",
        pgrp: child.pid,
        startFingerprint: pid === child.pid ? 310 : 311,
      });
    },
  });

  const supervisor = createSupervisor(child, []);
  supervisor._captureOriginalPosixMembers();
  originalDisappeared = true;

  assert.equal(supervisor._isPosixTreeDead(), true);
});

test("R4: final deadline reports each unfinished original non-zombie member", { concurrency: false }, async (t) => {
  const child = new FakeChild(41004);
  const addedPid = 41014;
  const events = [];
  let includeAddedMember = false;
  installProcFixture(t, {
    child,
    procEntries: () => includeAddedMember ? [String(child.pid), String(addedPid)] : [String(child.pid)],
    readMember: (pid) => linuxStat({
      pid,
      comm: pid === child.pid ? "stubborn child" : "late fork",
      state: "S",
      pgrp: child.pid,
      startFingerprint: pid === child.pid ? 404 : 414,
    }),
    onSignal(signal) {
      if (signal === "SIGKILL") {
        includeAddedMember = true;
        queueMicrotask(() => child.emit("close", null, "SIGKILL"));
      }
    },
  });

  const supervisor = createSupervisor(child, events);
  t.after(() => supervisor._cleanup());
  const error = await captureRejectionWithin(supervisor.wait(), 300);

  assert.equal(error.code, "AGENT_TIMEOUT");
  assert.equal(error.timeoutMs, 5);
  assert.equal(error.graceMs, 5);
  assert.equal(error.finalAction, "SIGKILL");
  assert.equal(error.killed, true);
  assert.equal(error.unterminatedMembers.length, 1);
  assert.equal(error.unterminatedMembers.some((member) => member.pid === addedPid), false);
  assert.deepEqual(error.unterminatedMembers[0].toJSON(), {
    pid: child.pid,
    state: "S",
    pgrp: child.pid,
    startFingerprint: 404,
  });
  assert.equal(Object.isFrozen(error.unterminatedMembers), true);
  assert.equal(Object.isFrozen(error.unterminatedMembers[0]), true);
});

test("R5: normal close settles without timeout signals", { concurrency: false }, async (t) => {
  const child = new FakeChild(41005);
  const events = [];
  const signals = [];
  installProcFixture(t, {
    child,
    readMember: (pid) => linuxStat({
      pid,
      comm: "normal child",
      state: "S",
      pgrp: child.pid,
      startFingerprint: 505,
    }),
    onSignal(signal) {
      signals.push(signal);
    },
  });

  const supervisor = createSupervisor(child, events);
  const result = supervisor.wait();
  child.emit("close", 0, null);

  assert.deepEqual(await result, { code: 0, signal: null });
  assert.deepEqual(signals, []);
  assert.equal(events.find((event) => event.type === "settled").outcome, "close");
});

test("R5: Windows timeout retains direct-child and taskkill escalation", { concurrency: false }, async (t) => {
  const child = new FakeChild(41006);
  const events = [];
  const taskkillCalls = [];
  const supervisor = new ChildProcessSupervisor({
    child,
    timeoutMs: 5,
    graceMs: 5,
    platform: "win32",
    onEvent: (event) => events.push(event),
    async runTaskkill(args) {
      taskkillCalls.push(args);
      child.emit("close", null, "SIGTERM");
      return { completed: true };
    },
  });

  t.after(() => supervisor._cleanup());
  const error = await captureRejectionWithin(supervisor.wait(), 100);

  assert.equal(error.code, "AGENT_TIMEOUT");
  assert.deepEqual(child.signals, ["SIGTERM"]);
  assert.deepEqual(taskkillCalls, [["/PID", "41006", "/T", "/F"]]);
  assert.equal(error.finalAction, "taskkill /T /F");
  assert.equal(events.find((event) => event.type === "taskkill").completed, true);
});

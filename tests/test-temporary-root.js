import {
  accessSync,
  constants,
  mkdtempSync,
  rmSync,
  statfsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const LINUX_TMPFS_MAGIC = 0x01021994n;
const CLEANUP_SIGNALS = Object.freeze(["SIGHUP", "SIGINT", "SIGTERM"]);
export const MINIMUM_TEST_TMPFS_BYTES = 1024n * 1024n * 1024n;

export class TestTemporaryRoot {
  #path;
  #remove;
  #removed = false;

  constructor(path, { remove = rmSync } = {}) {
    if (typeof path !== "string" || path.length === 0) {
      throw new Error("test temporary root path must be a non-empty string");
    }
    this.#path = path;
    this.#remove = remove;
  }

  static createOnTmpfs({
    directory = "/dev/shm",
    minimumFreeBytes = MINIMUM_TEST_TMPFS_BYTES,
    access = accessSync,
    statfs = statfsSync,
    create = mkdtempSync,
    remove = rmSync,
  } = {}) {
    try {
      access(directory, constants.W_OK | constants.X_OK);
      const stats = statfs(directory, { bigint: true });
      const availableBytes = BigInt(stats.bavail) * BigInt(stats.bsize);
      if (BigInt(stats.type) !== LINUX_TMPFS_MAGIC || availableBytes < BigInt(minimumFreeBytes)) {
        return null;
      }
      return new TestTemporaryRoot(create(join(directory, "sennel-test-")), { remove });
    } catch {
      return null;
    }
  }

  static createOnSystem({
    directory = tmpdir(),
    create = mkdtempSync,
    remove = rmSync,
  } = {}) {
    return new TestTemporaryRoot(create(join(directory, "sennel-test-")), { remove });
  }

  get path() {
    return this.#path;
  }

  async use(operation, {
    environment = process.env,
    processEvents = process,
    terminate = (signal) => process.kill(process.pid, signal),
  } = {}) {
    const hadTemporaryDirectory = Object.hasOwn(environment, "TMPDIR");
    const previousTemporaryDirectory = environment.TMPDIR;
    const cleanupAtExit = () => {
      try {
        this.remove();
      } catch {
        // The normal async completion path reports cleanup failures. During
        // process exit there is no safe recovery beyond a best-effort removal.
      }
    };
    const signalHandlers = new Map(CLEANUP_SIGNALS.map((signal) => [signal, () => {
      try {
        this.remove();
      } finally {
        removeLifecycleListeners();
        terminate(signal);
      }
    }]));
    const removeLifecycleListeners = () => {
      processEvents.removeListener("exit", cleanupAtExit);
      for (const [signal, handler] of signalHandlers) {
        processEvents.removeListener(signal, handler);
      }
    };

    environment.TMPDIR = this.#path;
    processEvents.once("exit", cleanupAtExit);
    for (const [signal, handler] of signalHandlers) {
      processEvents.once(signal, handler);
    }
    try {
      return await operation();
    } finally {
      removeLifecycleListeners();
      if (hadTemporaryDirectory) environment.TMPDIR = previousTemporaryDirectory;
      else delete environment.TMPDIR;
      this.remove();
    }
  }

  remove() {
    if (this.#removed) return;
    this.#remove(this.#path, { recursive: true, force: true });
    this.#removed = true;
  }
}

import fs from "node:fs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROCESS_IDENTITY_MAX_BYTES = 4096;

function processIdentityUnavailable(message, cause) {
  const error = new Error(message, { cause });
  error.code = "PROCESS_IDENTITY_UNAVAILABLE";
  return error;
}

function readBoundedIdentityFile(file) {
  const content = fs.readFileSync(file, "utf8");
  if (Buffer.byteLength(content) > PROCESS_IDENTITY_MAX_BYTES) {
    throw processIdentityUnavailable(`process identity file exceeds ${PROCESS_IDENTITY_MAX_BYTES} bytes: ${file}`);
  }
  return content;
}

function defaultBootIdentityReader() {
  return readBoundedIdentityFile("/proc/sys/kernel/random/boot_id").trim();
}

function defaultProcessStartFingerprintReader(pid) {
  const stat = readBoundedIdentityFile(`/proc/${pid}/stat`);
  const commandEnd = stat.lastIndexOf(")");
  if (commandEnd < 0) throw processIdentityUnavailable(`invalid process stat for pid ${pid}`);
  const fieldsAfterCommand = stat.slice(commandEnd + 1).trim().split(/\s+/);
  const startTime = fieldsAfterCommand[19];
  if (!/^\d+$/.test(startTime ?? "")) {
    throw processIdentityUnavailable(`invalid process start fingerprint for pid ${pid}`);
  }
  return startTime;
}

export class ProcessIdentity {
  constructor({ pid, bootIdentity, startFingerprint, ownerToken }) {
    if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("process identity pid must be a positive integer");
    if (typeof bootIdentity !== "string" || bootIdentity.trim() === "") {
      throw new Error("process identity boot identity is required");
    }
    if (typeof startFingerprint !== "string" || !/^\d+$/.test(startFingerprint)) {
      throw new Error("process identity start fingerprint must be numeric");
    }
    if (typeof ownerToken !== "string" || !UUID_PATTERN.test(ownerToken)) {
      throw new Error("process identity owner token is invalid");
    }
    this.pid = pid;
    this.bootIdentity = bootIdentity;
    this.startFingerprint = startFingerprint;
    this.ownerToken = ownerToken;
    Object.freeze(this);
  }

  sameBirth(other) {
    return other instanceof ProcessIdentity
      && this.pid === other.pid
      && this.bootIdentity === other.bootIdentity
      && this.startFingerprint === other.startFingerprint;
  }
}

class ProcessIdentityAssessment {
  constructor(status, reason) {
    this.status = status;
    this.reason = reason;
    Object.freeze(this);
  }
}

export class ProcessIdentitySource {
  constructor({
    platform = process.platform,
    pid = process.pid,
    readBootIdentity = defaultBootIdentityReader,
    readProcessStartFingerprint = defaultProcessStartFingerprintReader,
  } = {}) {
    this.platform = platform;
    this.pid = pid;
    this.readBootIdentity = readBootIdentity;
    this.readProcessStartFingerprint = readProcessStartFingerprint;
  }

  createOwner(ownerToken) {
    if (this.platform !== "linux") {
      throw processIdentityUnavailable(`process identity is unsupported on ${this.platform}`);
    }
    try {
      return new ProcessIdentity({
        pid: this.pid,
        bootIdentity: this.readBootIdentity(),
        startFingerprint: this.readProcessStartFingerprint(this.pid),
        ownerToken,
      });
    } catch (cause) {
      if (cause.code === "PROCESS_IDENTITY_UNAVAILABLE") throw cause;
      throw processIdentityUnavailable("current process identity is unavailable", cause);
    }
  }

  assess(owner) {
    if (this.platform !== "linux") {
      return new ProcessIdentityAssessment("unknown", `process identity is unsupported on ${this.platform}`);
    }
    let bootIdentity;
    try {
      bootIdentity = this.readBootIdentity();
    } catch (cause) {
      return new ProcessIdentityAssessment("unknown", `boot identity is unavailable: ${cause.message}`);
    }
    if (bootIdentity !== owner.bootIdentity) {
      return new ProcessIdentityAssessment("stale", "lock owner belongs to another system boot");
    }
    let startFingerprint;
    try {
      startFingerprint = this.readProcessStartFingerprint(owner.pid);
    } catch (cause) {
      if (cause.code === "ENOENT" || cause.code === "ESRCH") {
        return new ProcessIdentityAssessment("stale", `lock owner pid ${owner.pid} no longer exists`);
      }
      return new ProcessIdentityAssessment("unknown", `process start fingerprint is unavailable: ${cause.message}`);
    }
    if (startFingerprint !== owner.startFingerprint) {
      return new ProcessIdentityAssessment("stale", `lock owner pid ${owner.pid} was reused`);
    }
    return new ProcessIdentityAssessment("live", `lock owner pid ${owner.pid} is active`);
  }
}

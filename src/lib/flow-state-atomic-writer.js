import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const LOCK_VERSION = 2;
const LOCK_KIND = "flow-state-writer";
const MAX_TEMP_ATTEMPTS = 3;
const MAX_LOCK_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROCESS_IDENTITY_MAX_BYTES = 4096;

function serializeState(state) {
  return Buffer.from(`${JSON.stringify(state, null, 2)}\n`);
}

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function atomicError(code, message, options = {}) {
  return new FlowStateAtomicSaveError(code, message, options);
}

function authorityError(message, options = {}) {
  return atomicError("FLOW_STATE_ATOMIC_AUTHORITY_INVALID", message, options);
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function pathMayExist(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch (cause) {
    return cause.code !== "ENOENT";
  }
}

function processIdentityUnavailable(message, cause) {
  const error = new Error(message, { cause });
  error.code = "FLOW_STATE_PROCESS_IDENTITY_UNAVAILABLE";
  return error;
}

function assertBoundSpecId(boundSpecId) {
  if (
    typeof boundSpecId !== "string"
    || boundSpecId === ""
    || boundSpecId === "."
    || boundSpecId === ".."
    || boundSpecId.includes("/")
    || boundSpecId.includes("\\")
  ) {
    throw authorityError("atomic flow state replacement requires a bound specId");
  }
}

function assertRealDirectory(directory, label) {
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch (cause) {
    throw authorityError(`${label} is unavailable: ${directory}`, { cause });
  }
  let realPath;
  try {
    realPath = fs.realpathSync(directory);
  } catch (cause) {
    throw authorityError(`${label} real path is unavailable: ${directory}`, { cause });
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || realPath !== directory) {
    throw authorityError(`${label} must be a real directory: ${directory}`);
  }
}

function prepareFlowStateDirectories(root, boundSpecId) {
  assertBoundSpecId(boundSpecId);
  if (typeof root !== "string" || root === "") throw authorityError("atomic writer root is required");
  const canonicalRoot = path.resolve(root);
  assertRealDirectory(canonicalRoot, "root");
  const directories = [
    [path.join(canonicalRoot, "specs"), "specs directory"],
    [path.join(canonicalRoot, "specs", boundSpecId), "spec directory"],
  ];
  for (const [directory, label] of directories) {
    try {
      fs.mkdirSync(directory, { mode: 0o755 });
    } catch (cause) {
      if (cause.code !== "EEXIST") throw authorityError(`${label} creation failed: ${directory}`, { cause });
    }
    assertRealDirectory(directory, label);
  }
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
      if (cause.code === "FLOW_STATE_PROCESS_IDENTITY_UNAVAILABLE") throw cause;
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

class FlowStateIdentity {
  constructor(state, label) {
    if (typeof state?.runId !== "string" || state.runId.trim() === "") {
      throw authorityError(`${label} requires a non-empty runId`);
    }
    this.runId = state.runId;
    this.spec = state.spec;
    this.hasIssue = Object.hasOwn(state, "issue") && state.issue != null;
    this.issue = this.hasIssue ? Number(state.issue) : null;
    if (this.hasIssue && (!Number.isSafeInteger(this.issue) || this.issue < 1)) {
      throw authorityError(`${label} Issue must be a positive integer`);
    }
    Object.freeze(this);
  }

  sameImmutableTarget(other) {
    return other instanceof FlowStateIdentity
      && this.runId === other.runId
      && this.spec === other.spec;
  }

  sameIssue(other) {
    return other instanceof FlowStateIdentity
      && this.hasIssue === other.hasIssue
      && this.issue === other.issue;
  }
}

export class FlowStateRevision {
  #content;

  constructor(content) {
    if (!Buffer.isBuffer(content)) throw new Error("flow state revision content must be a Buffer");
    this.#content = Buffer.from(content);
    this.digest = digest(this.#content);
    this.identity = new FlowStateIdentity(
      JSON.parse(this.#content.toString("utf8")),
      "flow state revision",
    );
    Object.freeze(this);
  }

  matches(content) {
    return Buffer.isBuffer(content)
      && digest(content) === this.digest
      && content.equals(this.#content);
  }

  matchesIdentity(identity) {
    return this.identity.sameImmutableTarget(identity)
      && this.identity.sameIssue(identity);
  }
}

export class FlowStatePathAuthority {
  constructor({ root, boundSpecId, requireExisting = true }) {
    assertBoundSpecId(boundSpecId);
    this.root = this.#canonicalRoot(root);
    this.specId = boundSpecId;
    this.spec = `specs/${boundSpecId}/spec.json`;
    this.specsDirectory = path.join(this.root, "specs");
    this.specDirectory = path.join(this.specsDirectory, boundSpecId);
    this.statePath = path.join(this.specDirectory, "flow.json");
    this.lockPath = path.join(this.specDirectory, ".flow.json.writer.lock");
    assertRealDirectory(this.specsDirectory, "specs directory");
    assertRealDirectory(this.specDirectory, "spec directory");
    const stateStat = this.#optionalLstat(this.statePath, "flow state");
    if (requireExisting && stateStat == null) {
      throw authorityError(`flow state is unavailable: ${this.statePath}`);
    }
    if (!requireExisting && stateStat != null) {
      throw atomicError("FLOW_STATE_ALREADY_EXISTS", `flow state already exists: ${this.statePath}`, {
        lockPath: this.lockPath,
      });
    }
    if (stateStat != null && (
      !stateStat.isFile()
      || stateStat.isSymbolicLink()
      || this.#realpath(this.statePath, "flow state") !== this.statePath
    )) {
      throw authorityError(`flow state must be a regular real file: ${this.statePath}`);
    }
    this.mode = stateStat == null ? 0o644 : stateStat.mode & 0o777;
    if (new.target === FlowStatePathAuthority) Object.freeze(this);
  }

  assertExactSpec(spec, label) {
    if (
      typeof spec !== "string"
      || spec !== this.spec
      || spec !== path.posix.normalize(spec)
      || !/^specs\/[^/]+\/spec\.json$/.test(spec)
    ) {
      throw authorityError(`${label} spec must exactly match bound authority ${this.spec}`);
    }
  }

  #canonicalRoot(root) {
    if (typeof root !== "string" || root === "") throw authorityError("atomic writer root is required");
    const resolved = path.resolve(root);
    assertRealDirectory(resolved, "root");
    return resolved;
  }

  #lstat(target, label) {
    try {
      return fs.lstatSync(target);
    } catch (cause) {
      throw authorityError(`${label} is unavailable: ${target}`, { cause });
    }
  }

  #optionalLstat(target, label) {
    try {
      return fs.lstatSync(target);
    } catch (cause) {
      if (cause.code === "ENOENT") return null;
      throw authorityError(`${label} is unavailable: ${target}`, { cause });
    }
  }

  #realpath(target, label) {
    try {
      return fs.realpathSync(target);
    } catch (cause) {
      throw authorityError(`${label} real path is unavailable: ${target}`, { cause });
    }
  }
}

export class FlowStateWriteAuthority extends FlowStatePathAuthority {
  constructor({
    root,
    boundSpecId,
    pathAuthority,
    expectedOriginal,
    nextState,
    expectedRevision,
    allowIssueTransition = false,
  }) {
    super(pathAuthority
      ? { root: pathAuthority.root, boundSpecId: pathAuthority.specId }
      : { root, boundSpecId });
    if (!expectedOriginal || typeof expectedOriginal !== "object") {
      throw authorityError("atomic flow state replacement requires expectedOriginal");
    }
    if (!nextState || typeof nextState !== "object") {
      throw authorityError("atomic flow state replacement requires next state");
    }
    this.assertExactSpec(expectedOriginal.spec, "expected original");
    this.assertExactSpec(nextState.spec, "next state");
    this.expectedIdentity = new FlowStateIdentity(expectedOriginal, "expected original");
    this.nextIdentity = new FlowStateIdentity(nextState, "next state");
    if (!this.expectedIdentity.sameImmutableTarget(this.nextIdentity)) {
      throw authorityError("next flow state identity differs from expected original");
    }
    if (!allowIssueTransition && !this.expectedIdentity.sameIssue(this.nextIdentity)) {
      throw authorityError("next flow state issue differs from expected original");
    }
    this.expectedRevision = expectedRevision ?? new FlowStateRevision(serializeState(expectedOriginal));
    if (!(this.expectedRevision instanceof FlowStateRevision)) {
      throw authorityError("atomic flow state replacement requires a valid expected revision");
    }
    if (!this.expectedRevision.matchesIdentity(this.expectedIdentity)) {
      throw authorityError("expected flow state identity differs from its loaded revision");
    }
    this.nextContent = serializeState(nextState);
    Object.freeze(this);
  }
}

export class FlowStateCleanupError {
  constructor({ phase, target, cause }) {
    this.phase = phase;
    this.target = target;
    this.code = cause?.code ?? null;
    this.message = cause?.message ?? String(cause);
    Object.freeze(this);
  }
}

export class FlowStateAtomicSaveError extends Error {
  constructor(code, message, {
    cause,
    authority,
    committed = false,
    cleanupErrors = [],
    residuePaths = [],
    lockPath = authority?.lockPath ?? null,
  } = {}) {
    super(message, { cause });
    this.name = "FlowStateAtomicSaveError";
    this.code = code;
    this.committed = committed;
    this.path = authority?.statePath ?? null;
    this.lockPath = lockPath;
    this.cleanupErrors = [...cleanupErrors];
    this.residuePaths = [...residuePaths];
    Object.freeze(this.cleanupErrors);
    Object.freeze(this.residuePaths);
  }
}

class FaultBoundary {
  constructor(faultInjector) {
    this.faultInjector = faultInjector;
  }

  emit(phase, data = {}) {
    this.faultInjector({ phase, ...data });
  }
}

class CleanupReport {
  constructor(faults) {
    this.faults = faults;
    this.errors = [];
  }

  close(phase, descriptor, target) {
    this.#captureInjected(phase, target);
    try {
      fs.closeSync(descriptor);
    } catch (cause) {
      this.#record(phase, target, cause);
    }
  }

  unlink(phase, target) {
    if (!this.#captureInjected(phase, target)) return false;
    try {
      fs.unlinkSync(target);
      return true;
    } catch (cause) {
      this.#record(phase, target, cause);
      return false;
    }
  }

  fsyncDirectory(phase, directory) {
    if (!this.#captureInjected(phase, directory)) return;
    try {
      fsyncDirectory(directory);
    } catch (cause) {
      this.#record(phase, directory, cause);
    }
  }

  append(other) {
    this.errors.push(...other.errors);
  }

  #captureInjected(phase, target) {
    try {
      this.faults.emit(phase, { target });
      return true;
    } catch (cause) {
      this.#record(phase, target, cause);
      return false;
    }
  }

  #record(phase, target, cause) {
    this.errors.push(new FlowStateCleanupError({ phase, target, cause }));
  }
}

class FlowStateWriterLock {
  constructor(authority, faults, processIdentitySource) {
    this.authority = authority;
    this.faults = faults;
    this.processIdentitySource = processIdentitySource;
    this.processIdentity = null;
    this.ownerTempPath = null;
    this.acquired = false;
  }

  acquire() {
    let descriptor = null;
    const cleanup = new CleanupReport(this.faults);
    try {
      if (pathMayExist(this.authority.lockPath)) {
        throw this.#existingLockError(new Error("flow writer lock already exists"));
      }
      const opened = this.#openOwnerTemp();
      this.ownerTempPath = opened.path;
      descriptor = opened.descriptor;
      try {
        this.processIdentity = this.processIdentitySource.createOwner(opened.token);
      } catch (cause) {
        throw atomicError("FLOW_STATE_ATOMIC_PROCESS_IDENTITY_UNKNOWN", cause.message, {
          cause,
          authority: this.authority,
        });
      }
      const ownerContent = Buffer.from(`${JSON.stringify(this.#owner(), null, 2)}\n`);
      this.faults.emit("before-lock-owner-write", { tempPath: this.ownerTempPath });
      fs.writeFileSync(descriptor, ownerContent);
      this.faults.emit("after-lock-owner-write", { tempPath: this.ownerTempPath });
      fs.fchmodSync(descriptor, 0o600);
      this.faults.emit("before-lock-owner-fsync", { tempPath: this.ownerTempPath });
      fs.fsyncSync(descriptor);
      this.faults.emit("after-lock-owner-fsync", { tempPath: this.ownerTempPath });
      fs.closeSync(descriptor);
      descriptor = null;

      this.faults.emit("before-lock-publish", { lockPath: this.authority.lockPath });
      try {
        fs.linkSync(this.ownerTempPath, this.authority.lockPath);
      } catch (cause) {
        if (cause.code === "EEXIST") throw this.#existingLockError(cause);
        throw cause;
      }
      this.acquired = true;
      this.faults.emit("after-lock-publish", { lockPath: this.authority.lockPath });
      fs.unlinkSync(this.ownerTempPath);
      this.ownerTempPath = null;
      this.faults.emit("before-lock-dir-fsync", { lockPath: this.authority.lockPath });
      fsyncDirectory(this.authority.specDirectory);
      this.faults.emit("after-lock-dir-fsync", { lockPath: this.authority.lockPath });
      this.faults.emit("lock-acquired", { lockPath: this.authority.lockPath });
    } catch (cause) {
      if (descriptor != null) cleanup.close("before-lock-cleanup-close", descriptor, this.ownerTempPath);
      if (this.ownerTempPath) cleanup.unlink("before-lock-cleanup-owner-unlink", this.ownerTempPath);
      if (this.ownerTempPath) cleanup.fsyncDirectory("before-lock-cleanup-dir-fsync", this.authority.specDirectory);
      if (this.acquired) cleanup.unlink("before-lock-cleanup-unlink", this.authority.lockPath);
      if (this.acquired) cleanup.fsyncDirectory("before-lock-cleanup-dir-fsync", this.authority.specDirectory);
      this.acquired = false;
      if (cause instanceof FlowStateAtomicSaveError) {
        throw new FlowStateAtomicSaveError(cause.code, cause.message, {
          cause: cause.cause,
          authority: this.authority,
          committed: false,
          cleanupErrors: [...cause.cleanupErrors, ...cleanup.errors],
          residuePaths: this.#residuePaths(),
        });
      }
      throw atomicError(
        "FLOW_STATE_ATOMIC_SAVE_FAILED",
        `flow writer lock acquisition failed: ${cause.message}`,
        {
          cause,
          authority: this.authority,
          cleanupErrors: cleanup.errors,
          residuePaths: this.#residuePaths(),
        },
      );
    }
  }

  release() {
    const cleanup = new CleanupReport(this.faults);
    if (!this.acquired) return cleanup;
    let owner;
    try {
      owner = this.#readOwner();
      if (owner.processIdentity.ownerToken !== this.processIdentity.ownerToken) {
        throw new Error("flow writer lock ownership changed");
      }
    } catch (cause) {
      cleanup.errors.push(new FlowStateCleanupError({
        phase: "lock-owner-verify",
        target: this.authority.lockPath,
        cause,
      }));
      return cleanup;
    }
    if (cleanup.unlink("before-lock-release-unlink", this.authority.lockPath)) {
      cleanup.fsyncDirectory("before-lock-release-dir-fsync", this.authority.specDirectory);
      this.acquired = false;
    }
    return cleanup;
  }

  #openOwnerTemp() {
    for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
      const token = crypto.randomUUID();
      const tempPath = path.join(this.authority.specDirectory, `.flow.json.writer.${token}.owner.tmp`);
      this.faults.emit("before-lock-owner-temp-open", { attempt, tempPath });
      try {
        const descriptor = fs.openSync(tempPath, "wx", 0o600);
        return { token, path: tempPath, descriptor };
      } catch (cause) {
        if (cause.code !== "EEXIST") throw cause;
      }
    }
    throw atomicError("FLOW_STATE_ATOMIC_TEMP_COLLISION", "flow writer owner temp collision limit exceeded", {
      authority: this.authority,
    });
  }

  #owner() {
    return {
      version: LOCK_VERSION,
      kind: LOCK_KIND,
      processIdentity: this.processIdentity,
      root: this.authority.root,
      spec: this.authority.spec,
      statePath: this.authority.statePath,
    };
  }

  #existingLockError(cause) {
    let owner;
    try {
      owner = this.#readOwner();
    } catch (ownerCause) {
      return atomicError("FLOW_STATE_ATOMIC_LOCK_CORRUPT", "flow writer lock is corrupt", {
        cause: ownerCause,
        authority: this.authority,
      });
    }
    const assessment = this.processIdentitySource.assess(owner.processIdentity);
    if (assessment.status === "live") {
      return atomicError("FLOW_STATE_ATOMIC_BUSY", assessment.reason, {
        cause,
        authority: this.authority,
      });
    }
    if (assessment.status === "stale") {
      return atomicError("FLOW_STATE_ATOMIC_LOCK_STALE", assessment.reason, {
        cause,
        authority: this.authority,
      });
    }
    return atomicError("FLOW_STATE_ATOMIC_LOCK_UNKNOWN", assessment.reason, {
      cause,
      authority: this.authority,
    });
  }

  #readOwner() {
    const stat = fs.lstatSync(this.authority.lockPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_LOCK_BYTES) {
      throw new Error("flow writer lock must be a bounded regular file");
    }
    const owner = JSON.parse(fs.readFileSync(this.authority.lockPath, "utf8"));
    if (
      owner.version !== LOCK_VERSION
      || owner.kind !== LOCK_KIND
      || owner.root !== this.authority.root
      || owner.spec !== this.authority.spec
      || owner.statePath !== this.authority.statePath
    ) {
      throw new Error("flow writer lock authority is invalid");
    }
    try {
      owner.processIdentity = new ProcessIdentity(owner.processIdentity ?? {});
    } catch (cause) {
      throw new Error("flow writer lock process identity is invalid", { cause });
    }
    return owner;
  }

  #residuePaths() {
    return [this.ownerTempPath, this.authority.lockPath]
      .filter((candidate) => candidate && pathMayExist(candidate));
  }
}

export class FlowStateCreator {
  constructor({ root, boundSpecId, state, faultInjector = () => {} }) {
    const expectedSpec = `specs/${boundSpecId}/spec.json`;
    assertBoundSpecId(boundSpecId);
    if (state?.spec !== expectedSpec) {
      throw authorityError(`new state spec must exactly match bound authority ${expectedSpec}`);
    }
    prepareFlowStateDirectories(root, boundSpecId);
    this.authority = new FlowStatePathAuthority({ root, boundSpecId, requireExisting: false });
    this.authority.assertExactSpec(state?.spec, "new state");
    this.identity = new FlowStateIdentity(state, "new state");
    this.content = serializeState(state);
    this.faults = new FaultBoundary(faultInjector);
  }

  create() {
    let descriptor = null;
    let created = false;
    let primary = null;
    const cleanup = new CleanupReport(this.faults);
    try {
      descriptor = fs.openSync(this.authority.statePath, "wx", this.authority.mode);
      created = true;
      fs.writeFileSync(descriptor, this.content);
      fs.fchmodSync(descriptor, this.authority.mode);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      fsyncDirectory(this.authority.specDirectory);
    } catch (cause) {
      primary = cause;
    }
    if (primary) {
      if (descriptor != null) cleanup.close("before-create-cleanup-close", descriptor, this.authority.statePath);
      if (created) cleanup.unlink("before-create-cleanup-unlink", this.authority.statePath);
      if (created) cleanup.fsyncDirectory("before-create-cleanup-dir-fsync", this.authority.specDirectory);
    }
    if (primary || cleanup.errors.length > 0) {
      const code = primary?.code === "EEXIST"
        ? "FLOW_STATE_ALREADY_EXISTS"
        : "FLOW_STATE_CREATE_FAILED";
      throw atomicError(code, primary?.message ?? "flow state create cleanup failed", {
        cause: primary,
        authority: this.authority,
        cleanupErrors: cleanup.errors,
        residuePaths: pathMayExist(this.authority.statePath) ? [this.authority.statePath] : [],
      });
    }
    return { created: true, path: this.authority.statePath };
  }
}

export class AtomicFlowStateWriter {
  constructor({
    root,
    boundSpecId,
    expectedOriginal,
    nextState,
    expectedRevision,
    faultInjector = () => {},
    processIdentitySource = new ProcessIdentitySource(),
  }) {
    this.pathAuthority = new FlowStatePathAuthority({ root, boundSpecId });
    this.replacementAuthority = expectedOriginal == null && nextState == null
      ? null
      : new FlowStateWriteAuthority({
        pathAuthority: this.pathAuthority,
        expectedOriginal,
        nextState,
        expectedRevision,
      });
    this.faults = new FaultBoundary(faultInjector);
    this.lock = new FlowStateWriterLock(this.pathAuthority, this.faults, processIdentitySource);
  }

  save() {
    if (this.replacementAuthority == null) {
      throw authorityError("atomic replacement requires expected and next state", {
        authority: this.pathAuthority,
      });
    }
    return this.#replace(() => this.replacementAuthority);
  }

  mutate(mutator, {
    parseState = (content) => JSON.parse(content.toString("utf8")),
    validateState = () => {},
    onFailure = null,
    allowIssueTransition = false,
  } = {}) {
    if (typeof mutator !== "function") throw new Error("flow state mutator must be a function");
    return this.#replace((current) => {
      const expectedOriginal = parseState(current, this.pathAuthority.statePath);
      const nextState = structuredClone(expectedOriginal);
      mutator(nextState);
      validateState(nextState, this.pathAuthority.statePath);
      return new FlowStateWriteAuthority({
        pathAuthority: this.pathAuthority,
        expectedOriginal,
        nextState,
        expectedRevision: new FlowStateRevision(current),
        allowIssueTransition,
      });
    }, onFailure);
  }

  #replace(resolveAuthority, onFailure = null) {
    this.lock.acquire();
    let descriptor = null;
    let tempPath = null;
    let committed = false;
    let primary = null;
    let writeAuthority = this.pathAuthority;
    const cleanup = new CleanupReport(this.faults);
    try {
      const current = fs.readFileSync(this.pathAuthority.statePath);
      writeAuthority = resolveAuthority(current);
      if (!writeAuthority.expectedRevision.matches(current)) {
        throw atomicError("FLOW_STATE_ATOMIC_STALE", "flow state changed after target resolution", {
          authority: writeAuthority,
        });
      }

      const opened = this.#openStateTemp(writeAuthority);
      tempPath = opened.path;
      descriptor = opened.descriptor;
      this.faults.emit("before-state-temp-write", { tempPath });
      fs.writeFileSync(descriptor, writeAuthority.nextContent);
      this.faults.emit("after-state-temp-write", { tempPath });
      fs.fchmodSync(descriptor, writeAuthority.mode);
      this.faults.emit("before-state-file-fsync", { tempPath });
      fs.fsyncSync(descriptor);
      this.faults.emit("after-state-file-fsync", { tempPath });
      fs.closeSync(descriptor);
      descriptor = null;

      this.faults.emit("before-state-rename", { tempPath, statePath: writeAuthority.statePath });
      fs.renameSync(tempPath, writeAuthority.statePath);
      tempPath = null;
      committed = true;
      this.faults.emit("after-state-rename", { statePath: writeAuthority.statePath });
      this.faults.emit("before-state-dir-fsync", { statePath: writeAuthority.statePath });
      fsyncDirectory(writeAuthority.specDirectory);
      this.faults.emit("after-state-dir-fsync", { statePath: writeAuthority.statePath });
    } catch (cause) {
      primary = cause;
    }

    if (primary && !committed && typeof onFailure === "function") {
      try {
        onFailure(primary);
      } catch (rollbackError) {
        primary = new AggregateError([primary, rollbackError], "flow state mutation rollback failed");
      }
    }

    if (descriptor != null) cleanup.close("before-state-cleanup-close", descriptor, tempPath);
    if (tempPath) cleanup.unlink("before-state-cleanup-unlink", tempPath);
    if (tempPath) cleanup.fsyncDirectory("before-state-cleanup-dir-fsync", writeAuthority.specDirectory);
    cleanup.append(this.lock.release());
    const residuePaths = [tempPath, writeAuthority.lockPath]
      .filter((candidate) => candidate && pathMayExist(candidate));

    if (primary || cleanup.errors.length > 0) {
      const code = primary instanceof FlowStateAtomicSaveError
        ? primary.code
        : "FLOW_STATE_ATOMIC_SAVE_FAILED";
      const message = primary?.message ?? "atomic flow state replacement cleanup failed";
      throw atomicError(code, message, {
        cause: primary?.cause ?? primary,
        authority: writeAuthority,
        committed,
        cleanupErrors: [
          ...(primary instanceof FlowStateAtomicSaveError ? primary.cleanupErrors : []),
          ...cleanup.errors,
        ],
        residuePaths,
      });
    }
    return { committed: true, path: writeAuthority.statePath };
  }

  #openStateTemp(authority) {
    for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
      const tempPath = path.join(authority.specDirectory, `.flow.json.${crypto.randomUUID()}.tmp`);
      this.faults.emit("before-state-temp-open", { attempt, tempPath });
      try {
        return { path: tempPath, descriptor: fs.openSync(tempPath, "wx", authority.mode) };
      } catch (cause) {
        if (cause.code !== "EEXIST") throw cause;
      }
    }
    throw atomicError("FLOW_STATE_ATOMIC_TEMP_COLLISION", "flow state temp collision limit exceeded", {
      authority,
    });
  }
}

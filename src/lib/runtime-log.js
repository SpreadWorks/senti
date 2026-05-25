import fs from "fs";
import path from "path";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const TRUNCATED_MARKER = "[runtime-log] truncated: size limit reached\n";

function sanitizeFlowId(value) {
  return String(value || "no-flow")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "no-flow";
}

function isoNow() {
  return new Date().toISOString();
}

function shellCommand({ envelopeType, envelopeKey }) {
  if (envelopeType === "flow") return ["flow", envelopeKey].filter(Boolean).join(" ");
  if (envelopeType === "run" && envelopeKey === "prepare-spec") return "flow prepare";
  if (envelopeType === "run" && envelopeKey === "resume") return "flow resume";
  return ["flow", envelopeType, envelopeKey].filter(Boolean).join(" ");
}

export class RuntimeLogMetadata {
  constructor({ runId, sequence, attempt = 1, command, startedAt, endedAt = null, exitCode = null }) {
    if (!runId) throw new Error("runtime log runId is required");
    if (!Number.isInteger(sequence) || sequence < 1) throw new Error(`invalid runtime log sequence: ${sequence}`);
    if (!Number.isInteger(attempt) || attempt < 1) throw new Error(`invalid runtime log attempt: ${attempt}`);
    if (!command) throw new Error("runtime log command is required");
    this.runId = String(runId);
    this.sequence = sequence;
    this.attempt = attempt;
    this.command = String(command);
    this.startedAt = startedAt || isoNow();
    this.endedAt = endedAt;
    this.exitCode = exitCode;
  }

  finish(exitCode, endedAt = isoNow()) {
    return new RuntimeLogMetadata({
      runId: this.runId,
      sequence: this.sequence,
      attempt: this.attempt,
      command: this.command,
      startedAt: this.startedAt,
      endedAt,
      exitCode,
    });
  }

  toStepMetadata() {
    return {
      runId: this.runId,
      sequence: this.sequence,
      attempt: this.attempt,
      command: this.command,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      exitCode: this.exitCode,
    };
  }
}

export class RuntimeLogBlock {
  constructor(text) {
    this.text = String(text || "");
    const start = this.text.split("\n")[0] || "";
    this.runId = start.match(/\brunId=([^ ]+)/)?.[1] || null;
    this.sequence = Number(start.match(/\bsequence=(\d+)/)?.[1] || 0);
    this.attempt = Number(start.match(/\battempt=(\d+)/)?.[1] || 0);
    this.command = start.match(/\bcommand="([^"]*)"/)?.[1] || "";
    this.startedAt = start.match(/\bstartedAt="([^"]*)"/)?.[1] || null;
    const end = this.text.trimEnd().split("\n").at(-1) || "";
    this.endedAt = end.match(/\bendedAt="([^"]*)"/)?.[1] || null;
    this.exitCode = Number(end.match(/\bexitCode=(\d+)/)?.[1] || 0);
  }

  toJSON() {
    return {
      text: this.text,
      runId: this.runId,
      sequence: this.sequence,
      command: this.command,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      exitCode: this.exitCode,
    };
  }
}

export class RuntimeLogFile {
  constructor(root, flowId) {
    this.root = root;
    this.flowId = sanitizeFlowId(flowId);
    this.filePath = path.join(root, ".tmp", "logs", `${this.flowId}.log`);
  }

  read() {
    if (!fs.existsSync(this.filePath)) return "";
    return fs.readFileSync(this.filePath, "utf8");
  }

  nextSequence() {
    return [...this.read().matchAll(/^===== start /gm)].length + 1;
  }

  append(text) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, text, "utf8");
  }

  blocks() {
    return [...this.read().matchAll(/^===== start [^\n]*\n[\s\S]*?^===== end [^\n]*$/gm)]
      .map((match) => new RuntimeLogBlock(match[0]));
  }

  select({ sequence = null, runId = null, latestNonRuntimeLog = false } = {}) {
    const blocks = this.blocks();
    if (sequence != null || runId != null) {
      return blocks.find((block) => {
        if (sequence != null && block.sequence !== sequence) return false;
        if (runId != null && block.runId !== runId) return false;
        return true;
      }) || null;
    }
    const candidates = latestNonRuntimeLog
      ? blocks.filter((block) => block.command !== "flow get runtime-log")
      : blocks;
    return candidates.at(-1) || null;
  }
}

export class RuntimeLogBlockWriter {
  constructor({ root, flowId, runId, command, maxBytes = DEFAULT_MAX_BYTES }) {
    this.file = new RuntimeLogFile(root, flowId);
    this.bytesWritten = 0;
    this.maxBytes = maxBytes;
    this.truncated = false;
    this.metadata = new RuntimeLogMetadata({
      runId,
      sequence: this.file.nextSequence(),
      attempt: 1,
      command,
      startedAt: isoNow(),
    });
    this.lineOpen = { stdout: false, stderr: false };
    this.file.append(this.startLine());
  }

  static forDispatch({ root, flowId, runId, envelopeType, envelopeKey }) {
    return new RuntimeLogBlockWriter({
      root,
      flowId,
      runId,
      command: shellCommand({ envelopeType, envelopeKey }),
    });
  }

  startLine() {
    const m = this.metadata;
    return `===== start runId=${m.runId} sequence=${m.sequence} attempt=${m.attempt} command="${m.command}" startedAt="${m.startedAt}" exitCode="" endedAt="" =====\n`;
  }

  capture(stream, chunk) {
    if (this.truncated) return;
    let text = String(chunk);
    const otherStream = stream === "stdout" ? "stderr" : "stdout";
    if (text.length > 0 && this.lineOpen[otherStream]) {
      this.writeBounded("\n");
      this.lineOpen[otherStream] = false;
    }
    while (text.length > 0) {
      if (!this.lineOpen[stream]) {
        this.writeBounded(`[${stream}] `);
        this.lineOpen[stream] = true;
      }
      const newlineIndex = text.indexOf("\n");
      if (newlineIndex === -1) {
        this.writeBounded(text);
        return;
      }
      this.writeBounded(text.slice(0, newlineIndex + 1));
      this.lineOpen[stream] = false;
      text = text.slice(newlineIndex + 1);
    }
  }

  writeBounded(text) {
    const remaining = this.maxBytes - this.bytesWritten;
    const bytes = Buffer.byteLength(text);
    if (bytes <= remaining) {
      this.file.append(text);
      this.bytesWritten += bytes;
      return;
    }
    const markerBytes = Buffer.byteLength(TRUNCATED_MARKER);
    const allowed = Math.max(0, remaining - markerBytes);
    if (allowed > 0) this.file.append(Buffer.from(text).subarray(0, allowed).toString());
    this.file.append(TRUNCATED_MARKER);
    this.bytesWritten = this.maxBytes;
    this.truncated = true;
  }

  close(exitCode) {
    for (const stream of Object.keys(this.lineOpen)) {
      if (this.lineOpen[stream]) {
        this.writeBounded("\n");
        this.lineOpen[stream] = false;
      }
    }
    this.metadata = this.metadata.finish(exitCode);
    const m = this.metadata;
    this.file.append(`===== end runId=${m.runId} sequence=${m.sequence} attempt=${m.attempt} command="${m.command}" startedAt="${m.startedAt}" exitCode=${m.exitCode} endedAt="${m.endedAt}" =====\n`);
    return m;
  }
}

export function runtimeLogFileForContext({ root, specId }) {
  return new RuntimeLogFile(root, specId || "no-flow");
}

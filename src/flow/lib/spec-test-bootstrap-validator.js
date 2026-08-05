import fs from "node:fs";
import path from "node:path";

import { getSpecTestFiles } from "./test-headers.js";

const STATIC_IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+(?:\*|\{[\s\S]*?\})\s+from\s+)(["'])([^"']+)\1/g;

function maskCommentsAndTemplates(source) {
  const chars = [...source];
  let state = "code";
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = chars[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        chars[index] = " ";
        chars[index + 1] = " ";
        index += 1;
        state = "line-comment";
      } else if (char === "/" && next === "*") {
        chars[index] = " ";
        chars[index + 1] = " ";
        index += 1;
        state = "block-comment";
      } else if (char === "`") {
        chars[index] = " ";
        state = "template";
      } else if (char === "'") {
        state = "single-quote";
      } else if (char === '"') {
        state = "double-quote";
      }
      continue;
    }
    if (state === "line-comment") {
      if (char === "\n") state = "code";
      else chars[index] = " ";
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        chars[index] = " ";
        chars[index + 1] = " ";
        index += 1;
        state = "code";
      } else if (char !== "\n") {
        chars[index] = " ";
      }
      continue;
    }
    if (state === "template") {
      if (char === "\\" && next !== undefined) {
        chars[index] = " ";
        if (next !== "\n") chars[index + 1] = " ";
        index += 1;
      } else if (char === "`") {
        chars[index] = " ";
        state = "code";
      } else if (char !== "\n") {
        chars[index] = " ";
      }
      continue;
    }
    const quote = state === "single-quote" ? "'" : '"';
    if (char === "\\" && next !== undefined) index += 1;
    else if (char === quote) state = "code";
  }
  return chars.join("");
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function existingRegularFile(file) {
  try {
    return fs.lstatSync(file).isFile();
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

class SpecTestStaticImport {
  constructor({ file, specifier, line }) {
    this.file = file;
    this.specifier = specifier;
    this.line = line;
    Object.freeze(this);
  }

  static fromSource(file, source) {
    const imports = [];
    const searchableSource = maskCommentsAndTemplates(source);
    STATIC_IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = STATIC_IMPORT_RE.exec(searchableSource)) !== null) {
      const specifier = match[2];
      if (!specifier.startsWith(".")) continue;
      const statementStart = match.index + (match[0].startsWith("\n") ? 1 : 0);
      imports.push(new SpecTestStaticImport({
        file,
        specifier,
        line: source.slice(0, statementStart).split("\n").length,
      }));
    }
    return imports;
  }
}

class MissingSpecTestStaticImport {
  constructor({ relativeTestFile, imported, expectedPath }) {
    this.relativeTestFile = relativeTestFile;
    this.imported = imported;
    this.expectedPath = expectedPath;
    Object.freeze(this);
  }

  toString() {
    return `${this.relativeTestFile}:${this.imported.line} statically imports missing pre-implementation module ${this.imported.specifier} (${this.expectedPath})`;
  }
}

export class SpecTestBootstrapValidation {
  constructor(issues) {
    this.issues = Object.freeze([...issues]);
    Object.freeze(this);
  }

  get ok() {
    return this.issues.length === 0;
  }

  assertValid() {
    if (!this.ok) throw new Error(this.issues.map((issue) => issue.toString()).join("; "));
  }
}

/**
 * Spec tests are published from a dispatcher handoff but execute from their
 * canonical base-side location. Static relative imports must therefore resolve
 * before implementation begins. Future modules belong behind a caught dynamic
 * import so their absence becomes an R-N assertion failure instead of aborting
 * the complete test file during module bootstrap.
 */
export class SpecTestBootstrapValidator {
  constructor({ payloadSpecDir, canonicalSpecDir, repositoryRoot, executionRoot }) {
    this.payloadSpecDir = path.resolve(payloadSpecDir);
    this.payloadTestsDir = path.join(this.payloadSpecDir, "tests");
    this.canonicalSpecDir = path.resolve(canonicalSpecDir);
    this.canonicalTestsDir = path.join(this.canonicalSpecDir, "tests");
    this.specRoot = path.dirname(this.canonicalSpecDir);
    this.repositoryRoot = path.resolve(repositoryRoot);
    this.executionRoot = path.resolve(executionRoot);
    Object.freeze(this);
  }

  expectedTarget(imported) {
    const relativeTestFile = path.relative(this.payloadTestsDir, imported.file);
    const canonicalTestFile = path.join(this.canonicalTestsDir, relativeTestFile);
    const specifierPath = imported.specifier.split(/[?#]/, 1)[0];
    const canonicalTarget = path.resolve(path.dirname(canonicalTestFile), specifierPath);
    if (isWithin(this.canonicalTestsDir, canonicalTarget)) {
      return path.join(this.payloadTestsDir, path.relative(this.canonicalTestsDir, canonicalTarget));
    }
    if (isWithin(this.specRoot, canonicalTarget)) return canonicalTarget;
    if (isWithin(this.repositoryRoot, canonicalTarget)) {
      return path.join(this.executionRoot, path.relative(this.repositoryRoot, canonicalTarget));
    }
    return canonicalTarget;
  }

  validate() {
    const issues = [];
    for (const file of getSpecTestFiles(this.payloadSpecDir)) {
      const source = fs.readFileSync(file, "utf8");
      for (const imported of SpecTestStaticImport.fromSource(file, source)) {
        const expectedPath = this.expectedTarget(imported);
        if (existingRegularFile(expectedPath)) continue;
        issues.push(new MissingSpecTestStaticImport({
          relativeTestFile: path.relative(this.payloadTestsDir, file),
          imported,
          expectedPath: path.relative(this.executionRoot, expectedPath),
        }));
      }
    }
    return new SpecTestBootstrapValidation(issues);
  }
}

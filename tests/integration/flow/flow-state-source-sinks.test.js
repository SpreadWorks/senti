import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const srcRoot = path.join(repoRoot, "src");
const allowedOwner = path.join(srcRoot, "flow", "lib", "current-flow-state.js");
const allowedSinkOwners = new Set([
  allowedOwner,
]);
const sinkApis = new Set([
  "writeFileSync", "writeFile", "appendFileSync", "appendFile",
  "renameSync", "rename", "copyFileSync", "copyFile", "openSync",
  "createWriteStream", "writeJson", "writeJsonFile",
]);

function sourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(target);
  }
  return files;
}

function balancedBlocks(source, starts) {
  const blocks = [];
  for (const match of source.matchAll(starts)) {
    const open = source.indexOf("{", match.index);
    let depth = 1;
    let index = open + 1;
    while (index < source.length && depth > 0) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") depth -= 1;
      index += 1;
    }
    blocks.push({ header: match[0], body: source.slice(open + 1, index - 1) });
  }
  return blocks;
}

function identifierAppears(expression, identifier) {
  return new RegExp(`(?:^|[^\\w$])${identifier.replace(/[$]/g, "\\$")}(?:$|[^\\w$])`).test(expression);
}

function lexicalMask(source, preserveStrings = false) {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n\r]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g,
    (fragment) => {
      if (preserveStrings && !fragment.startsWith("/")) return fragment;
      return fragment.replace(/[^\n\r]/g, " ");
    },
  );
}

class FlowFact {
  constructor(propagation) {
    if (!(propagation instanceof FlowPropagation)) throw new Error("flow fact requires propagation");
    this.propagation = propagation;
    this.supported = false;
    this.unsupported = false;
    this.dependencies = new Set();
    propagation.facts.add(this);
  }

  update(supported, unsupported) {
    const changed = (supported && !this.supported) || (unsupported && !this.unsupported);
    this.supported ||= supported;
    this.unsupported ||= unsupported;
    return changed;
  }
}

class FlowBinding extends FlowFact {
  constructor(propagation, scope, name) {
    super(propagation);
    if (!(scope instanceof LexicalScope) || !/^[A-Za-z_$][\w$]*$/.test(name)) {
      throw new Error("invalid flow binding");
    }
    this.scope = scope;
    this.name = name;
    this.members = new Map();
    this.returnFact = null;
  }

  member(key) {
    if (!this.members.has(key)) {
      this.members.set(key, new FlowMemberFact(this.propagation, this, key));
    }
    return this.members.get(key);
  }

  returned() {
    this.returnFact ||= new FlowReturnFact(this.propagation, this);
    return this.returnFact;
  }
}

class FlowMemberFact extends FlowFact {
  constructor(propagation, owner, key) {
    super(propagation);
    if (!(owner instanceof FlowBinding) || !/^[A-Za-z_$][\w$]*$/.test(key)) {
      throw new Error("invalid flow member");
    }
    this.owner = owner;
    this.key = key;
  }
}

class FlowReturnFact extends FlowFact {
  constructor(propagation, callable) {
    super(propagation);
    if (!(callable instanceof FlowBinding)) throw new Error("invalid flow return");
    this.callable = callable;
  }
}

class FlowDependency {
  constructor(source, target, rejectsShape) {
    if (!(source instanceof FlowFact) || !(target instanceof FlowFact)) {
      throw new Error("invalid flow dependency");
    }
    this.source = source;
    this.target = target;
    this.rejectsShape = rejectsShape;
    Object.freeze(this);
  }

  transfer() {
    if (this.rejectsShape) {
      return this.target.update(false, this.source.supported || this.source.unsupported);
    }
    return this.target.update(this.source.supported, this.source.unsupported);
  }
}

class FlowPropagation {
  constructor() {
    this.facts = new Set();
    this.dependencies = [];
  }

  connect(source, target, rejectsShape = false) {
    if ([...source.dependencies].some((dependency) => (
      dependency.target === target && dependency.rejectsShape === rejectsShape
    ))) return;
    const dependency = new FlowDependency(source, target, rejectsShape);
    source.dependencies.add(dependency);
    this.dependencies.push(dependency);
  }

  run() {
    const queue = [...this.facts].filter((fact) => fact.supported || fact.unsupported);
    const queued = new Set(queue);
    const maximumWork = 2 * (this.facts.size + this.dependencies.length);
    let work = 0;
    while (queue.length > 0) {
      const source = queue.shift();
      queued.delete(source);
      work += 1;
      for (const dependency of source.dependencies) {
        work += 1;
        if (dependency.transfer() && !queued.has(dependency.target)) {
          queue.push(dependency.target);
          queued.add(dependency.target);
        }
      }
      if (work > maximumWork) throw new Error(`flow propagation exceeded ${maximumWork} steps`);
    }
  }
}

class LexicalScope {
  constructor(propagation, parent, kind, start, end) {
    if (!(propagation instanceof FlowPropagation)
      || (parent !== null && !(parent instanceof LexicalScope))
      || !new Set(["file", "function", "block", "class"]).has(kind)
      || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
      throw new Error("invalid lexical scope");
    }
    this.propagation = propagation;
    this.parent = parent;
    this.kind = kind;
    this.start = start;
    this.end = end;
    this.bindings = new Map();
    this.callable = null;
  }

  contains(position) {
    return position >= this.start && position < this.end;
  }

  declare(name) {
    if (!this.bindings.has(name)) {
      this.bindings.set(name, new FlowBinding(this.propagation, this, name));
    }
    return this.bindings.get(name);
  }

  resolve(name) {
    return this.bindings.get(name) || this.parent?.resolve(name) || null;
  }

  declarationOwner(kind) {
    if (kind !== "var") return this;
    let owner = this;
    while (owner.parent && owner.kind !== "function") owner = owner.parent;
    return owner;
  }

  nearestFunction() {
    let scope = this;
    while (scope && scope.kind !== "function") scope = scope.parent;
    return scope;
  }
}

class ScopeOpening {
  constructor(kind, name, parameters = "") {
    if (!new Set(["function", "class"]).has(kind)) throw new Error("invalid scope opening");
    this.kind = kind;
    this.name = name;
    this.parameters = parameters;
    Object.freeze(this);
  }
}

class LexicalOutline {
  constructor(source, propagation) {
    this.source = source;
    this.mask = lexicalMask(source);
    this.propagation = propagation;
    this.file = new LexicalScope(propagation, null, "file", 0, source.length);
    this.scopes = [this.file];
    this.build();
  }

  build() {
    const openings = new Map();
    for (const match of this.mask.matchAll(
      /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
    )) {
      openings.set(match.index + match[0].lastIndexOf("{"), new ScopeOpening("function", match[1], match[2]));
    }
    for (const match of this.mask.matchAll(
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*\{/g,
    )) {
      openings.set(match.index + match[0].lastIndexOf("{"), new ScopeOpening("function", match[1], match[2]));
    }
    for (const match of this.mask.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)[^{}]*\{/g)) {
      openings.set(match.index + match[0].lastIndexOf("{"), new ScopeOpening("class", match[1]));
    }
    const stack = [];
    const ranges = [];
    for (let index = 0; index < this.mask.length; index += 1) {
      if (this.mask[index] === "{") stack.push(index);
      else if (this.mask[index] === "}" && stack.length > 0) ranges.push([stack.pop(), index]);
    }
    const parents = [this.file];
    for (const [open, close] of ranges.sort((left, right) => left[0] - right[0])) {
      while (parents.length > 1 && !parents.at(-1).contains(open)) parents.pop();
      const opening = openings.get(open);
      const scope = new LexicalScope(
        this.propagation,
        parents.at(-1),
        opening?.kind || "block",
        open + 1,
        close,
      );
      if (opening?.name) {
        const binding = scope.parent.declare(opening.name);
        if (opening.kind === "function") scope.callable = binding;
      }
      if (opening?.kind === "function") {
        for (const parameter of opening.parameters.split(",").map((value) => value.trim())) {
          if (/^[A-Za-z_$][\w$]*$/.test(parameter)) scope.declare(parameter);
        }
      }
      this.scopes.push(scope);
      parents.push(scope);
    }
  }

  at(position) {
    let found = this.file;
    for (const scope of this.scopes) {
      if (scope.contains(position) && scope.start >= found.start && scope.end <= found.end) found = scope;
    }
    return found;
  }

  resolve(name, position) {
    return this.at(position).resolve(name);
  }
}

class FlowExpression {
  constructor(source, position, outline) {
    if (typeof source !== "string" || !Number.isSafeInteger(position) || position < 0
      || !(outline instanceof LexicalOutline)) {
      throw new Error("invalid flow expression");
    }
    this.source = source;
    this.position = position;
    this.outline = outline;
    this.mask = lexicalMask(source);
  }

  containsDirectSource() {
    const withStrings = lexicalMask(this.source, true);
    return /['"`]flow\.json['"`]/.test(withStrings)
      || /\[\s*['"`]flow['"`]\s*,\s*['"`]json['"`]\s*\]\.join\(\s*['"`]\.['"`]\s*\)/.test(withStrings)
      || /\bSTATE_FILE\b/.test(this.mask)
      || /\bflowStatePath\s*\(/.test(this.mask);
  }

  supportedDirectSource() {
    const expression = this.source.trim();
    if (/^(['"`])flow\.json\1$/.test(expression)) return true;
    if (/^\[\s*['"`]flow['"`]\s*,\s*['"`]json['"`]\s*\]\.join\(\s*['"`]\.['"`]\s*\)$/.test(expression)) return true;
    if (expression === "STATE_FILE") return true;
    if (/^flowStatePath\s*\([^)]*\)$/.test(expression)) return true;
    return this.supportedPathJoin() && this.containsDirectSource();
  }

  supportedPathJoin() {
    const expression = this.source.trim();
    if (!/^path\s*\.\s*join\s*\(/.test(expression) || !expression.endsWith(")")) return false;
    return this.simpleArguments(this.source.indexOf("("));
  }

  simpleArguments(openParen) {
    return argumentsAt(this.source, openParen).every((argument) => (
      /^\s*(?:[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*\s*\.\s*[A-Za-z_$][\w$]*|[\d.]+|['"`][\s\S]*['"`])\s*$/.test(argument)
    ));
  }

  references() {
    const references = new Set();
    const occupied = [];
    for (const member of this.mask.matchAll(/\b([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)/g)) {
      const owner = this.outline.resolve(member[1], this.position + member.index);
      if (owner) references.add(owner.member(member[2]));
      occupied.push([member.index, member.index + member[0].length]);
    }
    for (const call of this.mask.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (occupied.some(([start, end]) => call.index >= start && call.index < end)) continue;
      const callable = this.outline.resolve(call[1], this.position + call.index);
      if (callable) references.add(callable.returned());
      occupied.push([call.index, call.index + call[1].length]);
    }
    for (const identifier of this.mask.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (occupied.some(([start, end]) => identifier.index >= start && identifier.index < end)) continue;
      const binding = this.outline.resolve(identifier[1], this.position + identifier.index);
      if (binding) references.add(binding);
    }
    return [...references];
  }

  supportedReferences() {
    if (this.supportedDirectSource()) return [];
    const expression = this.source.trim();
    const identifier = /^([A-Za-z_$][\w$]*)$/.exec(expression);
    if (identifier) {
      const binding = this.outline.resolve(identifier[1], this.position + this.source.indexOf(identifier[1]));
      return binding ? [binding] : [];
    }
    const member = /^([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)$/.exec(expression);
    if (member) {
      const owner = this.outline.resolve(member[1], this.position + this.source.indexOf(member[1]));
      return owner ? [owner.member(member[2])] : [];
    }
    if (this.supportedPathJoin()) return this.references();
    const helper = /^([A-Za-z_$][\w$]*)\s*\([\s\S]*\)$/.exec(expression);
    if (helper && this.simpleArguments(this.source.indexOf("("))) {
      const callable = this.outline.resolve(helper[1], this.position + this.source.indexOf(helper[1]));
      return callable ? [callable.returned()] : [];
    }
    return [];
  }

  unsupportedReferences() {
    const supported = new Set(this.supportedReferences());
    return this.references().filter((reference) => !supported.has(reference));
  }
}

class FlowPathAnalysis {
  constructor(source) {
    this.source = source;
    this.propagation = new FlowPropagation();
    this.outline = new LexicalOutline(source, this.propagation);
    this.mask = this.outline.mask;
    this.declareBindings();
    this.connectTransfers();
    this.propagation.run();
  }

  declareBindings() {
    for (const match of this.mask.matchAll(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
      this.outline.at(match.index).declarationOwner(match[1]).declare(match[2]);
    }
    for (const match of this.mask.matchAll(/\b(const|let|var)\s*\{([^}]+)\}\s*=/g)) {
      const scope = this.outline.at(match.index).declarationOwner(match[1]);
      for (const item of match[2].split(",")) {
        const [property, alias = property] = item.trim().split(/\s*:\s*/);
        if (/^[A-Za-z_$][\w$]*$/.test(alias)) scope.declare(alias);
      }
    }
    for (const scope of this.outline.scopes.filter((candidate) => candidate.kind === "function")) {
      for (const name of ["flowPath", "flowJsonPath", "flowStatePath"]) {
        scope.bindings.get(name)?.update(true, false);
      }
    }
  }

  connectTransfers() {
    for (const match of this.mask.matchAll(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
      const target = this.outline.at(match.index).declarationOwner(match[1]).bindings.get(match[2]);
      const start = match.index + match[0].indexOf("=") + 1;
      const expression = this.source.slice(start, match.index + match[0].length);
      if (!expression.trim().startsWith("{")) this.connectExpression(target, expression, start);
    }
    for (const match of this.mask.matchAll(
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^;}]+)\}/g,
    )) {
      const owner = this.outline.resolve(match[1], match.index);
      if (!owner) continue;
      const bodyStart = this.mask.indexOf("{", match.index) + 1;
      const body = this.mask.slice(bodyStart, match.index + match[0].length - 1);
      for (const property of body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([^,}]+)/g)) {
        const start = bodyStart + property.index + property[0].indexOf(":") + 1;
        const expression = this.source.slice(start, bodyStart + property.index + property[0].length);
        this.connectExpression(owner.member(property[1]), expression, start);
      }
    }
    for (const match of this.mask.matchAll(
      /\b(const|let|var)\s*\{([^}]+)\}\s*=\s*([A-Za-z_$][\w$]*)/g,
    )) {
      const scope = this.outline.at(match.index).declarationOwner(match[1]);
      const owner = this.outline.resolve(match[3], match.index);
      if (!owner) continue;
      for (const item of match[2].split(",")) {
        const [property, alias = property] = item.trim().split(/\s*:\s*/);
        if (/^[A-Za-z_$][\w$]*$/.test(property) && /^[A-Za-z_$][\w$]*$/.test(alias)) {
          this.propagation.connect(owner.member(property), scope.bindings.get(alias));
        }
      }
    }
    for (const match of this.mask.matchAll(/\breturn\s+([^;\n]+)/g)) {
      const scope = this.outline.at(match.index).nearestFunction();
      if (!scope?.callable) continue;
      const start = match.index + match[0].indexOf(match[1]);
      this.connectExpression(
        scope.callable.returned(),
        this.source.slice(start, match.index + match[0].length),
        start,
      );
    }
  }

  connectExpression(target, source, position) {
    if (!(target instanceof FlowFact)) return;
    const expression = new FlowExpression(source, position, this.outline);
    if (expression.supportedDirectSource()) target.update(true, false);
    else if (expression.containsDirectSource()) target.update(false, true);
    for (const reference of expression.supportedReferences()) {
      this.propagation.connect(reference, target);
    }
    for (const reference of expression.unsupportedReferences()) {
      this.propagation.connect(reference, target, true);
    }
  }

  matches(expressionSource, position) {
    const expression = new FlowExpression(expressionSource, position, this.outline);
    if (expression.supportedDirectSource()) return true;
    if (expression.containsDirectSource()) throw new Error(`unsupported flow expression at ${position}`);
    for (const reference of expression.unsupportedReferences()) {
      if (reference.supported || reference.unsupported) {
        throw new Error(`unsupported flow expression at ${position}`);
      }
    }
    for (const reference of expression.supportedReferences()) {
      if (reference.unsupported) throw new Error(`unsupported flow expression at ${position}`);
      if (reference.supported) return true;
    }
    return false;
  }
}

function expressionIsFlowPath(expression, analysis, position = 0) {
  return analysis.matches(expression, position);
}

function normalizedMemberExpression(expression) {
  return expression
    .trim()
    .replace(/\s+/g, "")
    .replace(/\[['"]([A-Za-z_$][\w$]*)['"]\]/g, ".$1");
}

function expressionIsSinkCapability(expression, state) {
  const normalized = normalizedMemberExpression(expression);
  const wrapper = /^(.*)\.(?:call|bind)\([^)]*\)$/.exec(normalized);
  if (wrapper) return expressionIsSinkCapability(wrapper[1], state);
  const invocationWrapper = /^(.*)\.(?:call|bind)$/.exec(normalized);
  if (invocationWrapper) return expressionIsSinkCapability(invocationWrapper[1], state);
  if (state.aliases.has(normalized) || state.properties.has(normalized)) return true;
  const member = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(normalized);
  if (
    member
    && state.namespaces.has(member[1])
    && sinkApis.has(member[2])
  ) return true;
  const promisesMember = /^([A-Za-z_$][\w$]*)\.promises\.([A-Za-z_$][\w$]*)$/.exec(normalized);
  return Boolean(
    promisesMember
    && state.namespaces.has(promisesMember[1])
    && sinkApis.has(promisesMember[2]),
  );
}

function collectSinkCapabilities(source) {
  const state = {
    aliases: new Set(),
    namespaces: new Set(),
    properties: new Set(),
  };
  for (const match of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]+\})?\s*from\s*["'](?:node:)?fs["']/g)) {
    state.namespaces.add(match[1]);
    state.namespaces.add(`${match[1]}.promises`);
  }
  for (const match of source.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*["'](?:node:)?fs["']/g)) {
    state.namespaces.add(match[1]);
    state.namespaces.add(`${match[1]}.promises`);
  }
  for (const match of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*["'](?:node:)?fs\/promises["']/g)) {
    state.namespaces.add(match[1]);
  }
  for (const match of source.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*["'](?:node:)?fs\/promises["']/g)) {
    state.namespaces.add(match[1]);
  }
  for (const match of source.matchAll(/import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]+)\}\s*from\s*["'](?:node:)?fs["']/g)) {
    for (const item of match[1].split(",")) {
      const parts = item.trim().split(/\s+as\s+/);
      if (sinkApis.has(parts[0])) state.aliases.add(parts[1] || parts[0]);
      if (parts[0] === "promises") state.namespaces.add(parts[1] || parts[0]);
    }
  }
  for (const match of source.matchAll(/import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]+)\}\s*from\s*["'](?:node:)?fs\/promises["']/g)) {
    for (const item of match[1].split(",")) {
      const parts = item.trim().split(/\s+as\s+/);
      if (sinkApis.has(parts[0])) state.aliases.add(parts[1] || parts[0]);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)\s*;/g)) {
      const namespace = normalizedMemberExpression(match[2]);
      if (state.namespaces.has(namespace) && !state.namespaces.has(match[1])) {
        state.namespaces.add(match[1]);
        changed = true;
      }
      if (expressionIsSinkCapability(match[2], state) && !state.aliases.has(match[1])) {
        state.aliases.add(match[1]);
        changed = true;
      }
    }
    for (const match of source.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)) {
      for (const item of match[1].split(",")) {
        const [property, alias = property] = item.trim().split(/\s*:\s*/);
        const fromNamespace = state.namespaces.has(match[2]) && sinkApis.has(property);
        const fromProperty = state.properties.has(`${match[2]}.${property}`);
        if (state.namespaces.has(match[2]) && property === "promises" && !state.namespaces.has(alias)) {
          state.namespaces.add(alias);
          changed = true;
        }
        if ((fromNamespace || fromProperty) && !state.aliases.has(alias)) {
          state.aliases.add(alias);
          changed = true;
        }
      }
    }
    for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^;}]+)\}/g)) {
      for (const property of match[2].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([^,}]+)/g)) {
        if (expressionIsSinkCapability(property[2], state)) {
          const key = `${match[1]}.${property[1]}`;
          if (!state.properties.has(key)) {
            state.properties.add(key);
            changed = true;
          }
        }
      }
    }
  }
  return state;
}

function analyzeFlowPaths(source) {
  return new FlowPathAnalysis(source);
}

class CallArgument {
  constructor(source, start, end) {
    if (typeof source !== "string" || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start < 0 || end < start || end > source.length) {
      throw new Error("invalid call argument");
    }
    this.source = source.slice(start, end);
    this.position = start;
    Object.freeze(this);
  }
}

function argumentSegmentsAt(source, openParen) {
  const argumentsFound = [];
  let index = openParen + 1;
  let start = index;
  let depth = 0;
  let quote = null;
  while (index < source.length) {
    const char = source[index];
    if (quote) {
      if (char === "\\") index += 2;
      else {
        if (char === quote) quote = null;
        index += 1;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      if (depth === 0) {
        argumentsFound.push(new CallArgument(source, start, index));
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      argumentsFound.push(new CallArgument(source, start, index));
      start = index + 1;
    }
    index += 1;
  }
  if (argumentsFound.length === 1 && argumentsFound[0].source.trim() === "") return [];
  return argumentsFound;
}

function argumentsAt(source, openParen) {
  return argumentSegmentsAt(source, openParen).map((argument) => argument.source);
}

function callExpressions(source) {
  return source.matchAll(
    /\b([A-Za-z_$][\w$]*(?:\s*(?:\.\s*[A-Za-z_$][\w$]*|\[\s*["'][A-Za-z_$][\w$]*["']\s*\]))*)\s*\(/g,
  );
}

function sinkCapabilityIdentities(state) {
  const identities = new Set([...state.aliases, ...state.properties]);
  for (const namespace of state.namespaces) {
    for (const api of sinkApis) identities.add(`${namespace}.${api}`);
  }
  return identities;
}

function unsupportedSinkCallee(expression, state) {
  if (expressionIsSinkCapability(expression, state)) return false;
  const normalized = normalizedMemberExpression(expression);
  for (const identity of sinkCapabilityIdentities(state)) {
    if (!normalized.startsWith(identity)) continue;
    const suffix = normalized.slice(identity.length);
    if (/^(?:\.|\[|\?\.)/.test(suffix)) return true;
  }
  const compact = expression.replace(/\s+/g, "");
  for (const namespace of state.namespaces) {
    if (!normalized.startsWith(namespace)) continue;
    const suffix = normalized.slice(namespace.length);
    if (/^\[(?!['"][A-Za-z_$][\w$]*['"]\])[^\]]+\]/.test(suffix)) return true;
    const optionalMember = /^\?\.([A-Za-z_$][\w$]*)/.exec(suffix);
    if (optionalMember && sinkApis.has(optionalMember[1])) return true;
    if (compact.startsWith(`${namespace}?.[`)) return true;
  }
  return false;
}

function assertNoUnsupportedSinkCallees(source, state) {
  const mask = lexicalMask(source);
  for (const pattern of [
    /\b([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\?\.\s*(?:[A-Za-z_$][\w$]*|\[[^\]\n]+\])(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\(/g,
    /\b([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\[[^\]\n]+\](?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\(/g,
  ]) {
    for (const match of mask.matchAll(pattern)) {
      const callee = source.slice(match.index, match.index + match[1].length);
      if (unsupportedSinkCallee(callee, state)) {
        throw new Error(`unsupported sink callee: ${callee.trim()}`);
      }
    }
  }
  for (const match of mask.matchAll(
    /\b([A-Za-z_$][\w$]*(?:\s*(?:\.\s*[A-Za-z_$][\w$]*|\[\s*["'][A-Za-z_$][\w$]*["']\s*\]))*)\s*\?\.\s*\(/g,
  )) {
    const callee = source.slice(match.index, match.index + match[1].length);
    if (expressionIsSinkCapability(callee, state) || unsupportedSinkCallee(callee, state)) {
      throw new Error(`unsupported sink callee: ${callee.trim()}?.`);
    }
  }
  for (const match of mask.matchAll(/\(\s*([^();\n]+)\s*\)\s*\(/g)) {
    const previousCode = mask.slice(0, match.index).match(/\S(?=\s*$)/)?.[0];
    if (previousCode && /[\w$\])]/.test(previousCode)) continue;
    const start = match.index + match[0].indexOf(match[1]);
    const callee = source.slice(start, start + match[1].length);
    if (expressionIsSinkCapability(callee, state) || unsupportedSinkCallee(callee, state)) {
      throw new Error(`unsupported sink callee: (${callee.trim()})`);
    }
  }
}

function callbackCapability(expression, capabilities) {
  const normalized = normalizedMemberExpression(expression);
  const direct = capabilities.get(normalized);
  if (direct) return direct;
  const bound = /^(.*)\.bind\((.*)\)$/.exec(normalized);
  if (bound) {
    const base = callbackCapability(bound[1], capabilities);
    if (!base) return null;
    const boundArguments = argumentsAt(`(${bound[2]})`, 0);
    return {
      callbackIndex: base.callbackIndex,
      pathArgumentIndex: Math.max(0, base.pathArgumentIndex - Math.max(0, boundArguments.length - 1)),
    };
  }
  const called = /^(.*)\.call$/.exec(normalized);
  if (called) {
    const base = callbackCapability(called[1], capabilities);
    return base && {
      callbackIndex: base.callbackIndex,
      pathArgumentIndex: base.pathArgumentIndex + 1,
    };
  }
  const binding = /^(.*)\.bind$/.exec(normalized);
  return binding ? callbackCapability(binding[1], capabilities) : null;
}

function callbackBridges(source) {
  const bridges = [];
  const collect = (name, parameters, body) => {
    const capabilities = new Map(parameters.map((parameter, callbackIndex) => [
      parameter,
      { callbackIndex, pathArgumentIndex: 0 },
    ]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const assignment of body.matchAll(
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+)\s*;/g,
      )) {
        const capability = callbackCapability(assignment[2], capabilities);
        if (capability && !capabilities.has(assignment[1])) {
          capabilities.set(assignment[1], capability);
          changed = true;
        }
      }
    }
    for (const call of callExpressions(body)) {
      const capability = callbackCapability(call[1], capabilities);
      if (!capability) continue;
      const openParen = call.index + call[0].lastIndexOf("(");
      const calledArguments = argumentsAt(body, openParen);
      for (let pathIndex = 0; pathIndex < parameters.length; pathIndex += 1) {
        if (pathIndex === capability.callbackIndex) continue;
        if (identifierAppears(calledArguments[capability.pathArgumentIndex] || "", parameters[pathIndex])) {
          bridges.push({ name, callbackIndex: capability.callbackIndex, pathIndex });
        }
      }
    }
  };
  const functions = balancedBlocks(
    source,
    /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
  );
  for (const block of functions) {
    const header = /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/.exec(block.header);
    if (!header) continue;
    const parameters = header[2].split(",").map((parameter) => parameter.trim());
    collect(header[1], parameters, block.body);
  }
  const blockArrows = balancedBlocks(
    source,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*\{/g,
  );
  for (const block of blockArrows) {
    const header = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(([^)]*)\)/.exec(block.header);
    if (!header) continue;
    collect(
      header[1],
      header[2].split(",").map((parameter) => parameter.trim()),
      block.body,
    );
  }
  for (const arrow of source.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*([^;\n]+)/g,
  )) {
    if (arrow[3].trim().startsWith("{")) continue;
    collect(arrow[1], arrow[2].split(",").map((parameter) => parameter.trim()), arrow[3]);
  }
  return bridges;
}

function directFlowStateSinks(filePath) {
  if (allowedSinkOwners.has(path.resolve(filePath))) return [];
  const source = fs.readFileSync(filePath, "utf8");
  const paths = analyzeFlowPaths(source);
  const capabilities = collectSinkCapabilities(source);
  assertNoUnsupportedSinkCallees(source, capabilities);
  const findings = [];
  for (const match of callExpressions(source)) {
    if (!expressionIsSinkCapability(match[1], capabilities)) {
      if (unsupportedSinkCallee(match[1], capabilities)) {
        throw new Error(`unsupported sink callee: ${match[1].trim()}`);
      }
      continue;
    }
    const openParen = match.index + match[0].lastIndexOf("(");
    const calledArguments = argumentSegmentsAt(source, openParen);
    const argumentIndex = /\.call$/.test(normalizedMemberExpression(match[1])) ? 1 : 0;
    const argument = calledArguments[argumentIndex];
    if (argument && expressionIsFlowPath(argument.source, paths, argument.position)) {
      findings.push(`${path.relative(repoRoot, filePath)}: ${normalizedMemberExpression(match[1])}(${argument.source.trim()}`);
    }
  }
  for (const match of source.matchAll(/\bReflect\s*\.\s*apply\s*\(/g)) {
    const openParen = match.index + match[0].lastIndexOf("(");
    const [capability, , argumentList] = argumentSegmentsAt(source, openParen);
    const trimmedList = argumentList?.source.trim() || "";
    if (!capability || !expressionIsSinkCapability(capability.source, capabilities)) continue;
    if (!trimmedList.startsWith("[") || !trimmedList.endsWith("]")) continue;
    const listOpen = argumentList.position + argumentList.source.indexOf("[");
    const [argument] = argumentSegmentsAt(source, listOpen);
    if (argument && expressionIsFlowPath(argument.source, paths, argument.position)) {
      findings.push(`${path.relative(repoRoot, filePath)}: Reflect.apply(${capability.source.trim()}, ${argument.source.trim()}`);
    }
  }
  const bridges = callbackBridges(source);
  for (const match of callExpressions(source)) {
    const callee = normalizedMemberExpression(match[1]);
    for (const bridge of bridges.filter(({ name }) => name === callee)) {
      const openParen = match.index + match[0].lastIndexOf("(");
      const callArgumentsFound = argumentSegmentsAt(source, openParen);
      const capability = callArgumentsFound[bridge.callbackIndex];
      const pathArgument = callArgumentsFound[bridge.pathIndex];
      if (
        capability
        && pathArgument
        && expressionIsSinkCapability(capability.source, capabilities)
        && expressionIsFlowPath(pathArgument.source, paths, pathArgument.position)
      ) {
        findings.push(`${path.relative(repoRoot, filePath)}: ${callee}(sink capability, flow path)`);
      }
    }
  }
  return [...new Set(findings)];
}

test("scanner detects indirect aliases, properties, destructuring, streams, and append sinks", () => {
  const tmp = createTmpDir("flow-sink-adversarial-");
  try {
    const fixture = path.join(tmp, "adversarial.js");
    fs.writeFileSync(fixture, `
      import fs, { appendFileSync as append, createWriteStream as stream } from "node:fs";
      import { flowStatePath } from "${allowedOwner}";
      function helper(root, id) { return flowStatePath(root, id); }
      const direct = helper(root, id);
      const alias = direct;
      const holder = { target: alias };
      const { target } = holder;
      fs.writeFileSync(target, "one");
      const writer = fs.writeFileSync;
      writer(holder.target, "two");
      append(target, "three");
      stream(target).write("four");
      function indirect(flowJsonPath) { append(flowJsonPath, "five"); }
      const { writeFileSync: persist } = fs;
      const computedName = ["flow", "json"].join(".");
      function computedTarget(base, specId) {
        return path.join(base, "specs", specId, computedName);
      }
      const computedPath = computedTarget(root, id);
      persist(computedPath, "six");
      const methods = { sink: fs.writeFileSync };
      const { sink: indirectSink } = methods;
      indirectSink(computedTarget(root, id), "seven");
    `);
    const findings = directFlowStateSinks(fixture);
    for (const sink of ["writeFileSync", "writer", "append", "stream", "persist", "indirectSink"]) {
      assert.ok(findings.some((finding) => finding.includes(sink)), `missing ${sink}: ${findings.join("\n")}`);
    }
  } finally {
    removeTmpDir(tmp);
  }
});

test("scanner separates same-named path bindings in sibling functions", () => {
  const tmp = createTmpDir("flow-sink-sibling-bindings-");
  try {
    const fixture = path.join(tmp, "sibling-bindings.js");
    fs.writeFileSync(fixture, `
      import fs from "node:fs";
      import { flowStatePath } from "${allowedOwner}";
      function persistFlow() {
        const destination = flowStatePath(root, id);
        fs.writeFileSync(destination, "flow");
      }
      function persistReport() {
        const destination = "/tmp/report.json";
        fs.appendFileSync(destination, "report");
      }
      persistFlow();
      persistReport();
    `);
    const findings = directFlowStateSinks(fixture);
    assert.equal(findings.length, 1, findings.join("\n"));
    assert.ok(findings[0].includes("writeFileSync"), findings.join("\n"));
  } finally {
    removeTmpDir(tmp);
  }
});

test("scanner resolves a shadowed block binding before its parent", () => {
  const tmp = createTmpDir("flow-sink-block-binding-");
  try {
    const fixture = path.join(tmp, "block-binding.js");
    fs.writeFileSync(fixture, `
      import fs from "node:fs";
      import { flowStatePath } from "${allowedOwner}";
      const destination = flowStatePath(root, id);
      fs.writeFileSync(destination, "flow");
      {
        const destination = "/tmp/report.json";
        fs.appendFileSync(destination, "report");
      }
    `);
    const findings = directFlowStateSinks(fixture);
    assert.equal(findings.length, 1, findings.join("\n"));
    assert.ok(findings[0].includes("writeFileSync"), findings.join("\n"));
  } finally {
    removeTmpDir(tmp);
  }
});

test("scanner follows a flow-path binding captured by a closure", () => {
  const tmp = createTmpDir("flow-sink-closure-binding-");
  try {
    const fixture = path.join(tmp, "closure-binding.js");
    fs.writeFileSync(fixture, `
      import fs from "node:fs";
      import { flowStatePath } from "${allowedOwner}";
      function persistFlow() {
        const destination = flowStatePath(root, id);
        function persistCaptured() {
          fs.copyFileSync(destination, "/tmp/captured-flow.json");
        }
        persistCaptured();
      }
      persistFlow();
    `);
    const findings = directFlowStateSinks(fixture);
    assert.equal(findings.length, 1, findings.join("\n"));
    assert.ok(findings[0].includes("copyFileSync"), findings.join("\n"));
  } finally {
    removeTmpDir(tmp);
  }
});

const capabilityFixtures = new Map([
  ["reflect-apply", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    Reflect.apply(fs.writeFileSync, fs, [target, "reflect"]);
  `],
  ["namespace-alias", `
    import * as io from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    io.writeFileSync(target, "namespace");
  `],
  ["computed-property", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    fs["writeFileSync"](target, "computed");
  `],
  ["callback-reference", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    function invoke(callback, output) { callback(output, "callback"); }
    invoke(fs.writeFileSync, target);
  `],
  ["promises-member", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    await fs.promises.writeFile(target, "promises");
  `],
  ["promises-named-import", `
    import { writeFile as persist } from "node:fs/promises";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    await persist(target, "named promises");
  `],
  ["promises-object-named-import", `
    import { promises as fsp } from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    await fsp.writeFile(flowStatePath(root, id), "named promises object");
  `],
  ["promises-object-destructuring", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const { promises: fsp } = fs;
    await fsp.writeFile(flowStatePath(root, id), "destructured promises object");
  `],
  ["promises-namespace-alias", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const promises = fs.promises;
    await promises.writeFile(target, "aliased promises");
  `],
  ["promises-default-import", `
    import promises from "node:fs/promises";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    await promises.writeFile(target, "default promises");
  `],
  ["promises-namespace-import", `
    import * as promises from "node:fs/promises";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    await promises.writeFile(target, "namespace promises");
  `],
  ["namespace-reassignment", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const io = fs;
    io.writeFileSync(target, "namespace alias");
  `],
  ["function-call", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    fs.writeFileSync.call(fs, target, "call");
  `],
  ["bound-capability", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const persist = fs.writeFileSync.bind(fs);
    persist(target, "bind");
  `],
  ["arrow-callback-reference", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const invoke = (callback, output) => callback(output, "callback");
    invoke(fs.writeFileSync, target);
  `],
  ["multiline-block-arrow-callback", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const invoke = (callback, output) => {
      callback(output, "multiline");
    };
    invoke(fs.writeFileSync, target);
  `],
  ["async-arrow-promises-call", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const invoke = async (callback, output) => {
      await callback.call(null, output, "async-call");
    };
    await invoke(fs.promises.writeFile, target);
  `],
  ["multiline-bound-callback-alias", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const invoke = (callback, output) => {
      const persist = callback.bind(null);
      persist(output, "bound-alias");
    };
    invoke(fs.writeFileSync, target);
  `],
  ["async-promises-call-bind-alias", `
    import fs from "node:fs";
    import { flowStatePath } from "${allowedOwner}";
    const target = flowStatePath(root, id);
    const invoke = async (callback, output) => {
      const persist = callback.call.bind(callback, null);
      await persist(output, "call-bind-alias");
    };
    await invoke(fs.promises.writeFile, target);
  `],
]);

for (const [label, source] of capabilityFixtures) {
  test(`scanner detects ${label} sink capability`, () => {
    const tmp = createTmpDir("flow-sink-capability-adversarial-");
    try {
      const fixture = path.join(tmp, `${label}.js`);
      fs.writeFileSync(fixture, source);
      const findings = directFlowStateSinks(fixture);
      assert.ok(findings.length > 0, `${label} bypassed scanner`);
    } finally {
      removeTmpDir(tmp);
    }
  });
}

test("flow state path ownership and every source write sink stay in the canonical state owner", () => {
  const files = sourceFiles(srcRoot);
  const findings = files.flatMap(directFlowStateSinks);
  assert.deepEqual(findings, [], `direct flow.json sinks:\n${findings.join("\n")}`);
  const foreignDefinitions = files.filter((filePath) => {
    if (filePath === allowedOwner) return false;
    const source = fs.readFileSync(filePath, "utf8");
    return /export\s+(?:const\s+STATE_FILE|function\s+flowStatePath)\b/.test(source);
  });
  assert.deepEqual(foreignDefinitions, [], "flow state path authority must have one owner");
});

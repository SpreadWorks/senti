import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const srcRoot = path.join(repoRoot, "src");
const allowedOwner = path.join(srcRoot, "lib", "flow-state-atomic-writer.js");
const allowedSinkOwners = new Set([
  allowedOwner,
  path.join(srcRoot, "lib", "flow-store.js"),
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

function propertyAppears(expression, property) {
  return expression.includes(property);
}

function expressionIsFlowPath(expression, state) {
  if (/['"`]flow\.json['"`]/.test(expression)) return true;
  if (/\[\s*['"`]flow['"`]\s*,\s*['"`]json['"`]\s*\]\.join\(\s*['"`]\.['"`]\s*\)/.test(expression)) return true;
  if (/\bSTATE_FILE\b/.test(expression)) return true;
  if (/\bflowStatePath\s*\(/.test(expression)) return true;
  for (const name of state.returningFunctions) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(expression)) return true;
  }
  for (const name of state.variables) {
    if (identifierAppears(expression, name)) return true;
  }
  for (const property of state.properties) {
    if (propertyAppears(expression, property)) return true;
  }
  return false;
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
  const state = {
    variables: new Set(),
    properties: new Set(),
    returningFunctions: new Set(),
  };
  const functions = balancedBlocks(
    source,
    /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
  );
  for (const match of source.matchAll(/\b(?:flowPath|flowJsonPath|flowStatePath)\b/g)) {
    const after = source.slice(match.index + match[0].length).match(/^\s*\(/);
    if (!after) state.variables.add(match[0]);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of functions) {
      const name = /function\s+([A-Za-z_$][\w$]*)/.exec(block.header)?.[1];
      for (const returned of block.body.matchAll(/\breturn\s+([^;\n]+)/g)) {
        if (name && expressionIsFlowPath(returned[1], state) && !state.returningFunctions.has(name)) {
          state.returningFunctions.add(name);
          changed = true;
        }
      }
    }
    for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
      if (expressionIsFlowPath(match[2], state) && !state.variables.has(match[1])) {
        state.variables.add(match[1]);
        changed = true;
      }
    }
    for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^;}]+)\}/g)) {
      for (const property of match[2].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([^,}]+)/g)) {
        if (expressionIsFlowPath(property[2], state)) {
          const key = `${match[1]}.${property[1]}`;
          if (!state.properties.has(key)) {
            state.properties.add(key);
            changed = true;
          }
        }
      }
    }
    for (const match of source.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*([A-Za-z_$][\w$]*)/g)) {
      for (const item of match[1].split(",")) {
        const [property, alias = property] = item.trim().split(/\s*:\s*/);
        if (
          state.properties.has(`${match[2]}.${property}`)
          && !state.variables.has(alias)
        ) {
          state.variables.add(alias);
          changed = true;
        }
      }
    }
    for (const match of source.matchAll(/\b([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
      if (expressionIsFlowPath(match[2], state) && !state.properties.has(match[1])) {
        state.properties.add(match[1]);
        changed = true;
      }
    }
  }
  return state;
}

function argumentsAt(source, openParen) {
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
        argumentsFound.push(source.slice(start, index));
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      argumentsFound.push(source.slice(start, index));
      start = index + 1;
    }
    index += 1;
  }
  if (argumentsFound.length === 1 && argumentsFound[0].trim() === "") return [];
  return argumentsFound;
}

function callExpressions(source) {
  return source.matchAll(
    /\b([A-Za-z_$][\w$]*(?:\s*(?:\.\s*[A-Za-z_$][\w$]*|\[\s*["'][A-Za-z_$][\w$]*["']\s*\]))*)\s*\(/g,
  );
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
  const findings = [];
  for (const match of callExpressions(source)) {
    if (!expressionIsSinkCapability(match[1], capabilities)) continue;
    const openParen = match.index + match[0].lastIndexOf("(");
    const calledArguments = argumentsAt(source, openParen);
    const argumentIndex = /\.call$/.test(normalizedMemberExpression(match[1])) ? 1 : 0;
    const argument = calledArguments[argumentIndex] || "";
    if (expressionIsFlowPath(argument, paths)) {
      findings.push(`${path.relative(repoRoot, filePath)}: ${normalizedMemberExpression(match[1])}(${argument.trim()}`);
    }
  }
  for (const match of source.matchAll(/\bReflect\s*\.\s*apply\s*\(/g)) {
    const openParen = match.index + match[0].lastIndexOf("(");
    const [capability = "", , argumentList = ""] = argumentsAt(source, openParen);
    const trimmedList = argumentList.trim();
    if (!expressionIsSinkCapability(capability, capabilities)) continue;
    if (!trimmedList.startsWith("[") || !trimmedList.endsWith("]")) continue;
    const [argument = ""] = argumentsAt(`(${trimmedList.slice(1, -1)})`, 0);
    if (expressionIsFlowPath(argument, paths)) {
      findings.push(`${path.relative(repoRoot, filePath)}: Reflect.apply(${capability.trim()}, ${argument.trim()}`);
    }
  }
  const bridges = callbackBridges(source);
  for (const match of callExpressions(source)) {
    const callee = normalizedMemberExpression(match[1]);
    for (const bridge of bridges.filter(({ name }) => name === callee)) {
      const openParen = match.index + match[0].lastIndexOf("(");
      const callArgumentsFound = argumentsAt(source, openParen);
      if (
        expressionIsSinkCapability(callArgumentsFound[bridge.callbackIndex] || "", capabilities)
        && expressionIsFlowPath(callArgumentsFound[bridge.pathIndex] || "", paths)
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

test("flow state path ownership and every source write sink stay in the shared writer", () => {
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

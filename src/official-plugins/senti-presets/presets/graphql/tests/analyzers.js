/**
 * Directory-level analyzers for GraphQL preset tests.
 *
 * These helpers are used only by unit tests. They were previously
 * exported from data/*.js modules but have been relocated here so
 * that preset data/ files do not import senti internals
 * (spec 191: preset DI container).
 */

import fs from "fs";
import { collectFiles } from "../../../docs/lib/scanner.js";

/** Match type definitions: type Foo implements Bar { ... } */
const TYPE_RE = /type\s+(\w+)\s*(?:implements\s+([\w\s&]+))?\s*\{([^}]*)\}/g;

/** Match fields inside a type: name(args): ReturnType */
const FIELD_RE = /(\w+)\s*(?:\([^)]*\))?\s*:\s*([^\n]+)/g;

/** Match field with args for query/mutation: name(arg: Type, ...): ReturnType */
const FIELD_ARGS_RE = /(\w+)\s*(?:\(([^)]*)\))?\s*:\s*([^\n]+)/g;

/**
 * Parse a single GraphQL schema content string.
 *
 * @param {string} content - raw .graphql/.gql file content
 * @returns {{ types: Object[], queries: Object[], mutations: Object[] }}
 */
export function parseSchemaContent(content) {
  const types = [];
  const queries = [];
  const mutations = [];

  for (const m of content.matchAll(TYPE_RE)) {
    const typeName = m[1];
    const implementsClause = m[2] ? m[2].trim() : null;
    const body = m[3];

    if (typeName === "Query") {
      for (const fm of body.matchAll(FIELD_ARGS_RE)) {
        queries.push({
          name: fm[1],
          args: fm[2] ? fm[2].trim() : "\u2014",
          returnType: fm[3].trim(),
        });
      }
    } else if (typeName === "Mutation") {
      for (const fm of body.matchAll(FIELD_ARGS_RE)) {
        mutations.push({
          name: fm[1],
          args: fm[2] ? fm[2].trim() : "\u2014",
          returnType: fm[3].trim(),
        });
      }
    } else {
      const fields = [];
      for (const fm of body.matchAll(FIELD_RE)) {
        fields.push(fm[1]);
      }
      const entry = { name: typeName, fields };
      if (implementsClause) {
        entry.implements = implementsClause.split("&").map((s) => s.trim());
      }
      types.push(entry);
    }
  }

  return { types, queries, mutations };
}

/**
 * Scan sourceRoot for .graphql/.gql files and extract schema information.
 *
 * @param {string} sourceRoot - project root directory
 * @returns {{ types: Object[], queries: Object[], mutations: Object[], summary: Object }}
 */
export function analyzeSchema(sourceRoot) {
  const files = collectFiles(sourceRoot, ["**/*.graphql", "**/*.gql"], ["node_modules/**"]);

  if (files.length === 0) {
    return {
      types: [],
      queries: [],
      mutations: [],
      summary: { totalTypes: 0, totalQueries: 0, totalMutations: 0 },
    };
  }

  const allTypes = [];
  const allQueries = [];
  const allMutations = [];

  for (const f of files) {
    const content = fs.readFileSync(f.absPath, "utf8");
    const result = parseSchemaContent(content);
    allTypes.push(...result.types);
    allQueries.push(...result.queries);
    allMutations.push(...result.mutations);
  }

  return {
    types: allTypes,
    queries: allQueries,
    mutations: allMutations,
    summary: {
      totalTypes: allTypes.length,
      totalQueries: allQueries.length,
      totalMutations: allMutations.length,
    },
  };
}

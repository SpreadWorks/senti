/**
 * GraphqlSchemaSource — Scannable DataSource for GraphQL schema.
 *
 * Scans .graphql/.gql files to extract type definitions,
 * queries, and mutations via regex.
 *
 * Available methods:
 *   schema.types("Type|Fields|Description")
 *   schema.queries("Query|Args|Return|Description")
 *   schema.mutations("Mutation|Args|Return|Description")
 */

import fs from "fs";

/** Match type definitions: type Foo implements Bar { ... } */
const TYPE_RE = /type\s+(\w+)\s*(?:implements\s+([\w\s&]+))?\s*\{([^}]*)\}/g;

/** Match fields inside a type: name(args): ReturnType */
const FIELD_RE = /(\w+)\s*(?:\([^)]*\))?\s*:\s*([^\n]+)/g;

/** Match field with args for query/mutation: name(arg: Type, ...): ReturnType */
const FIELD_ARGS_RE = /(\w+)\s*(?:\(([^)]*)\))?\s*:\s*([^\n]+)/g;

/**
 * Parse a single GraphQL schema content string.
 */
function parseSchemaContent(content) {
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

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");

  class GraphqlSchemaEntry extends AnalysisEntry {
    types = null;
    queries = null;
    mutations = null;

    static summary = {};
  }

  class GraphqlSchemaSource extends Scannable(DataSource) {
    static Entry = GraphqlSchemaEntry;

    match(relPath) {
      return /\.(?:graphql|gql)$/.test(relPath);
    }

    parse(absPath) {
      const entry = new GraphqlSchemaEntry();
      const content = fs.readFileSync(absPath, "utf8");
      const result = parseSchemaContent(content);
      entry.types = result.types;
      entry.queries = result.queries;
      entry.mutations = result.mutations;
      return entry;
    }

    /** GraphQL types table. */
    types(analysis, labels) {
      const entries = analysis.schema?.entries || [];
      const items = entries.flatMap((e) => e.types || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (t) => [
        t.name,
        Array.isArray(t.fields) ? t.fields.join(", ") : (t.fields || "—"),
        t.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Type", "Fields", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** GraphQL queries table. */
    queries(analysis, labels) {
      const entries = analysis.schema?.entries || [];
      const items = entries.flatMap((e) => e.queries || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (q) => [
        q.name,
        q.args || "—",
        q.returnType || "—",
        q.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Query", "Args", "Return", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** GraphQL mutations table. */
    mutations(analysis, labels) {
      const entries = analysis.schema?.entries || [];
      const items = entries.flatMap((e) => e.mutations || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (m) => [
        m.name,
        m.args || "—",
        m.returnType || "—",
        m.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Mutation", "Args", "Return", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return GraphqlSchemaSource;
}

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import { analyzeSchema, parseSchemaContent } from "../analyzers.js";

describe("GraphQL analyzeSchema — basic type parsing", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses a simple type with fields", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type User {
  id: ID!
  name: String!
  email: String
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types.length, 1);
    assert.equal(result.types[0].name, "User");
    assert.deepEqual(result.types[0].fields, ["id", "name", "email"]);
    assert.equal(result.summary.totalTypes, 1);
  });

  it("parses multiple types", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type User {
  id: ID!
  name: String!
}

type Post {
  id: ID!
  title: String!
  body: String
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types.length, 2);
    assert.equal(result.types[0].name, "User");
    assert.equal(result.types[1].name, "Post");
    assert.equal(result.summary.totalTypes, 2);
  });
});

describe("GraphQL analyzeSchema — Query and Mutation parsing", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses Query fields with args and return types", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.queries.length, 2);
    assert.equal(result.queries[0].name, "user");
    assert.equal(result.queries[0].args, "id: ID!");
    assert.equal(result.queries[0].returnType, "User");
    assert.equal(result.queries[1].name, "users");
    assert.equal(result.queries[1].args, "limit: Int, offset: Int");
    assert.equal(result.queries[1].returnType, "[User!]!");
    assert.equal(result.summary.totalQueries, 2);
  });

  it("parses Mutation fields with args and return types", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type Mutation {
  createUser(name: String!, email: String!): User!
  deleteUser(id: ID!): Boolean!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.mutations.length, 2);
    assert.equal(result.mutations[0].name, "createUser");
    assert.equal(result.mutations[0].args, "name: String!, email: String!");
    assert.equal(result.mutations[0].returnType, "User!");
    assert.equal(result.mutations[1].name, "deleteUser");
    assert.equal(result.mutations[1].args, "id: ID!");
    assert.equal(result.mutations[1].returnType, "Boolean!");
    assert.equal(result.summary.totalMutations, 2);
  });

  it("handles query without args", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type Query {
  allUsers: [User!]!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.queries.length, 1);
    assert.equal(result.queries[0].name, "allUsers");
    assert.equal(result.queries[0].args, "\u2014");
    assert.equal(result.queries[0].returnType, "[User!]!");
  });
});

describe("GraphQL analyzeSchema — implements interface", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses type implementing a single interface", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type User implements Node {
  id: ID!
  name: String!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types.length, 1);
    assert.equal(result.types[0].name, "User");
    assert.deepEqual(result.types[0].implements, ["Node"]);
    assert.deepEqual(result.types[0].fields, ["id", "name"]);
  });

  it("parses type implementing multiple interfaces", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type User implements Node & Timestamped {
  id: ID!
  name: String!
  createdAt: DateTime!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types.length, 1);
    assert.deepEqual(result.types[0].implements, ["Node", "Timestamped"]);
  });

  it("does not add implements for types without interface", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
type Post {
  id: ID!
  title: String!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types[0].implements, undefined);
  });
});

describe("GraphQL analyzeSchema — multiple files", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("aggregates types, queries, mutations from multiple files", () => {
    tmp = createTmpDir();
    writeFile(tmp, "types.graphql", `
type User {
  id: ID!
  name: String!
}
`);
    writeFile(tmp, "queries.gql", `
type Query {
  user(id: ID!): User
}
`);
    writeFile(tmp, "mutations.graphql", `
type Mutation {
  createUser(name: String!): User!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types.length, 1);
    assert.equal(result.queries.length, 1);
    assert.equal(result.mutations.length, 1);
    assert.equal(result.summary.totalTypes, 1);
    assert.equal(result.summary.totalQueries, 1);
    assert.equal(result.summary.totalMutations, 1);
  });

  it("reads .gql extension", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.gql", `
type Product {
  id: ID!
  price: Float!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types.length, 1);
    assert.equal(result.types[0].name, "Product");
  });

  it("scans files in subdirectories", () => {
    tmp = createTmpDir();
    writeFile(tmp, "graphql/user/types.graphql", `
type User {
  id: ID!
}
`);
    writeFile(tmp, "graphql/post/types.graphql", `
type Post {
  id: ID!
}
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.types.length, 2);
  });
});

describe("GraphQL analyzeSchema — empty/missing schema files", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty result when no schema files exist", () => {
    tmp = createTmpDir();
    const result = analyzeSchema(tmp);
    assert.deepEqual(result.types, []);
    assert.deepEqual(result.queries, []);
    assert.deepEqual(result.mutations, []);
    assert.equal(result.summary.totalTypes, 0);
    assert.equal(result.summary.totalQueries, 0);
    assert.equal(result.summary.totalMutations, 0);
  });

  it("handles empty schema file", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", "");
    const result = analyzeSchema(tmp);
    assert.deepEqual(result.types, []);
    assert.deepEqual(result.queries, []);
    assert.deepEqual(result.mutations, []);
  });

  it("handles schema file with only comments", () => {
    tmp = createTmpDir();
    writeFile(tmp, "schema.graphql", `
# This is a comment
# Another comment
`);
    const result = analyzeSchema(tmp);
    assert.deepEqual(result.types, []);
  });
});

describe("GraphQL parseSchemaContent — unit tests", () => {
  it("parses a complete schema", () => {
    const content = `
type User implements Node {
  id: ID!
  name: String!
  email: String
}

type Query {
  user(id: ID!): User
  users: [User!]!
}

type Mutation {
  createUser(name: String!, email: String!): User!
}
`;
    const result = parseSchemaContent(content);
    assert.equal(result.types.length, 1);
    assert.equal(result.types[0].name, "User");
    assert.deepEqual(result.types[0].implements, ["Node"]);
    assert.deepEqual(result.types[0].fields, ["id", "name", "email"]);
    assert.equal(result.queries.length, 2);
    assert.equal(result.mutations.length, 1);
  });
});

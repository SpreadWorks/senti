import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import { analyzeSchema } from "../analyzers.js";

describe("Drizzle analyzeSchema — pgTable", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses basic pgTable with columns", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/db/schema.ts", `
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalTables, 1);
    assert.equal(result.summary.totalRelations, 0);
    assert.equal(result.tables[0].name, "users");
    assert.equal(result.tables[0].varName, "users");
    assert.deepEqual(result.tables[0].columns, ["id", "name", "email", "createdAt"]);
    assert.equal(result.files[0].tables, "users");
  });

  it("parses multiple tables in one file", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/db/schema.ts", `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title"),
  authorId: integer("author_id"),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  body: text("body"),
  postId: integer("post_id"),
});
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalTables, 3);
    assert.equal(result.tables[0].name, "users");
    assert.equal(result.tables[1].name, "posts");
    assert.equal(result.tables[2].name, "comments");
    assert.equal(result.files[0].tables, "users, posts, comments");
  });
});

describe("Drizzle analyzeSchema — relations", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses relation definitions", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/db/schema.ts", `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalRelations, 2);
    assert.equal(result.relations[0].from, "users");
    assert.equal(result.relations[0].name, "usersRelations");
    assert.equal(result.relations[1].from, "posts");
    assert.equal(result.relations[1].name, "postsRelations");
  });
});

describe("Drizzle analyzeSchema — sqliteTable", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses sqliteTable variant", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/db/schema.ts", `
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }),
});
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalTables, 1);
    assert.equal(result.tables[0].name, "todos");
    assert.equal(result.tables[0].varName, "todos");
    assert.deepEqual(result.tables[0].columns, ["id", "title", "completed"]);
  });
});

describe("Drizzle analyzeSchema — mysqlTable", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("parses mysqlTable variant", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/db/schema.ts", `
import { mysqlTable, serial, varchar, int } from "drizzle-orm/mysql-core";

export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  price: int("price"),
});
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalTables, 1);
    assert.equal(result.tables[0].name, "products");
    assert.deepEqual(result.tables[0].columns, ["id", "name", "price"]);
  });
});

describe("Drizzle analyzeSchema — empty/missing", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty when no schema files exist", () => {
    tmp = createTmpDir();
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalTables, 0);
    assert.equal(result.summary.totalRelations, 0);
    assert.deepEqual(result.tables, []);
    assert.deepEqual(result.relations, []);
    assert.deepEqual(result.files, []);
  });

  it("returns empty for schema file with no table definitions", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/db/schema.ts", `
import { pgTable } from "drizzle-orm/pg-core";
// No tables defined yet
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalTables, 0);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].tables, "\u2014");
  });
});

describe("Drizzle analyzeSchema — schema directory", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("collects files from schema/ subdirectory", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/db/schema/users.ts", `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
`);
    writeFile(tmp, "src/db/schema/posts.ts", `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title"),
  authorId: integer("author_id"),
});
`);
    const result = analyzeSchema(tmp);
    assert.equal(result.summary.totalTables, 2);
    assert.equal(result.files.length, 2);
    const tableNames = result.tables.map((t) => t.name);
    assert.ok(tableNames.includes("users"));
    assert.ok(tableNames.includes("posts"));
  });

  it("picks up drizzle.config.ts at project root", () => {
    tmp = createTmpDir();
    writeFile(tmp, "drizzle.config.ts", `
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  driver: "pg",
} satisfies Config;
`);
    const result = analyzeSchema(tmp);
    // Config file is collected but has no table definitions
    assert.equal(result.files.length, 1);
    assert.match(result.files[0].relPath, /drizzle\.config\.ts/);
    assert.equal(result.summary.totalTables, 0);
  });
});

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeFile } from "../../../../../tests/helpers/tmp-dir.js";
import { analyzeComponents, analyzeRoutes } from "../analyzers.js";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

describe("Next.js analyzeComponents", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("classifies server component (default)", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/dashboard/page.tsx", `export default function Dashboard() {
  return <div>Dashboard</div>;
}
`);
    const result = analyzeComponents(tmp);
    assert.equal(result.summary.total, 1);
    assert.equal(result.summary.server, 1);
    assert.equal(result.components[0].name, "page");
    assert.equal(result.components[0].type, "server");
  });

  it("classifies client component with 'use client'", () => {
    tmp = createTmpDir();
    writeFile(tmp, "components/Counter.tsx", `'use client'

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
`);
    const result = analyzeComponents(tmp);
    assert.equal(result.summary.total, 1);
    assert.equal(result.summary.client, 1);
    assert.equal(result.components[0].name, "Counter");
    assert.equal(result.components[0].type, "client");
  });

  it("classifies client component with double-quoted 'use client'", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/components/Modal.jsx", `"use client"

export default function Modal() {
  return <dialog>Modal</dialog>;
}
`);
    const result = analyzeComponents(tmp);
    assert.equal(result.summary.client, 1);
    assert.equal(result.components[0].type, "client");
  });

  it("classifies shared component in /shared/ directory", () => {
    tmp = createTmpDir();
    writeFile(tmp, "components/shared/Button.tsx", `export default function Button({ children }) {
  return <button>{children}</button>;
}
`);
    const result = analyzeComponents(tmp);
    assert.equal(result.summary.total, 1);
    assert.equal(result.summary.shared, 1);
    assert.equal(result.components[0].name, "Button");
    assert.equal(result.components[0].type, "shared");
  });

  it("classifies shared component in /common/ directory", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/components/common/Input.tsx", `export default function Input() {
  return <input />;
}
`);
    const result = analyzeComponents(tmp);
    assert.equal(result.summary.shared, 1);
    assert.equal(result.components[0].type, "shared");
  });

  it("returns empty for project with no components", () => {
    tmp = createTmpDir();
    const result = analyzeComponents(tmp);
    assert.equal(result.summary.total, 0);
    assert.equal(result.summary.server, 0);
    assert.equal(result.summary.client, 0);
    assert.equal(result.summary.shared, 0);
    assert.deepEqual(result.components, []);
  });

  it("scans multiple directories", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/layout.tsx", `export default function Layout({ children }) {
  return <html><body>{children}</body></html>;
}
`);
    writeFile(tmp, "src/components/Header.tsx", `'use client'
export default function Header() { return <header />; }
`);
    const result = analyzeComponents(tmp);
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.server, 1);
    assert.equal(result.summary.client, 1);
  });
});

// ---------------------------------------------------------------------------
// Routes — App Router
// ---------------------------------------------------------------------------

describe("Next.js analyzeRoutes — App Router", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("detects app router pages", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/page.tsx", `export default function Home() { return <div />; }`);
    writeFile(tmp, "app/about/page.tsx", `export default function About() { return <div />; }`);
    writeFile(tmp, "app/layout.tsx", `export default function Layout({ children }) { return <html><body>{children}</body></html>; }`);

    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalApp, 3);
    const paths = result.app.map((r) => r.path);
    assert.ok(paths.includes("/"));
    assert.ok(paths.includes("/about"));
    const homePage = result.app.find((r) => r.path === "/" && r.type === "page");
    assert.ok(homePage);
    assert.equal(homePage.type, "page");
    const layout = result.app.find((r) => r.type === "layout");
    assert.ok(layout);
  });

  it("detects route handlers with HTTP methods", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/api/users/route.ts", `
export async function GET(request: Request) {
  return Response.json({ users: [] });
}

export async function POST(request: Request) {
  return Response.json({ created: true });
}
`);
    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalHandlers, 1);
    assert.equal(result.handlers[0].path, "/api/users");
    assert.equal(result.handlers[0].type, "route-handler");
    assert.ok(result.handlers[0].method.includes("GET"));
    assert.ok(result.handlers[0].method.includes("POST"));
  });

  it("detects dynamic routes", () => {
    tmp = createTmpDir();
    writeFile(tmp, "app/blog/[slug]/page.tsx", `export default function Post() { return <div />; }`);
    writeFile(tmp, "app/shop/[...categories]/page.tsx", `export default function Shop() { return <div />; }`);

    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalDynamic, 2);
    const slugDynamic = result.dynamic.find((d) => d.pattern.includes("[slug]"));
    assert.ok(slugDynamic);
    assert.ok(slugDynamic.params.includes("[slug]"));
    const catchAll = result.dynamic.find((d) => d.pattern.includes("[...categories]"));
    assert.ok(catchAll);
    assert.ok(catchAll.params.includes("[...categories]"));
  });

  it("handles src/app directory", () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/app/page.tsx", `export default function Home() { return <div />; }`);
    writeFile(tmp, "src/app/dashboard/page.tsx", `export default function Dashboard() { return <div />; }`);

    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalApp, 2);
    const paths = result.app.map((r) => r.path);
    assert.ok(paths.includes("/"));
    assert.ok(paths.includes("/dashboard"));
  });
});

// ---------------------------------------------------------------------------
// Routes — Pages Router
// ---------------------------------------------------------------------------

describe("Next.js analyzeRoutes — Pages Router", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("detects pages router with data fetching", () => {
    tmp = createTmpDir();
    writeFile(tmp, "pages/index.tsx", `
export async function getStaticProps() {
  return { props: {} };
}
export default function Home() { return <div />; }
`);
    writeFile(tmp, "pages/posts/[id].tsx", `
export async function getServerSideProps(context) {
  return { props: {} };
}
export async function getStaticPaths() {
  return { paths: [], fallback: false };
}
export default function Post() { return <div />; }
`);

    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalPages, 2);
    const homePage = result.pages.find((p) => p.path === "/");
    assert.ok(homePage);
    assert.ok(homePage.dataFetch.includes("getStaticProps"));

    const postPage = result.pages.find((p) => p.path === "/posts/[id]");
    assert.ok(postPage);
    assert.ok(postPage.dataFetch.includes("getServerSideProps"));
    assert.ok(postPage.dataFetch.includes("getStaticPaths"));
  });

  it("skips _app and _document", () => {
    tmp = createTmpDir();
    writeFile(tmp, "pages/_app.tsx", `export default function App() { return <div />; }`);
    writeFile(tmp, "pages/_document.tsx", `export default function Document() { return <div />; }`);
    writeFile(tmp, "pages/index.tsx", `export default function Home() { return <div />; }`);

    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalPages, 1);
    assert.equal(result.pages[0].path, "/");
  });

  it("detects dynamic pages in pages router", () => {
    tmp = createTmpDir();
    writeFile(tmp, "pages/users/[id].tsx", `export default function User() { return <div />; }`);

    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalDynamic, 1);
    assert.ok(result.dynamic[0].params.includes("[id]"));
  });
});

// ---------------------------------------------------------------------------
// Routes — Empty project
// ---------------------------------------------------------------------------

describe("Next.js analyzeRoutes — empty project", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns empty for project with no routes", () => {
    tmp = createTmpDir();
    const result = analyzeRoutes(tmp);
    assert.equal(result.summary.totalApp, 0);
    assert.equal(result.summary.totalPages, 0);
    assert.equal(result.summary.totalDynamic, 0);
    assert.equal(result.summary.totalHandlers, 0);
    assert.deepEqual(result.app, []);
    assert.deepEqual(result.pages, []);
    assert.deepEqual(result.dynamic, []);
    assert.deepEqual(result.handlers, []);
  });
});

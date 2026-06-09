/**
 * Directory-level analyzers for Next.js preset tests.
 *
 * These helpers are used only by unit tests (tests/unit/analyzers.test.js).
 * They were previously exported from data/components.js and data/routes.js but
 * have been relocated here so that preset data/ modules do not import
 * senti internals (spec 191: preset DI container).
 */

import fs from "fs";
import path from "path";
import { collectFiles } from "../../../docs/lib/scanner.js";

const COMPONENT_INCLUDE = [
  "app/**/*.tsx", "app/**/*.jsx",
  "components/**/*.tsx", "components/**/*.jsx",
  "src/components/**/*.tsx", "src/components/**/*.jsx",
  "src/app/**/*.tsx", "src/app/**/*.jsx",
];

function classifyComponentDir(relPath, content) {
  if (/\/(shared|common)\//.test(relPath)) return "shared";
  if (/^["']use client["']/.test(content.trimStart())) return "client";
  return "server";
}

export function analyzeComponents(sourceRoot) {
  const files = collectFiles(sourceRoot, COMPONENT_INCLUDE);
  const components = [];

  for (const f of files) {
    const content = fs.readFileSync(f.absPath, "utf8");
    const type = classifyComponentDir(f.relPath, content);
    components.push({
      name: path.basename(f.fileName, path.extname(f.fileName)),
      file: f.relPath,
      relPath: f.relPath,
      type,
      lines: f.lines,
      hash: f.hash,
      mtime: f.mtime,
    });
  }

  const byType = { server: 0, client: 0, shared: 0 };
  for (const c of components) byType[c.type]++;

  return {
    components,
    summary: { total: components.length, ...byType },
  };
}

const APP_INCLUDE = [
  "app/**/*.ts", "app/**/*.tsx", "app/**/*.js", "app/**/*.jsx",
  "src/app/**/*.ts", "src/app/**/*.tsx", "src/app/**/*.js", "src/app/**/*.jsx",
];

const PAGES_INCLUDE = [
  "pages/**/*.ts", "pages/**/*.tsx", "pages/**/*.js", "pages/**/*.jsx",
  "src/pages/**/*.ts", "src/pages/**/*.tsx", "src/pages/**/*.js", "src/pages/**/*.jsx",
];

const APP_ROUTER_FILES = new Set([
  "page", "layout", "loading", "error", "not-found", "template", "default", "route",
]);

function dirToRoute(relPath) {
  const parts = relPath.replace(/\\/g, "/").split("/");
  const start = parts[0] === "src" ? 2 : 1;
  const dirParts = parts.slice(start, -1);
  if (dirParts.length === 0) return "/";
  return "/" + dirParts.join("/");
}

function extractDynamicParams(routePath) {
  const params = [];
  const re = /\[{1,2}\.{0,3}(\w+)\]{1,2}/g;
  let m;
  while ((m = re.exec(routePath)) !== null) {
    params.push(m[0]);
  }
  return params;
}

function detectDataFetch(content) {
  const methods = [];
  if (/export\s+(async\s+)?function\s+getStaticProps/.test(content)) methods.push("getStaticProps");
  if (/export\s+(async\s+)?function\s+getServerSideProps/.test(content)) methods.push("getServerSideProps");
  if (/export\s+(async\s+)?function\s+getStaticPaths/.test(content)) methods.push("getStaticPaths");
  return methods.join(", ") || "\u2014";
}

function pageFileToRoute(relPath, baseName) {
  const dir = dirToRoute(relPath);
  if (baseName === "index") return dir;
  return dir === "/" ? `/${baseName}` : `${dir}/${baseName}`;
}

function classifyScanRouteFile(baseName) {
  const types = {
    page: "page",
    layout: "layout",
    loading: "loading",
    error: "error",
    "not-found": "not-found",
    template: "template",
    default: "default",
    route: "route-handler",
  };
  return types[baseName] || "other";
}

export function analyzeRoutes(sourceRoot) {
  const appFiles = collectFiles(sourceRoot, APP_INCLUDE);
  const pagesFiles = collectFiles(sourceRoot, PAGES_INCLUDE);

  const app = [];
  const pages = [];
  const dynamic = [];
  const handlers = [];

  for (const f of appFiles) {
    const baseName = path.basename(f.fileName, path.extname(f.fileName));
    if (!APP_ROUTER_FILES.has(baseName)) continue;

    const routePath = dirToRoute(f.relPath);
    const fileType = classifyScanRouteFile(baseName);
    const params = extractDynamicParams(routePath);

    const entry = {
      path: routePath,
      file: f.relPath,
      relPath: f.relPath,
      type: fileType,
      lines: f.lines,
      hash: f.hash,
      mtime: f.mtime,
    };

    if (fileType === "route-handler") {
      const content = fs.readFileSync(f.absPath, "utf8");
      const methods = [];
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
        const re = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
        if (re.test(content)) methods.push(method);
      }
      handlers.push({ ...entry, method: methods.join(", ") || "\u2014" });
    } else {
      app.push(entry);
    }

    if (params.length > 0) {
      dynamic.push({
        pattern: routePath,
        params: params.join(", "),
        file: f.relPath,
        hash: f.hash,
        mtime: f.mtime,
      });
    }
  }

  for (const f of pagesFiles) {
    const baseName = path.basename(f.fileName, path.extname(f.fileName));
    if (baseName.startsWith("_")) continue;

    const routePath = pageFileToRoute(f.relPath, baseName);
    const content = fs.readFileSync(f.absPath, "utf8");
    const dataFetch = detectDataFetch(content);
    const params = extractDynamicParams(routePath);

    pages.push({
      path: routePath,
      file: f.relPath,
      relPath: f.relPath,
      type: "page",
      dataFetch,
      lines: f.lines,
      hash: f.hash,
      mtime: f.mtime,
    });

    if (params.length > 0) {
      dynamic.push({
        pattern: routePath,
        params: params.join(", "),
        file: f.relPath,
        hash: f.hash,
        mtime: f.mtime,
      });
    }
  }

  return {
    app,
    pages,
    dynamic,
    handlers,
    summary: {
      totalApp: app.length,
      totalPages: pages.length,
      totalDynamic: dynamic.length,
      totalHandlers: handlers.length,
    },
  };
}

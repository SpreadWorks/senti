/**
 * RoutesSource — scan + data DataSource for Next.js routes.
 *
 * Analyzes Next.js file-based routing (App Router and Pages Router).
 * Each file produces one NextjsRouteEntry with a routeType discriminator.
 * Data methods read analysis.routes to generate route tables.
 */

import fs from "fs";
import path from "path";

const ROUTE_FILE_PREFIXES = ["app/", "pages/", "src/app/", "src/pages/"];
const ROUTE_EXT = /\.(ts|tsx|js|jsx)$/;

/** Convert directory-based path to URL route path. */
function dirToRoute(relPath) {
  const parts = relPath.replace(/\\/g, "/").split("/");
  const start = parts[0] === "src" ? 2 : 1;
  const dirParts = parts.slice(start, -1);
  if (dirParts.length === 0) return "/";
  return "/" + dirParts.join("/");
}

/** Detect dynamic route segments. */
function extractDynamicParams(routePath) {
  const params = [];
  const re = /\[{1,2}\.{0,3}(\w+)\]{1,2}/g;
  let m;
  while ((m = re.exec(routePath)) !== null) {
    params.push(m[0]);
  }
  return params;
}

/** Detect data fetching method in Pages Router files. */
function detectDataFetch(content) {
  const methods = [];
  if (/export\s+(async\s+)?function\s+getStaticProps/.test(content)) methods.push("getStaticProps");
  if (/export\s+(async\s+)?function\s+getServerSideProps/.test(content)) methods.push("getServerSideProps");
  if (/export\s+(async\s+)?function\s+getStaticPaths/.test(content)) methods.push("getStaticPaths");
  return methods.join(", ") || "\u2014";
}

/** Determine route file type (page, layout, route handler, etc.). */
function classifyRouteFile(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
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
  return types[base] || "other";
}

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const hasAnyPathPrefix = container.get("pathMatch.hasAnyPathPrefix");

  class NextjsRouteEntry extends AnalysisEntry {
    routePath = null;
    routeType = null;
    fileType = null;
    dynamicParams = null;
    method = null;
    dataFetch = null;
    static summary = {};
  }

  class RoutesSource extends Scannable(DataSource) {
    static Entry = NextjsRouteEntry;

    match(relPath) {
      return ROUTE_EXT.test(relPath) && hasAnyPathPrefix(relPath, ROUTE_FILE_PREFIXES);
    }

    parse(absPath) {
      const entry = new NextjsRouteEntry();
      const content = fs.readFileSync(absPath, "utf8");

      const isAppRouter = /[/\\](app|src[/\\]app)[/\\]/.test(absPath);
      const isPagesRouter = /[/\\](pages|src[/\\]pages)[/\\]/.test(absPath);

      const normalized = absPath.replace(/\\/g, "/");
      let relLike;
      const appMatch = normalized.match(/((?:src\/)?app\/.*)$/);
      const pagesMatch = normalized.match(/((?:src\/)?pages\/.*)$/);
      relLike = appMatch ? appMatch[1] : pagesMatch ? pagesMatch[1] : path.basename(absPath);

      const routePath = dirToRoute(relLike);
      const fileType = classifyRouteFile(absPath);
      const params = extractDynamicParams(routePath);

      entry.routePath = routePath;
      entry.fileType = fileType;
      entry.dynamicParams = params.length > 0 ? params.join(", ") : null;

      if (isAppRouter) {
        if (fileType === "route-handler") {
          entry.routeType = "handler";
          const methods = [];
          for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
            const re = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
            if (re.test(content)) methods.push(method);
          }
          entry.method = methods.join(", ") || "\u2014";
        } else {
          entry.routeType = "app";
        }
      } else if (isPagesRouter) {
        entry.routeType = "page";
        entry.dataFetch = detectDataFetch(content);
      }

      return entry;
    }

    app(analysis, labels) {
      const items = (analysis.routes?.entries || []).filter((r) => r.routeType === "app");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (r) => [
        r.routePath || "\u2014",
        r.fileType || "\u2014",
        r.file || "\u2014",
        r.summary || "\u2014",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Path", "Type", "File", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    pages(analysis, labels) {
      const items = (analysis.routes?.entries || []).filter((r) => r.routeType === "page");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (r) => [
        r.routePath || "\u2014",
        r.dataFetch || "\u2014",
        r.summary || "\u2014",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Page", "Data Fetching", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    dynamic(analysis, labels) {
      const items = (analysis.routes?.entries || []).filter((r) => r.dynamicParams != null);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (r) => [
        r.routePath || "\u2014",
        r.dynamicParams || "\u2014",
        r.summary || "\u2014",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Pattern", "Parameters", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    handlers(analysis, labels) {
      const items = (analysis.routes?.entries || []).filter((r) => r.routeType === "handler");
      if (items.length === 0) return null;
      const rows = this.toRows(items, (r) => [
        r.method || "\u2014",
        r.routePath || "\u2014",
        r.file || "\u2014",
        r.summary || "\u2014",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Method", "Path", "File", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return RoutesSource;
}

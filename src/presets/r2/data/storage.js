/**
 * R2StorageSource — Scannable DataSource for Cloudflare R2.
 *
 * Scans wrangler.toml to extract R2 bucket configuration.
 * Reads analysis.storage to generate R2-specific tables.
 */

import fs from "fs";
import path from "path";

const WRANGLER_FILES = new Set(["wrangler.toml", "wrangler.json", "wrangler.jsonc"]);

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Scannable = container.get("base.Scannable");
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const parseTOML = container.get("toml.parse");

  class StorageEntry extends AnalysisEntry {
    buckets = null;

    static summary = {};
  }

  class R2StorageSource extends Scannable(DataSource) {
    static Entry = StorageEntry;

    match(relPath) {
      return WRANGLER_FILES.has(path.basename(relPath));
    }

    parse(absPath) {
      const entry = new StorageEntry();
      const raw = fs.readFileSync(absPath, "utf8");
      const fileName = path.basename(absPath);
      const isToml = fileName === "wrangler.toml";

      let cfg;
      try {
        cfg = isToml ? parseTOML(raw) : JSON.parse(raw);
      } catch (_) {
        return entry;
      }

      const r2Buckets = cfg.r2_buckets || [];
      entry.buckets = r2Buckets.map((b) => ({
        name: b.bucket_name || b.binding || "",
        binding: b.binding || "",
        preview_bucket_name: b.preview_bucket_name || "",
      }));

      return entry;
    }

    /** R2 buckets list. */
    buckets(analysis, labels) {
      const entries = analysis.storage?.entries || [];
      const items = entries.flatMap((e) => e.buckets || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (b) => [
        b.name || "—",
        b.binding || "—",
        b.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Bucket", "Binding", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }

    /** Access patterns table. */
    access(analysis, labels) {
      const items = analysis.storage?.access;
      if (!Array.isArray(items) || items.length === 0) return null;
      const rows = this.toRows(items, (a) => [
        a.method || "—",
        a.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Method", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return R2StorageSource;
}

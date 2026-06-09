/**
 * StorageBucketsSource — enrich-based DataSource for storage services.
 *
 * Reads analysis.storage to generate bucket/container tables.
 */

export default function register(container) {
  const DataSource = container.get("base.DataSource");

  class StorageBucketsSource extends DataSource {
    /** Storage buckets/containers list. */
    list(analysis, labels) {
      const entries = analysis.storage?.entries || [];
      const items = entries.flatMap((e) => e.buckets || []);
      if (items.length === 0) return null;
      const rows = this.toRows(items, (b) => [
        b.name || "—",
        b.provider || b.type || "—",
        b.summary || "—",
      ]);
      const hdr = labels.length >= 2 ? labels : ["Bucket", "Provider", "Description"];
      return this.toMarkdownTable(rows, hdr);
    }
  }

  return StorageBucketsSource;
}

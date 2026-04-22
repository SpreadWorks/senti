/**
 * ProjectSource — common DataSource for project metadata.
 *
 * Provides package.json values (name, description, version) as {{data}} directives.
 * Available for all project types.
 */

import fs from "fs";
import path from "path";

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Paragraph = container.get("base.Paragraph");

  class ProjectSource extends DataSource {
  init(ctx) {
    super.init(ctx);
    this._root = ctx.root;
    this._pkgCache = undefined;
  }

  _pkg() {
    if (this._pkgCache !== undefined) return this._pkgCache;
    const pkgPath = path.join(this._root, "package.json");
    if (fs.existsSync(pkgPath)) {
      this._pkgCache = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } else {
      this._pkgCache = null;
    }
    return this._pkgCache;
  }

  /** Project / package name. */
  name(_analysis, _labels) {
    const pkg = this._pkg();
    return new Paragraph(pkg?.name || path.basename(this._root));
  }

  /** Project description. */
  description(_analysis, _labels) {
    const pkg = this._pkg();
    return pkg?.description ? new Paragraph(pkg.description) : null;
  }

  /** Project version. */
  version(_analysis, _labels) {
    const pkg = this._pkg();
    return new Paragraph(pkg?.version || "0.0.0");
  }

  /** package.json scripts as a markdown table. */
  scripts(_analysis, labels) {
    const pkg = this._pkg();
    if (!pkg?.scripts || Object.keys(pkg.scripts).length === 0) return null;
    const rows = Object.entries(pkg.scripts).map(([name, cmd]) => [name, `\`${cmd}\``]);
    const hdr = labels.length >= 2 ? labels : ["Script", "Command"];
    return this.toMarkdownTable(rows, hdr);
  }
  }

  return ProjectSource;
}

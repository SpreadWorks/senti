/**
 * EmailSource — CakePHP 2.x email notifications DataSource.
 */

import fs from "fs";

export default function register(container) {
  const AnalysisEntry = container.get("base.AnalysisEntry");
  const hasPathPrefix = container.get("pathMatch.hasPathPrefix");
  const hasSegmentPath = container.get("pathMatch.hasSegmentPath");
  const stripBlockComments = container.get("phpParser.stripBlockComments");
  const WebappDataSource = container.getPreset("webapp").dataSources["webapp-data-source"];

  class EmailEntry extends AnalysisEntry {
    emailType = null;
    transport = null;
    defaultFrom = null;
    subjects = null;
    hasCc = null;
    static summary = {};
  }

  class CakephpEmailSource extends WebappDataSource {
    static Entry = EmailEntry;

    match(relPath) {
      return hasPathPrefix(relPath, "app/View/Emails/")
        || hasSegmentPath(relPath, "app/Config/email.php")
        || (hasPathPrefix(relPath, "app/Console/Command/") && /\w+\.php$/.test(relPath))
        || (hasPathPrefix(relPath, "app/Lib/") && /\w+\.php$/.test(relPath));
    }

    parse(absPath) {
      const entry = new EmailEntry();
      const content = fs.readFileSync(absPath, "utf8");

      if (absPath.endsWith("/Config/email.php")) {
        entry.emailType = "config";
        const src = stripBlockComments(content);
        const defaultMatch = src.match(/\$default\s*=\s*array\s*\(([\s\S]*?)\)\s*;/);
        if (defaultMatch) {
          const body = defaultMatch[1];
          const transport = body.match(/['"]transport['"]\s*=>\s*['"](\w+)['"]/);
          const from = body.match(/['"]from['"]\s*=>\s*['"]([^'"]+)['"]/);
          if (transport) entry.transport = transport[1];
          if (from) entry.defaultFrom = from[1];
        }
        return entry;
      }

      if (/\/View\/Emails\//.test(absPath)) {
        entry.emailType = "template";
        return entry;
      }

      if (!content.includes("CakeEmail")) return entry;

      entry.emailType = "usage";
      const subjects = [];
      const subjectStartRe = /->subject\s*\(/g;
      let sm;
      while ((sm = subjectStartRe.exec(content)) !== null) {
        const startIdx = sm.index + sm[0].length;
        let depth = 1;
        let i = startIdx;
        while (i < content.length && depth > 0) {
          if (content[i] === "(") depth++;
          else if (content[i] === ")") depth--;
          i++;
        }
        let subj = content.slice(startIdx, i - 1).trim();
        subj = subj
          .replace(/Configure::read\(['"]([^'"]+)['"]\)/g, "{$1}")
          .replace(/\s*\.\s*/g, "")
          .replace(/["']/g, "");
        subjects.push(subj);
      }
      entry.subjects = [...new Set(subjects)];
      entry.hasCc = /->cc\s*\(/.test(content);

      return entry;
    }

    list(analysis, labels) {
      const entries = analysis.email?.entries || [];
      const usages = entries.filter((e) => e.emailType === "usage");
      if (usages.length === 0) return null;

      const configEntries = entries.filter((e) => e.emailType === "config");
      const from = configEntries[0]?.defaultFrom || "—";
      const transport = configEntries[0]?.transport || "—";

      const rows = [[`（デフォルト送信元: ${from}）`, "", ""]];
      for (const usage of usages) {
        const fileName = usage.file?.split("/").pop() || "—";
        const subjects = usage.subjects?.length > 0 ? usage.subjects.join("; ") : "（動的生成）";
        rows.push([fileName, subjects, transport]);
      }
      return this.toMarkdownTable(rows, labels);
    }
  }

  return CakephpEmailSource;
}

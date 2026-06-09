import path from "path";
import { pathToFileURL } from "url";

export async function main(argv = process.argv.slice(2), ctx = {}) {
  const packageRoot = ctx.packageRoot || process.env.SENTI_PACKAGE_ROOT || ctx.sourceRoot || process.env.SENTI_SOURCE_ROOT;
  if (!packageRoot) throw new Error("packageRoot is required for the workflow plugin command");
  const workflowPath = path.join(packageRoot, "workflow", "index.js");
  process.argv = [process.argv[0], workflowPath, ...argv];
  await import(pathToFileURL(workflowPath).href);
}

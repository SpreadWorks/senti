import path from "path";
import { pathToFileURL } from "url";
import { PKG_DIR } from "../../../lib/cli.js";

export async function main() {
  const workflowPath = path.join(PKG_DIR, "workflow", "index.js");
  process.argv = [process.argv[0], workflowPath, ...process.argv.slice(2)];
  await import(pathToFileURL(workflowPath).href);
}

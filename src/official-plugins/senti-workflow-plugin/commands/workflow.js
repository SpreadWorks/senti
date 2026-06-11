import path from "path";
import { pathToFileURL } from "url";

export default function register(api) {
  return {
    async main(argv = [], ctx = {}) {
      const packageRoot = ctx.plugin?.root || process.env.SENTI_PACKAGE_ROOT || process.env.SENTI_SOURCE_ROOT;
      if (!packageRoot) throw new Error("packageRoot is required for the workflow plugin command");
      const workflowPath = path.join(packageRoot, "workflow", "index.js");
      process.argv = [process.argv[0], workflowPath, ...argv];
      await import(pathToFileURL(workflowPath).href);
      return api.Envelope.ok("plugin", "workflow", { handled: true });
    },
  };
}

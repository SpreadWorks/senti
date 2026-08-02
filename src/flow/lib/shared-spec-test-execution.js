import path from "node:path";
import { PKG_DIR } from "../../lib/cli.js";

const LOADER_PATH = path.join(PKG_DIR, "flow", "lib", "execution-root-module-loader.js");

function absoluteDirectory(value, field) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    throw new Error(`${field} must be an absolute directory`);
  }
  return path.resolve(value);
}

export class SharedSpecTestExecution {
  constructor({ repositoryRoot, executionRoot, specRoot }) {
    this.repositoryRoot = absoluteDirectory(repositoryRoot, "repository root");
    this.executionRoot = absoluteDirectory(executionRoot, "execution root");
    this.specRoot = absoluteDirectory(specRoot, "spec root");
    Object.freeze(this);
  }

  nodeArgv(args) {
    if (!Array.isArray(args) || args.some((entry) => typeof entry !== "string" || entry === "")) {
      throw new Error("shared spec test arguments must be non-empty strings");
    }
    return [
      "node",
      ...(this.usesModuleRedirect ? ["--experimental-loader", LOADER_PATH] : []),
      ...args,
    ];
  }

  get environment() {
    if (!this.usesModuleRedirect) return {};
    return {
      SENTI_TEST_REPOSITORY_ROOT: this.repositoryRoot,
      SENTI_TEST_EXECUTION_ROOT: this.executionRoot,
      SENTI_TEST_SPEC_ROOT: this.specRoot,
    };
  }

  get usesModuleRedirect() {
    return this.repositoryRoot !== this.executionRoot;
  }
}

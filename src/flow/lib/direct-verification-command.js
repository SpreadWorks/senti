import fs from "node:fs";
import path from "node:path";

import {
  discoverRegressionCommand,
  NO_SUPPORTED_REGRESSION_COMMAND,
} from "./test-regression.js";

function nonEmptyCommand(value) {
  const command = typeof value === "string" ? value.trim() : "";
  return command === "" ? null : command;
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export class DirectVerificationCommand {
  constructor({ command, source }) {
    const normalizedCommand = nonEmptyCommand(command);
    const normalizedSource = typeof source === "string" ? source.trim() : "";
    if (normalizedCommand == null) {
      throw new Error("direct verification command must be a non-empty string");
    }
    if (normalizedSource === "") {
      throw new Error("direct verification command source must be a non-empty string");
    }
    this.command = normalizedCommand;
    this.source = normalizedSource;
    Object.freeze(this);
  }

  toCliOption() {
    return `--test-command ${JSON.stringify(this.command)}`;
  }

  toJSON() {
    return {
      command: this.command,
      source: this.source,
    };
  }
}

export class DirectVerificationCommandResolver {
  constructor({ root, config = {}, state = null }) {
    if (typeof root !== "string" || !path.isAbsolute(root)) {
      throw new Error("direct verification root must be an absolute path");
    }
    this.root = root;
    this.config = config || {};
    this.state = state;
    Object.freeze(this);
  }

  #fromStoredVerification() {
    const command = nonEmptyCommand(
      this.state?.directFlowSession?.verification?.testCommand,
    );
    return command == null
      ? null
      : new DirectVerificationCommand({
          command,
          source: "direct verification history",
        });
  }

  #fromFinalRegression(specDir) {
    const result = readJsonIfPresent(path.join(specDir, "final-regression-result.json"));
    const command = result?.completed === true
      ? nonEmptyCommand(result.command)
      : null;
    return command == null
      ? null
      : new DirectVerificationCommand({
          command,
          source: "final-regression-result.json",
        });
  }

  #fromRequirementTests(specDir) {
    const result = readJsonIfPresent(path.join(specDir, "test-execute-result.json"));
    const commands = [...new Set((result?.summary || [])
      .map((entry) => nonEmptyCommand(entry?.evidence?.command))
      .filter(Boolean))];
    return commands.length === 1
      ? new DirectVerificationCommand({
          command: commands[0],
          source: "test-execute-result.json",
        })
      : null;
  }

  #fromProjectConfiguration() {
    try {
      const command = discoverRegressionCommand(this.root, this.config);
      const configured = command.source === "test.command"
        ? nonEmptyCommand(this.config?.test?.command)
        : null;
      return new DirectVerificationCommand({
        command: configured || command.toString(),
        source: command.source,
      });
    } catch (error) {
      if (error?.code === NO_SUPPORTED_REGRESSION_COMMAND) return null;
      throw error;
    }
  }

  resolve(explicitCommand = null) {
    const explicit = nonEmptyCommand(explicitCommand);
    if (explicit != null) {
      return new DirectVerificationCommand({
        command: explicit,
        source: "explicit CLI option",
      });
    }
    const specDir = this.state?.spec
      ? path.dirname(path.resolve(this.root, this.state.spec))
      : null;
    return this.#fromStoredVerification()
      || (specDir && this.#fromFinalRegression(specDir))
      || (specDir && this.#fromRequirementTests(specDir))
      || this.#fromProjectConfiguration();
  }
}

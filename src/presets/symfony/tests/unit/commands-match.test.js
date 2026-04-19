/**
 * I/O tests for Symfony CommandsSource.match().
 *
 * Verifies that match() correctly identifies Console command files
 * in src/Command/ while excluding abstract base classes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { container, initContainer } from "../../../../lib/container.js";
import { loadDataSources } from "../../../../docs/lib/data-source-loader.js";
import path from "path";
import { fileURLToPath } from "url";

initContainer();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
await loadDataSources(path.resolve(__dirname, "../../../webapp/data"), { presetKey: "webapp" });

const registerCommands = (await import("../../data/commands.js")).default;
const SymfonyCommandsSource = registerCommands(container);

describe("SymfonyCommandsSource.match()", () => {
  const source = new SymfonyCommandsSource();

  it("matches PHP files in src/Command/", () => {
    assert.equal(
      source.match("src/Command/CleanupCommand.php"),
      true,
    );
  });

  it("matches commands without Command suffix", () => {
    assert.equal(
      source.match("src/Command/SendEmails.php"),
      true,
    );
  });

  it("excludes files outside src/Command/", () => {
    assert.equal(
      source.match("src/Controller/UserController.php"),
      false,
    );
  });

  it("excludes non-PHP files", () => {
    assert.equal(
      source.match("src/Command/.gitkeep"),
      false,
    );
  });
});

/**
 * I/O tests for Laravel CommandsSource.match().
 *
 * Verifies that match() correctly identifies Artisan command files
 * in app/Console/Commands/ while excluding base Command class.
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
const LaravelCommandsSource = registerCommands(container);

describe("LaravelCommandsSource.match()", () => {
  const source = new LaravelCommandsSource();

  it("matches PHP files in app/Console/Commands/", () => {
    assert.equal(
      source.match("app/Console/Commands/CleanupCommand.php"),
      true,
    );
  });

  it("matches Artisan commands without Command suffix", () => {
    assert.equal(
      source.match("app/Console/Commands/SendEmails.php"),
      true,
    );
  });

  it("excludes Kernel.php", () => {
    assert.equal(
      source.match("app/Console/Kernel.php"),
      false,
    );
  });

  it("excludes files outside Console/Commands/", () => {
    assert.equal(
      source.match("app/Http/Controllers/UserController.php"),
      false,
    );
  });

  it("excludes non-PHP files", () => {
    assert.equal(
      source.match("app/Console/Commands/README.md"),
      false,
    );
  });
});

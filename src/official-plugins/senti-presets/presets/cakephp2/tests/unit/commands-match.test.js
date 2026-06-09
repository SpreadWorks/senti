/**
 * I/O tests for CakePHP2 CommandsSource.match().
 *
 * Verifies that match() correctly identifies CakePHP shell files
 * in Console/Command/ while excluding AppShell.
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
const CakephpCommandsSource = registerCommands(container);

describe("CakephpCommandsSource.match()", () => {
  const source = new CakephpCommandsSource();

  it("matches *Shell.php in Console/Command/", () => {
    assert.equal(
      source.match("app/Console/Command/CleanupShell.php"),
      true,
    );
  });

  it("matches nested Shell files", () => {
    assert.equal(
      source.match("app/Console/Command/ImportShell.php"),
      true,
    );
  });

  it("excludes AppShell.php", () => {
    assert.equal(
      source.match("app/Console/Command/AppShell.php"),
      false,
    );
  });

  it("excludes files not in Console/Command/", () => {
    assert.equal(
      source.match("app/Model/TaskShell.php"),
      false,
    );
  });

  it("excludes non-Shell PHP files in Console/Command/", () => {
    assert.equal(
      source.match("app/Console/Command/Helper.php"),
      false,
    );
  });
});

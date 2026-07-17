#!/usr/bin/env node
/**
 * src/docs.js
 *
 * Docs dispatcher. Routes docs-related subcommands (including `build`)
 * to the unified dispatcher via `CommandDefinition` in the command registry.
 */

import { container, initContainer } from "./lib/container.js";
import { NamespaceDispatcher } from "./lib/namespace-dispatcher.js";

initContainer();

await new NamespaceDispatcher({ namespace: "docs", container }).run(process.argv.slice(2));

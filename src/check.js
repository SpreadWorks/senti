#!/usr/bin/env node
/**
 * src/check.js
 *
 * Check dispatcher. Routes check subcommands via the unified dispatcher.
 */

import { container, initContainer } from "./lib/container.js";
import { NamespaceDispatcher } from "./lib/namespace-dispatcher.js";

initContainer();

await new NamespaceDispatcher({ namespace: "check", container }).run(process.argv.slice(2));

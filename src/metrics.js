#!/usr/bin/env node
/**
 * src/metrics.js
 *
 * Metrics dispatcher. Routes metrics subcommands via the unified dispatcher.
 */

import { container, initContainer } from "./lib/container.js";
import { NamespaceDispatcher } from "./lib/namespace-dispatcher.js";

initContainer();

await new NamespaceDispatcher({ namespace: "metrics", container }).run(process.argv.slice(2));

#!/usr/bin/env node
/**
 * src/spec.js
 *
 * Spec dispatcher. Routes `senti spec <command>` to individual command
 * implementations under src/spec/commands/.
 */

import { container, initContainer } from "./lib/container.js";
import { NamespaceDispatcher } from "./lib/namespace-dispatcher.js";

initContainer();

await new NamespaceDispatcher({ namespace: "spec", container, envelopeType: "spec" }).run(process.argv.slice(2));

#!/usr/bin/env node
/**
 * src/hook.js
 *
 * Hook dispatcher. Routes `senti hook <command>` to hook management
 * commands.
 */

import { container, initContainer } from "./lib/container.js";
import { NamespaceDispatcher } from "./lib/namespace-dispatcher.js";

initContainer();

await new NamespaceDispatcher({ namespace: "hook", container, envelopeType: "hook" }).run(process.argv.slice(2));

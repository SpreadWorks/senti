import { coreCommandRegistry } from "./command-registry.js";
import { EXIT_ERROR } from "./constants.js";
import { dispatch } from "./dispatcher.js";

export class NamespaceDispatcher {
  constructor({ namespace, container, envelopeType = null }) {
    const definition = coreCommandRegistry.find([namespace]);
    if (!definition?.entrypoint || definition.subcommands.size === 0) {
      throw new Error(`invalid command namespace: ${namespace}`);
    }
    this.namespace = namespace;
    this.definition = definition;
    this.container = container;
    this.envelopeType = envelopeType;
  }

  async run(argv) {
    const [name, ...rest] = argv;
    if (!name || name === "-h" || name === "--help") {
      process.stdout.write(`${this.definition.renderHelp()}\n`);
      process.exit(name ? 0 : EXIT_ERROR);
    }

    const command = this.definition.find([name]);
    if (!command?.command) {
      process.stderr.write(`senrail ${this.namespace}: unknown command '${name}'\n`);
      process.stderr.write(`Run: senrail ${this.namespace} --help\n`);
      process.exit(EXIT_ERROR);
    }

    await dispatch({
      container: this.container,
      entry: command,
      argv: rest,
      envelopeType: this.envelopeType || undefined,
      envelopeKey: this.envelopeType ? name : undefined,
    });
  }
}

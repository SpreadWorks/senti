import { createLogger } from './logger.js';
import { loadConfig } from './config.js';
import { HttpClient } from './http-client.js';

/**
 * Application entry point. Loads config, initializes services, and starts.
 * @returns {Promise<void>}
 */
export async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const app = createApp(config);

  logger.info('Application starting');

  const server = await app.start();
  logger.info(`Listening on port ${config.port}`);

  process.on('SIGTERM', async () => {
    logger.info('Shutting down');
    await server.close();
  });
}

/**
 * Create and configure the application instance.
 * @param {object} config
 * @returns {{ start: Function, client: HttpClient }}
 */
export function createApp(config) {
  const logger = createLogger(config.logLevel);
  const client = new HttpClient({
    baseUrl: config.apiBaseUrl,
    timeout: config.timeout,
  });

  return {
    client,
    async start() {
      const { createServer } = await import('node:http');
      const server = createServer((req, res) => {
        logger.info(`${req.method} ${req.url}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
      return new Promise(resolve => {
        server.listen(config.port, () => resolve(server));
      });
    },
  };
}

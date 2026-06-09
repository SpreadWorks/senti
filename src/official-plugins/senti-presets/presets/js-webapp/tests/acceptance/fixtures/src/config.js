import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULTS = {
  port: 3000,
  logLevel: 'info',
  apiBaseUrl: 'http://localhost:8080',
  timeout: 30000,
};

/**
 * Load application configuration from a JSON file and environment variables.
 * Environment variables take precedence over file values.
 * @param {string} [configPath] - Path to config file
 * @returns {object} Merged configuration
 */
export function loadConfig(configPath) {
  const filePath = configPath || join(process.cwd(), 'config.json');
  let fileConfig = {};

  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf-8');
    fileConfig = JSON.parse(raw);
  }

  const envOverrides = {
    port: getEnv('PORT', undefined, Number),
    logLevel: getEnv('LOG_LEVEL'),
    apiBaseUrl: getEnv('API_BASE_URL'),
    timeout: getEnv('TIMEOUT', undefined, Number),
  };

  const merged = { ...DEFAULTS, ...fileConfig };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Read an environment variable with optional type coercion.
 * @param {string} name - Environment variable name
 * @param {*} [fallback] - Default if not set
 * @param {Function} [coerce] - Type coercion function (e.g. Number, Boolean)
 * @returns {*}
 */
export function getEnv(name, fallback = undefined, coerce = undefined) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (coerce) return coerce(value);
  return value;
}

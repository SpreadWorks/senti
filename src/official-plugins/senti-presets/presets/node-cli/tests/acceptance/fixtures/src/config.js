import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_CONFIG = {
  format: 'html',
  strict: false,
  maxDepth: 3,
  listMarker: '-',
  lineWidth: 80,
};

/**
 * Load configuration from .mdparserrc.json or use defaults.
 * @param {string} [cwd] - Working directory to search for config
 * @returns {object} Merged configuration
 */
export function loadConfig(cwd = process.cwd()) {
  const configPath = join(cwd, '.mdparserrc.json');

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, 'utf-8');
  const userConfig = JSON.parse(raw);

  return { ...DEFAULT_CONFIG, ...userConfig };
}

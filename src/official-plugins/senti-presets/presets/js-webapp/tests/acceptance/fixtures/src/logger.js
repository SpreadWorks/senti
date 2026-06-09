const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Create a logger instance with the specified minimum log level.
 * @param {string} [level='info'] - Minimum log level
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 */
export function createLogger(level = 'info') {
  const threshold = LOG_LEVELS[level] ?? LOG_LEVELS.info;

  function write(lvl, message, meta) {
    if ((LOG_LEVELS[lvl] ?? 0) < threshold) return;
    const timestamp = new Date().toISOString();
    const formatted = formatMessage(lvl, message, timestamp, meta);
    process.stdout.write(formatted + '\n');
  }

  return {
    debug: (msg, meta) => write('debug', msg, meta),
    info: (msg, meta) => write('info', msg, meta),
    warn: (msg, meta) => write('warn', msg, meta),
    error: (msg, meta) => write('error', msg, meta),
  };
}

/**
 * Format a log message with timestamp, level, and optional metadata.
 * @param {string} level
 * @param {string} message
 * @param {string} timestamp
 * @param {object} [meta]
 * @returns {string}
 */
export function formatMessage(level, message, timestamp, meta) {
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  let line = `${prefix} ${message}`;

  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    line += ' ' + JSON.stringify(meta);
  }

  return line;
}

/**
 * Structured JSON Logger for Flow GraphQL Gateway
 * Enriches log entries with ISO timestamps, log levels, service context, and correlation IDs.
 */

const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

const currentLevel = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

function log(levelName, message, context = {}) {
  const levelVal = LOG_LEVELS[levelName] || LOG_LEVELS.INFO;
  if (levelVal < currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    service: 'graphql-gateway',
    level: levelName,
    message,
    requestId: context.requestId || context.req?.requestId || undefined,
    userId: context.userId || context.user?.userId || undefined,
    ...context,
  };

  // Clean out express request objects if inadvertently passed in context
  delete entry.req;
  delete entry.res;

  const serialized = JSON.stringify(entry);
  if (levelName === 'ERROR') {
    console.error(serialized);
  } else if (levelName === 'WARN') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug: (message, context) => log('DEBUG', message, context),
  info: (message, context) => log('INFO', message, context),
  warn: (message, context) => log('WARN', message, context),
  error: (message, context) => log('ERROR', message, context),
};

export default logger;

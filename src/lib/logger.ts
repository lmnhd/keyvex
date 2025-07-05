import pino from 'pino';
import pretty from 'pino-pretty';

const isDebug = process.env.AI_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

let logger: pino.Logger;

// This formatter preserves structured log data while removing system fields
const fileLogFormatter = {
  log: (obj: any) => {
    // Remove system fields but keep all structured log data
    const { msg, pid, hostname, level, time, ...logData } = obj;
    return { 
      message: msg,
      ...logData // Keep all the actual log data (jobId, tccPresent, etc.)
    };
  },
};

if (isDebug) {
  // In debug mode, create two completely separate loggers to avoid configuration conflicts.
  // This is the most robust way to handle multiple outputs in a complex build environment.

  // 1. A logger exclusively for the pretty console output.
  const consoleLogger = pino({ level: 'debug' }, pretty({
    colorize: true,
    levelFirst: true,
    ignore: 'pid,hostname', // Keep the console output clean.
  }));

  // 2. A logger exclusively for the simplified file output.
  const fileLogger = pino({
    level: 'info', // We typically don't need 'debug' level in files.
    formatters: {
      bindings: () => ({}), // Removes pid, hostname from the file log.
      level: () => ({}),    // Removes the 'level' from the file log.
      ...fileLogFormatter,   // Applies our custom message formatter.
    },
  }, pino.destination({ dest: './app.log', mkdir: true, sync: false }));
  
  // 3. Create a proxy logger that calls both.
  // This is a safe way to write to both destinations without them interfering.
  logger = {
    ...consoleLogger, // Base the logger on the console one.
    // Override log methods to call both.
    info: (obj: any, msg?: string) => {
      consoleLogger.info(obj, msg);
      fileLogger.info(obj, msg);
    },
    warn: (obj: any, msg?: string) => {
      consoleLogger.warn(obj, msg);
      fileLogger.warn(obj, msg);
    },
    error: (obj: any, msg?: string) => {
      consoleLogger.error(obj, msg);
      fileLogger.error(obj, msg);
    },
    debug: (obj: any, msg?: string) => {
      // We only log debug messages to the console to keep the file log clean.
      consoleLogger.debug(obj, msg);
    },
    fatal: (obj: any, msg?: string) => {
      consoleLogger.fatal(obj, msg);
      fileLogger.fatal(obj, msg);
    },
    trace: (obj: any, msg?: string) => {
      // Trace is console-only.
      consoleLogger.trace(obj, msg);
    },
  } as pino.Logger;

  logger.info('🚀 Logger initialized (debug: pretty console + simple file)');

} else {
  // In production, we only need the simple file logger.
  logger = pino({
    level: 'info',
    formatters: {
      bindings: () => ({}), // Removes pid, hostname.
      level: () => ({}),    // Removes level.
      ...fileLogFormatter,
    },
  }, pino.destination({ dest: './app.log', mkdir: true, sync: false }));
  
  logger.info('📝 Logger initialized (production: simple file only)');
}

export default logger;

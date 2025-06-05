import pino from 'pino';
import { createWriteStream } from 'fs';

const isDevelopment = process.env.NODE_ENV === 'development';

// Create a simple file stream for logging
const logFile = createWriteStream('./app.log', { flags: 'a' });

// Custom pretty formatter for console (Turbopack-compatible)
const prettyStream = {
  write: (chunk: string) => {
    try {
      const log = JSON.parse(chunk);
      const time = new Date(log.time).toLocaleTimeString();
      const levelEmojis: Record<number, string> = {
        10: '🔍',
        20: '🐛', 
        30: '📝',
        40: '⚠️',
        50: '❌',
        60: '💥'
      };
      const emoji = levelEmojis[log.level] || '📝';
      const msg = log.msg || 'No message';
      
      // Pretty format for console
      console.log(`${time} ${emoji} ${msg}`);
      
      // Add metadata if present
      if (Object.keys(log).some(key => !['level', 'time', 'msg', 'pid', 'hostname'].includes(key))) {
        const metadata = Object.fromEntries(
          Object.entries(log).filter(([key]) => !['level', 'time', 'msg', 'pid', 'hostname'].includes(key))
        );
        console.log(`    📊 ${JSON.stringify(metadata, null, 2).split('\n').slice(1, -1).join('\n    ')}`);
      }
    } catch {
      // If parsing fails, just output raw
      process.stdout.write(chunk);
    }
  }
};

// Create multistream logger
const logger = pino({
  level: isDevelopment ? 'trace' : 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
}, pino.multistream([
  // Pretty console output using custom formatter
  {
    level: 'trace',
    stream: prettyStream
  },
  // JSON file output 
  {
    level: 'trace',
    stream: logFile
  }
]));

// Test message
if (isDevelopment) {
  logger.info('🚀 Logger initialized with custom pretty console + JSON file');
}

export default logger; 
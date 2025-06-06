import pino from 'pino';
import { createWriteStream } from 'fs';

const isDevelopment = process.env.NODE_ENV === 'development';
// Add a specific flag for AI debugging to avoid interfering with other logs
const isAiDebugging = process.env.AI_DEBUG === 'true' || process.env.PINO_DEBUG === 'true';

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

// Create conditional streams based on debugging mode
const createStreams = () => {
  const streams = [];
  
  // Always log to file in development
  if (isDevelopment) {
    streams.push({
      level: 'trace',
      stream: logFile
    });
  }
  
  // Only add custom console formatting when explicitly debugging AI
  if (isAiDebugging) {
    streams.push({
      level: 'trace',
      stream: prettyStream
    });
  }
  
  return streams;
};

// Create logger with conditional streams
const streams = createStreams();
const logger = streams.length > 0 
  ? pino({
      level: isDevelopment ? 'trace' : 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
    }, pino.multistream(streams))
  : pino({
      level: isDevelopment ? 'trace' : 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
    });

// Test message only when AI debugging is enabled
if (isAiDebugging) {
  logger.info('🚀 Logger initialized with custom pretty console + JSON file');
} else if (isDevelopment) {
  logger.info('📝 Logger initialized (file logging only - set AI_DEBUG=true for console formatting)');
}

export default logger; 
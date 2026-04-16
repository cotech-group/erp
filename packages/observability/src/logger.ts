import pino from 'pino';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export type Logger = pino.Logger;

export function createLogger(service: string, level?: string): Logger {
  return pino({
    name: service,
    level: level ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service },
  });
}

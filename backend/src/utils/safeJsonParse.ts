import { createLogger } from './logger';

const log = createLogger('safeJsonParse');

export function safeJsonParse<T>(json: string, fallback: T, context: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    log.error({ err: error, context }, `Failed to parse JSON for ${context}`);
    return fallback;
  }
}

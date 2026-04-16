import { randomUUID } from 'crypto';

/**
 * W3C Trace Context simplified implementation.
 * Generates and parses traceparent header.
 * Format: {version}-{traceId}-{spanId}-{flags}
 */
export class TraceContext {
  readonly traceId: string;
  readonly spanId: string;

  constructor(traceId?: string, spanId?: string) {
    this.traceId = traceId ?? randomUUID().replace(/-/g, '');
    this.spanId = spanId ?? randomUUID().replace(/-/g, '').slice(0, 16);
  }

  /**
   * Parse a W3C traceparent header.
   * Format: 00-{traceId}-{spanId}-{flags}
   */
  static fromHeader(traceparent?: string): TraceContext {
    if (!traceparent) {
      return new TraceContext();
    }

    const parts = traceparent.split('-');
    if (parts.length >= 3) {
      return new TraceContext(parts[1], parts[2]);
    }

    return new TraceContext();
  }

  toHeader(): string {
    return `00-${this.traceId}-${this.spanId}-01`;
  }
}

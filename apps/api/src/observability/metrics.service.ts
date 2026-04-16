import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry: Registry;
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly httpRequestErrors: Counter;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service: 'ina-api' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'] as const,
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'] as const,
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors (4xx and 5xx)',
      labelNames: ['method', 'path', 'status_code'] as const,
      registers: [this.registry],
    });
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordRequest(method: string, path: string, statusCode: number, durationMs: number) {
    const normalizedPath = this.normalizePath(path);
    const labels = { method, path: normalizedPath, status_code: String(statusCode) };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationMs / 1000);

    if (statusCode >= 400) {
      this.httpRequestErrors.inc(labels);
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Normalize paths to avoid high-cardinality labels.
   * /api/v1/media/abc-123 -> /api/v1/media/:id
   */
  private normalizePath(path: string): string {
    return path.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id',
    );
  }
}

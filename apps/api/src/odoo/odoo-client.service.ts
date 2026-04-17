import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
  timeout: number;
  maxRetries: number;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: 'call';
  id: number;
  params: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data: { message: string } };
}

export interface OdooCallParams {
  model: string;
  method: string;
  args: unknown[];
  kwargs?: Record<string, unknown>;
  traceId?: string;
}

@Injectable()
export class OdooClientService implements OnModuleInit {
  private readonly logger = new Logger(OdooClientService.name);
  private config!: OdooConfig;
  private uid: number | null = null;
  private requestId = 0;

  // Circuit breaker state
  private failures = 0;
  private lastFailure = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 30_000; // 30s

  onModuleInit() {
    this.config = {
      url: process.env['ODOO_URL'] || 'http://localhost:8069',
      db: process.env['ODOO_DB'] || 'ina_odoo',
      username: process.env['ODOO_USER'] || 'admin',
      password: process.env['ODOO_PASSWORD'] || 'admin',
      timeout: Number(process.env['ODOO_TIMEOUT']) || 10_000,
      maxRetries: Number(process.env['ODOO_MAX_RETRIES']) || 3,
    };
    this.logger.log(`Odoo client configured for ${this.config.url}/${this.config.db}`);
  }

  async authenticate(traceId?: string): Promise<number> {
    const result = await this.rpc<number>(
      '/web/session/authenticate',
      {
        db: this.config.db,
        login: this.config.username,
        password: this.config.password,
      },
      traceId,
    );

    if (!result || typeof result !== 'number') {
      throw new Error('Odoo authentication failed: invalid uid');
    }

    this.uid = result;
    this.logger.log({ traceId }, `Authenticated with Odoo as uid=${this.uid}`);
    return this.uid;
  }

  async call<T = unknown>(params: OdooCallParams): Promise<T> {
    if (!this.uid) {
      await this.authenticate(params.traceId);
    }

    return this.rpc<T>(
      '/web/dataset/call_kw',
      {
        model: params.model,
        method: params.method,
        args: params.args,
        kwargs: params.kwargs ?? {},
      },
      params.traceId,
    );
  }

  async searchRead<T = Record<string, unknown>>(
    model: string,
    domain: unknown[][] = [],
    fields: string[] = [],
    options: { limit?: number; offset?: number; order?: string } = {},
    traceId?: string,
  ): Promise<T[]> {
    return this.call<T[]>({
      model,
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields,
        limit: options.limit ?? 100,
        offset: options.offset ?? 0,
        order: options.order ?? 'id asc',
      },
      traceId,
    });
  }

  async read<T = Record<string, unknown>>(
    model: string,
    ids: number[],
    fields: string[] = [],
    traceId?: string,
  ): Promise<T[]> {
    return this.call<T[]>({
      model,
      method: 'read',
      args: [ids],
      kwargs: { fields },
      traceId,
    });
  }

  private async rpc<T>(path: string, params: Record<string, unknown>, traceId?: string): Promise<T> {
    this.checkCircuitBreaker();

    const url = `${this.config.url}${path}`;
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'call',
      id: ++this.requestId,
      params,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const start = Date.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(traceId ? { 'x-trace-id': traceId } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const duration = Date.now() - start;

        if (!response.ok) {
          throw new Error(`Odoo HTTP ${response.status}: ${response.statusText}`);
        }

        const json = (await response.json()) as JsonRpcResponse<T>;

        if (json.error) {
          throw new Error(`Odoo RPC error: ${json.error.data?.message || json.error.message}`);
        }

        this.onSuccess();
        this.logger.debug({ traceId, path, duration, attempt }, `Odoo RPC ${path} OK ${duration}ms`);

        return json.result as T;
      } catch (error) {
        const duration = Date.now() - start;
        lastError = error as Error;

        this.logger.warn(
          { traceId, path, duration, attempt, error: lastError.message },
          `Odoo RPC ${path} attempt ${attempt}/${this.config.maxRetries} failed ${duration}ms`,
        );

        if (attempt < this.config.maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    this.onFailure();
    throw lastError ?? new Error('Odoo RPC failed');
  }

  private checkCircuitBreaker() {
    if (this.failures >= this.failureThreshold) {
      const elapsed = Date.now() - this.lastFailure;
      if (elapsed < this.resetTimeout) {
        throw new Error(
          `Odoo circuit breaker open: ${this.failures} failures, retry in ${Math.ceil((this.resetTimeout - elapsed) / 1000)}s`,
        );
      }
      // Half-open: allow one attempt
      this.logger.warn('Odoo circuit breaker half-open, allowing retry');
    }
  }

  private onSuccess() {
    this.failures = 0;
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.logger.error(`Odoo circuit breaker OPEN after ${this.failures} failures`);
    }
  }
}

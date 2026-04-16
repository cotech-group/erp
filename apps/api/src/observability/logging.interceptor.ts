import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import type { Logger } from '@ina-erp/observability';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject('APP_LOGGER') private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const { method, originalUrl } = req;
    const traceId = req.traceContext?.traceId;
    const spanId = req.traceContext?.spanId;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.info(
            {
              traceId,
              spanId,
              method,
              url: originalUrl,
              statusCode: res.statusCode,
              duration,
            },
            `${method} ${originalUrl} ${res.statusCode} ${duration}ms`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - start;
          this.logger.error(
            {
              traceId,
              spanId,
              method,
              url: originalUrl,
              statusCode: res.statusCode,
              duration,
              error: error.message,
            },
            `${method} ${originalUrl} ERROR ${duration}ms`,
          );
        },
      }),
    );
  }
}

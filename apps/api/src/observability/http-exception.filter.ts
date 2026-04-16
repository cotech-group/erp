import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { Logger } from '@ina-erp/observability';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject('APP_LOGGER') private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const traceId = req.traceContext?.traceId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj['message'] as string) ?? message;
        code = (obj['error'] as string)?.toUpperCase().replace(/\s+/g, '_') ?? code;
        if (Array.isArray(obj['message'])) {
          details = { validation: obj['message'] };
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Map status to error code
    if (status === 400) code = 'VALIDATION_ERROR';
    if (status === 401) code = 'UNAUTHORIZED';
    if (status === 403) code = 'FORBIDDEN';
    if (status === 404) code = 'NOT_FOUND';
    if (status === 409) code = 'CONFLICT';
    if (status === 429) code = 'RATE_LIMITED';

    if (status >= 500) {
      this.logger.error(
        { traceId, statusCode: status, error: message, stack: (exception as Error)?.stack },
        `Unhandled exception: ${message}`,
      );
    }

    res.status(status).json({
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

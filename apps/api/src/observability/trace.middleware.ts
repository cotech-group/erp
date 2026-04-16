import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TraceContext } from '@ina-erp/observability';

declare global {
  namespace Express {
    interface Request {
      traceContext?: TraceContext;
    }
  }
}

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const traceparent = req.headers['traceparent'] as string | undefined;
    const ctx = TraceContext.fromHeader(traceparent);

    req.traceContext = ctx;

    // Propagate trace context in response headers
    res.setHeader('traceparent', ctx.toHeader());
    res.setHeader('x-trace-id', ctx.traceId);

    next();
  }
}

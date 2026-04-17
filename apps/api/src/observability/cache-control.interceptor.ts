import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';

export const CACHE_TTL_KEY = 'cache_ttl';
export const CacheTTL = (seconds: number) => SetMetadata(CACHE_TTL_KEY, seconds);

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const ttl = this.reflector.getAllAndOverride<number | undefined>(CACHE_TTL_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);

        if (ttl !== undefined) {
          const res = context.switchToHttp().getResponse<Response>();
          res.setHeader('Cache-Control', `private, max-age=${ttl}`);
        }
      }),
    );
  }
}

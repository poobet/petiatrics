import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiEnvelopeResponse<T> {
  data: T;
  meta: null;
  error: null;
}

/**
 * Wraps all successful controller responses in the standard API envelope:
 * { data: <payload>, meta: null, error: null }
 *
 * Paginated responses that already include a { data, meta, error } shape
 * are passed through as-is (detected by the presence of 'error' key === null).
 */
@Injectable()
export class EnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiEnvelopeResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelopeResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        // Already enveloped (e.g. PaginatedResponse from services)
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'data' in payload &&
          'error' in payload
        ) {
          return payload as unknown as ApiEnvelopeResponse<T>;
        }

        return {
          data: payload,
          meta: null,
          error: null,
        };
      }),
    );
  }
}

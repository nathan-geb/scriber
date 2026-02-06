import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Observable } from 'rxjs';

/**
 * Interceptor to add user and organization context to Sentry events and traces.
 * This runs after JwtAuthGuard, so request.user should be populated.
 */
@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user) {
      // Set user context
      Sentry.setUser({
        id: user.userId,
        email: user.email,
      });

      // Set custom tags for filtering
      if (user.organizationId) {
        Sentry.setTag('organization_id', user.organizationId);
      }
      Sentry.setTag('user_id', user.userId);

      // Add to context for more details
      Sentry.setContext('user_details', {
        organizationId: user.organizationId,
        roles: user.roles,
      });
    }

    return next.handle();
  }
}

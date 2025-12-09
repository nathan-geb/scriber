// Import with `import * as Sentry from "@sentry/nestjs"` if you are using ESM
import * as Sentry from '@sentry/nestjs';
// Profiling disabled due to missing native bindings
// import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Sentry initialization - should be called before any other imports
// Note: Configure SENTRY_DSN in .env file
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',

  integrations: [
    // Profiling disabled - native bindings not available
    // nodeProfilingIntegration(),
  ],

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Profiling (production only)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Set release version (optional: can be set via SENTRY_RELEASE env var)
  release:
    process.env.SENTRY_RELEASE ||
    `scriber-api@${process.env.npm_package_version || '1.0.0'}`,

  // Only send errors in production unless explicitly enabled
  enabled: !!process.env.SENTRY_DSN,

  // Before sending, filter out sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});

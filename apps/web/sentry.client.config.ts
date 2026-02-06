// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay for error debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Only enabled when DSN is set
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Debug in development
    debug: false,
});

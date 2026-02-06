import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  output: 'standalone',
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Suppresses source map uploading logs during build
  silent: true,

  // Upload source maps only in production
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps if auth token is available
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Tunnel route to avoid ad-blockers (optional)
  // tunnelRoute: "/monitoring",
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);

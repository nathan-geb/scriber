/**
 * Environment-aware configuration for EchoMint applications.
 * This provides centralized API URLs and other configuration values.
 */

// Detect environment - use __DEV__ for React Native compatibility
declare const __DEV__: boolean | undefined;
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
const isServer = typeof window === 'undefined';

/**
 * Get environment variable with fallback.
 * Works in both Node.js and browser environments.
 */
function getEnv(key: string, fallback: string): string {
    // Next.js public env vars
    if (typeof process !== 'undefined' && process.env) {
        const nextPublicKey = `NEXT_PUBLIC_${key}`;
        if (process.env[nextPublicKey]) {
            return process.env[nextPublicKey] as string;
        }
        if (process.env[key]) {
            return process.env[key] as string;
        }
    }

    // Expo env vars (via app.config.js extra)
    if (typeof globalThis !== 'undefined' && (globalThis as any).__expo_env__) {
        const expoEnv = (globalThis as any).__expo_env__;
        if (expoEnv[key]) {
            return expoEnv[key];
        }
    }

    return fallback;
}

/**
 * Application configuration
 */
export const config = {
    /**
     * Base URL for the API server
     */
    apiUrl: getEnv('API_URL', isDev ? 'http://localhost:3001/api/v1' : 'https://api.echomint.app/api/v1'),

    /**
     * WebSocket URL for real-time updates
     */
    wsUrl: getEnv('WS_URL', isDev ? 'ws://localhost:3001' : 'wss://api.echomint.app'),

    /**
     * Whether the app is running in development mode
     */
    isDev,

    /**
     * Whether code is running on server (SSR) or client
     */
    isServer,

    /**
     * Maximum file size for uploads (in bytes)
     */
    maxFileSize: 500 * 1024 * 1024, // 500MB

    /**
     * Supported audio file extensions
     */
    supportedAudioFormats: ['mp3', 'wav', 'm4a', 'ogg', 'webm'],

    /**
     * Supported audio MIME types
     */
    supportedAudioMimeTypes: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/m4a',
        'audio/x-m4a',
        'audio/ogg',
        'audio/webm',
    ],
} as const;

/**
 * Type-safe config object
 */
export type Config = typeof config;

/**
 * Helper to construct API endpoint URLs
 */
export function apiEndpoint(path: string): string {
    const base = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
}

/**
 * API endpoint constants for type safety
 */
export const API_ENDPOINTS = {
    // Auth
    AUTH_LOGIN: '/auth/login',
    AUTH_REGISTER: '/auth/register',
    AUTH_REFRESH: '/auth/refresh',
    AUTH_LOGOUT: '/auth/logout',

    // Users
    USERS_ME: '/users/me',
    USERS_USAGE: '/users/usage',
    USERS_PUSH_TOKEN: '/users/push-token',

    // Meetings
    MEETINGS: '/meetings',
    MEETING_BY_ID: (id: string) => `/meetings/${id}`,
    MEETING_STATUS: (id: string) => `/meetings/${id}/status`,

    // Uploads
    UPLOADS: '/uploads',

    // Transcriptions
    TRANSCRIPTIONS: '/transcriptions',

    // Minutes
    MINUTES_GENERATE: '/minutes/generate',
    MINUTES_BY_MEETING: (meetingId: string) => `/minutes/${meetingId}`,

    // Exports
    EXPORT_PDF: (meetingId: string) => `/exports/${meetingId}/pdf`,
    EXPORT_TEXT: (meetingId: string) => `/exports/${meetingId}/text`,
    EXPORT_DOCX: (meetingId: string) => `/exports/${meetingId}/docx`,

    // Admin
    ADMIN_STATS: '/admin/stats',
    ADMIN_USERS: '/admin/users',
} as const;

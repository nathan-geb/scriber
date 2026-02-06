import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { SnackbarProvider } from '../context/SnackbarContext';
import { ConfigProvider } from '../context/ConfigContext';
import { SocketProvider } from '../context/SocketContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Initialize Sentry with error handling
try {
    Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,

        // Environment
        environment: __DEV__ ? 'development' : 'production',

        // Performance Monitoring
        tracesSampleRate: __DEV__ ? 1.0 : 0.1,

        // Only enable when DSN is set
        enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,

        // Enable native crash handling
        enableNativeCrashHandling: true,

        // Debug in development
        debug: false,
    });
} catch (error) {
    console.warn('Sentry initialization failed:', error);
}

function RootLayout() {
    return (
        <SafeAreaProvider>
            <SnackbarProvider>
                <ConfigProvider>
                    <AuthProvider>
                        <SocketProvider>
                            <Stack screenOptions={{ headerShown: false }}>
                                <Stack.Screen name="(tabs)" />
                                <Stack.Screen name="login" />
                                <Stack.Screen name="meeting/[id]" />
                            </Stack>
                            <StatusBar style="auto" />
                        </SocketProvider>
                    </AuthProvider>
                </ConfigProvider>
            </SnackbarProvider>
        </SafeAreaProvider>
    );
}

// Wrap with Sentry for error boundary
export default Sentry.wrap(RootLayout);

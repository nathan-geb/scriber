'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@echomint/core';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';

interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (tokens: AuthTokens, user: User) => void;
    logout: () => void;
    isLoading: boolean;
    refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Refresh token 1 minute before expiry
const REFRESH_BUFFER_SECONDS = 60;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleRefreshRef = useRef<((expiresIn: number) => void) | null>(null);

    const clearRefreshTimeout = useCallback(() => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = null;
        }
    }, []);

    // Cookie helpers for middleware auth check
    const setCookie = (name: string, value: string, days: number = 7) => {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    };

    const deleteCookie = (name: string) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    };

    const logout = useCallback(() => {
        clearRefreshTimeout();
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        deleteCookie('token');
        setToken(null);
        setUser(null);
        router.push('/login');
    }, [router, clearRefreshTimeout]);

    const refreshAccessToken = useCallback(async (): Promise<boolean> => {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            logout();
            return false;
        }

        try {
            const res = await fetch(apiEndpoint(API_ENDPOINTS.AUTH_REFRESH), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (!res.ok) {
                logout();
                return false;
            }

            const data = await res.json();

            // Update tokens
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setCookie('token', data.access_token);

            setToken(data.access_token);
            setUser(data.user);

            // Schedule next refresh using ref
            scheduleRefreshRef.current?.(data.expires_in);

            return true;
        } catch {
            logout();
            return false;
        }
    }, [logout]);

    const scheduleTokenRefresh = useCallback((expiresIn: number) => {
        clearRefreshTimeout();

        // Schedule refresh before token expires
        const refreshTime = (expiresIn - REFRESH_BUFFER_SECONDS) * 1000;
        if (refreshTime > 0) {
            refreshTimeoutRef.current = setTimeout(() => {
                void refreshAccessToken();
            }, refreshTime);
        }
    }, [clearRefreshTimeout, refreshAccessToken]);

    // Keep ref updated in effect
    useEffect(() => {
        scheduleRefreshRef.current = scheduleTokenRefresh;
    }, [scheduleTokenRefresh]);

    const login = useCallback((tokens: AuthTokens, newUser: User) => {
        localStorage.setItem('token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        localStorage.setItem('user', JSON.stringify(newUser));
        setCookie('token', tokens.access_token);
        setToken(tokens.access_token);
        setUser(newUser);
        scheduleTokenRefresh(tokens.expires_in);
        router.push('/dashboard');
    }, [router, scheduleTokenRefresh]);

    // Load session from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedRefreshToken = localStorage.getItem('refresh_token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedRefreshToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                // Refresh token on app load to ensure it's valid
                refreshAccessToken();
            } catch (e) {
                // Corrupted user data in localStorage - clear and let user re-login
                console.error('Failed to parse stored user data, clearing session:', e);
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user');
            }
        }
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearRefreshTimeout();
    }, [clearRefreshTimeout]);

    return (
        <AuthContext.Provider
            value={{ user, token, login, logout, isLoading, refreshAccessToken }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

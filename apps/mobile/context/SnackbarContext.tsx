import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { theme } from '@echomint/core';

// ===========================
// Types
// ===========================

export type SnackbarType = 'success' | 'error' | 'warning' | 'info';

export interface Snackbar {
    id: string;
    type: SnackbarType;
    message: string;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface SnackbarContextType {
    show: (snackbar: Omit<Snackbar, 'id'>) => void;
    success: (message: string, action?: Snackbar['action']) => void;
    error: (message: string, action?: Snackbar['action']) => void;
    warning: (message: string, action?: Snackbar['action']) => void;
    info: (message: string, action?: Snackbar['action']) => void;
    hide: () => void;
}

// ===========================
// Context
// ===========================

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

// ===========================
// Provider
// ===========================

const DEFAULT_DURATION = 4000;

export function SnackbarProvider({ children }: { children: ReactNode }) {
    const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));
    const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const hide = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 50,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setSnackbar(null);
        });
    }, [fadeAnim, slideAnim]);

    const show = useCallback((newSnackbar: Omit<Snackbar, 'id'>) => {
        // Clear existing timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }

        const id = `snackbar-${Date.now()}`;
        const snackbarWithId: Snackbar = {
            id,
            duration: DEFAULT_DURATION,
            ...newSnackbar,
        };

        setSnackbar(snackbarWithId);

        // Animate in
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
            }),
        ]).start();

        // Auto-hide
        if (snackbarWithId.duration && snackbarWithId.duration > 0) {
            hideTimeoutRef.current = setTimeout(() => {
                hide();
            }, snackbarWithId.duration);
        }
    }, [fadeAnim, slideAnim, hide]);

    const success = useCallback((message: string, action?: Snackbar['action']) => {
        show({ type: 'success', message, action });
    }, [show]);

    const error = useCallback((message: string, action?: Snackbar['action']) => {
        show({ type: 'error', message, action, duration: 6000 }); // Errors stay longer
    }, [show]);

    const warning = useCallback((message: string, action?: Snackbar['action']) => {
        show({ type: 'warning', message, action });
    }, [show]);

    const info = useCallback((message: string, action?: Snackbar['action']) => {
        show({ type: 'info', message, action });
    }, [show]);

    const getBackgroundColor = (type: SnackbarType) => {
        switch (type) {
            case 'success': return theme.colors.success;
            case 'error': return theme.colors.danger;
            case 'warning': return theme.colors.warning;
            case 'info': return theme.colors.primary;
            default: return theme.colors.secondary;
        }
    };

    return (
        <SnackbarContext.Provider value={{ show, success, error, warning, info, hide }}>
            {children}
            {snackbar && (
                <Animated.View
                    style={[
                        styles.container,
                        {
                            backgroundColor: getBackgroundColor(snackbar.type),
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <View style={styles.content}>
                        <Text style={styles.message} numberOfLines={2}>
                            {snackbar.message}
                        </Text>
                        {snackbar.action && (
                            <TouchableOpacity onPress={snackbar.action.onPress} style={styles.actionButton}>
                                <Text style={styles.actionText}>{snackbar.action.label}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={hide} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}
        </SnackbarContext.Provider>
    );
}

// ===========================
// Hook
// ===========================

export function useSnackbar() {
    const context = useContext(SnackbarContext);
    if (!context) {
        throw new Error('useSnackbar must be used within a SnackbarProvider');
    }
    return context;
}

// ===========================
// Styles
// ===========================

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 90 : 70,
        left: 16,
        right: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    message: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    actionButton: {
        marginLeft: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 6,
    },
    actionText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    closeButton: {
        marginLeft: 8,
        padding: 4,
    },
    closeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
    },
});

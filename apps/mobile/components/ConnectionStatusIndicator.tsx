import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@echomint/core';
import { useSocketContext } from '../context/SocketContext';

/**
 * A small indicator showing socket connection status.
 * Shows green dot when connected, red dot with message when disconnected.
 */
export function ConnectionStatusIndicator() {
    const { isConnected } = useSocketContext();

    // Only show when disconnected
    if (isConnected) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.dot} />
            <Text style={styles.text}>Reconnecting...</Text>
        </View>
    );
}

/**
 * A compact version that just shows a colored dot in the header
 */
export function ConnectionDot() {
    const { isConnected } = useSocketContext();

    return (
        <View
            style={[
                styles.compactDot,
                { backgroundColor: isConnected ? theme.colors.success : theme.colors.danger },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.danger,
    },
    text: {
        fontSize: 12,
        color: theme.colors.danger,
        fontWeight: '500',
    },
    compactDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});

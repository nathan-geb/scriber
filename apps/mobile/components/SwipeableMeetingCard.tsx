import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@echomint/core';

interface SwipeableMeetingCardProps {
    children: React.ReactNode;
    onDelete?: () => void;
    onPreview?: () => void;
}

export function SwipeableMeetingCard({
    children,
    onDelete,
    onPreview,
}: SwipeableMeetingCardProps) {
    const renderLeftActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const scale = dragX.interpolate({
            inputRange: [0, 80],
            outputRange: [0.5, 1],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity
                style={styles.leftAction}
                onPress={onPreview}
            >
                <Animated.View style={{ transform: [{ scale }] }}>
                    <Ionicons name="eye" size={24} color="#fff" />
                    <Text style={styles.actionText}>Preview</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    const renderRightActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const scale = dragX.interpolate({
            inputRange: [-80, 0],
            outputRange: [1, 0.5],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity
                style={styles.rightAction}
                onPress={onDelete}
            >
                <Animated.View style={{ transform: [{ scale }] }}>
                    <Ionicons name="trash" size={24} color="#fff" />
                    <Text style={styles.actionText}>Delete</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Swipeable
            renderLeftActions={onPreview ? renderLeftActions : undefined}
            renderRightActions={onDelete ? renderRightActions : undefined}
            leftThreshold={40}
            rightThreshold={40}
        >
            {children}
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    leftAction: {
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        marginBottom: 12,
        borderRadius: 12,
        marginRight: -12,
    },
    rightAction: {
        backgroundColor: theme.colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        marginBottom: 12,
        borderRadius: 12,
        marginLeft: -12,
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
});

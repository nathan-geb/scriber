import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { theme } from '@echomint/core';

interface AudioWaveformProps {
    isRecording: boolean;
    numBars?: number;
}

export function AudioWaveform({ isRecording, numBars = 7 }: AudioWaveformProps) {
    const animations = useRef<Animated.Value[]>(
        Array.from({ length: numBars }, () => new Animated.Value(0.3))
    ).current;

    useEffect(() => {
        if (isRecording) {
            // Start animations for each bar with staggered timing
            animations.forEach((anim, index) => {
                const loop = Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 0.3 + Math.random() * 0.7, // Random height
                            duration: 200 + Math.random() * 300,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: false,
                        }),
                        Animated.timing(anim, {
                            toValue: 0.2 + Math.random() * 0.3,
                            duration: 200 + Math.random() * 300,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: false,
                        }),
                    ])
                );
                setTimeout(() => loop.start(), index * 50);
            });
        } else {
            // Reset all bars when not recording
            animations.forEach((anim) => {
                Animated.timing(anim, {
                    toValue: 0.3,
                    duration: 200,
                    useNativeDriver: false,
                }).start();
            });
        }

        return () => {
            animations.forEach((anim) => anim.stopAnimation());
        };
    }, [isRecording, animations]);

    return (
        <View style={styles.container}>
            {animations.map((anim, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.bar,
                        {
                            height: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['20%', '100%'],
                            }),
                            backgroundColor: isRecording
                                ? theme.colors.danger
                                : theme.colors.primary,
                        },
                    ]}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        gap: 6,
        marginBottom: 30,
    },
    bar: {
        width: 6,
        borderRadius: 3,
        minHeight: 12,
    },
});

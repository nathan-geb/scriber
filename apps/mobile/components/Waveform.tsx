import { View, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { theme } from '@echomint/core';

interface WaveformProps {
    isRecording: boolean;
}

export function Waveform({ isRecording }: WaveformProps) {
    // Create an array of animated values for the bars
    const BAR_COUNT = 20;
    const animations = useRef([...Array(BAR_COUNT)].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        if (isRecording) {
            const loops = animations.map((anim) => {
                const duration = 300 + Math.random() * 500;
                const sequence = Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: duration,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: duration,
                        useNativeDriver: true,
                    })
                ]);
                const loop = Animated.loop(sequence);
                loop.start();
                return loop;
            });

            return () => {
                loops.forEach(loop => loop.stop());
            };
        } else {
            // Reset to 0 when not recording
            animations.forEach(anim => {
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            });
        }
    }, [isRecording]);

    return (
        <View style={styles.container}>
            {animations.map((anim, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.bar,
                        {
                            height: 24, // Base height
                            transform: [{
                                scaleY: anim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.2, 1.0 + Math.random() * 1.5] // Random height scaling
                                })
                            }],
                            opacity: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.5, 1]
                            })
                        }
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
        height: 100,
        gap: 4,
    },
    bar: {
        width: 4,
        backgroundColor: theme.colors.primary,
        borderRadius: 2,
    }
});

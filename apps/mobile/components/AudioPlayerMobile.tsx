import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { theme } from '@echomint/core';
import { Ionicons } from '@expo/vector-icons';

interface AudioPlayerProps {
    audioUrl: string;
    token: string | null;
}

export function AudioPlayerMobile({ audioUrl, token }: AudioPlayerProps) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const loadAndPlay = async () => {
        if (!token) {
            Alert.alert('Error', 'Not authenticated. Please log in again.');
            return;
        }

        try {
            if (sound) {
                if (isPlaying) {
                    await sound.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await sound.playAsync();
                    setIsPlaying(true);
                }
                return;
            }

            setIsLoading(true);
            setError(null);

            // Configure audio mode for background playback
            await Audio.setAudioModeAsync({
                staysActiveInBackground: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Load the audio with auth header
            const { sound: newSound } = await Audio.Sound.createAsync(
                {
                    uri: audioUrl,
                    headers: { Authorization: `Bearer ${token}` },
                },
                { shouldPlay: true },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
            setIsPlaying(true);
        } catch (err: any) {
            console.error('Failed to load audio:', err);
            setError('Failed to load audio');
            Alert.alert('Audio Error', 'Could not play audio. The file may not be available.');
        } finally {
            setIsLoading(false);
        }
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            setPosition(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
            if (status.didJustFinish) {
                setIsPlaying(false);
            }
        }
    };

    const seekBack = async () => {
        if (sound) {
            const newPosition = Math.max(0, position - 10000);
            await sound.setPositionAsync(newPosition);
        }
    };

    const seekForward = async () => {
        if (sound) {
            const newPosition = Math.min(duration, position + 10000);
            await sound.setPositionAsync(newPosition);
        }
    };

    const progress = duration > 0 ? (position / duration) * 100 : 0;

    return (
        <View style={styles.container}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>

            {/* Time display */}
            <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity onPress={seekBack} style={styles.controlButton}>
                    <Ionicons name="play-back" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={loadAndPlay}
                    style={[styles.playButton, error && styles.playButtonError]}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={theme.colors.surface} size="small" />
                    ) : (
                        <Ionicons
                            name={isPlaying ? "pause" : "play"}
                            size={28}
                            color={theme.colors.surface}
                        />
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={seekForward} style={styles.controlButton}>
                    <Ionicons name="play-forward" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
            </View>

            {error && (
                <Text style={styles.errorText}>{error}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    progressContainer: {
        height: 4,
        backgroundColor: theme.colors.border,
        borderRadius: 2,
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 2,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    timeText: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
    },
    controlButton: {
        padding: 12,
    },
    controlText: {
        color: theme.colors.textMuted,
        fontSize: 14,
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButtonText: {
        fontSize: 24,
        color: theme.colors.surface,
    },
    playButtonError: {
        backgroundColor: theme.colors.danger,
    },
    errorText: {
        fontSize: 12,
        color: theme.colors.danger,
        textAlign: 'center',
        marginTop: 8,
    },
});

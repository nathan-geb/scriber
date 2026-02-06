import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { theme } from '@echomint/core';

interface RecordingScreenProps {
    onRecordingComplete?: (uri: string) => void;
    onUpload?: (uri: string) => Promise<void>;
}

export function RecordingScreen({ onRecordingComplete, onUpload }: RecordingScreenProps) {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant microphone access to record.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);
            setDuration(0);
            setRecordingUri(null);

            // Start timer
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
            Alert.alert('Error', 'Failed to start recording');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        try {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

            const uri = recording.getURI();
            setRecording(null);
            setIsRecording(false);
            setRecordingUri(uri);

            if (uri) {
                onRecordingComplete?.(uri);
            }
        } catch (err) {
            console.error('Failed to stop recording:', err);
            Alert.alert('Error', 'Failed to stop recording');
        }
    };

    const handleUpload = async () => {
        if (!recordingUri || !onUpload) return;

        setIsUploading(true);
        try {
            await onUpload(recordingUri);
            setRecordingUri(null);
            setDuration(0);
            Alert.alert('Success', 'Recording uploaded successfully!');
        } catch (err) {
            console.error('Upload failed:', err);
            Alert.alert('Error', 'Failed to upload recording');
        } finally {
            setIsUploading(false);
        }
    };

    const discardRecording = () => {
        setRecordingUri(null);
        setDuration(0);
    };

    return (
        <View style={styles.container}>
            {/* Timer Display */}
            <View style={styles.timerContainer}>
                <Text style={styles.timer}>{formatTime(duration)}</Text>
                {isRecording && (
                    <View style={styles.recordingIndicator}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>Recording</Text>
                    </View>
                )}
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {!recordingUri ? (
                    <TouchableOpacity
                        style={[styles.button, isRecording ? styles.stopButton : styles.recordButton]}
                        onPress={isRecording ? stopRecording : startRecording}
                    >
                        <Text style={styles.buttonText}>
                            {isRecording ? 'Stop' : 'Start Recording'}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.postRecordControls}>
                        <TouchableOpacity
                            style={[styles.button, styles.discardButton]}
                            onPress={discardRecording}
                            disabled={isUploading}
                        >
                            <Text style={styles.buttonText}>Discard</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.uploadButton]}
                            onPress={handleUpload}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Upload</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    timerContainer: {
        alignItems: 'center',
        marginBottom: 60,
    },
    timer: {
        fontSize: 72,
        fontWeight: '200',
        color: theme.colors.textMain,
        fontVariant: ['tabular-nums'],
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EF4444',
        marginRight: 8,
    },
    recordingText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '500',
    },
    controls: {
        width: '100%',
        alignItems: 'center',
    },
    button: {
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 12,
        minWidth: 160,
        alignItems: 'center',
    },
    recordButton: {
        backgroundColor: theme.colors.primary,
    },
    stopButton: {
        backgroundColor: '#EF4444',
    },
    uploadButton: {
        backgroundColor: theme.colors.primary,
        flex: 1,
        marginLeft: 8,
    },
    discardButton: {
        backgroundColor: theme.colors.textMuted,
        flex: 1,
        marginRight: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    postRecordControls: {
        flexDirection: 'row',
        width: '100%',
    },
});

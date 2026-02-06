import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { theme } from '@echomint/core';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { Ionicons } from '@expo/vector-icons';
import { Waveform } from '../../components/Waveform';
import { useChunkedUpload } from '../../hooks/useChunkedUpload';

export default function RecordScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { apiUrl } = useConfig();

    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [durationMillis, setDurationMillis] = useState(0);

    // Chunked upload hook
    const {
        isUploading,
        progress,
        status: uploadStatus,
        error: uploadError,
        uploadChunked,
        cancelUpload,
        resetState: resetUploadState,
    } = useChunkedUpload();

    // Timer ref
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => { });
            }
        };
    }, []);

    async function startRecording() {
        try {
            if (permissionResponse?.status !== 'granted') {
                const permission = await requestPermission();
                if (!permission.granted) {
                    Alert.alert("Permission required", "Microphone access is needed to record meetings.");
                    return;
                }
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('Starting recording..');
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            console.log('Recording started');

            setDurationMillis(0);
            intervalRef.current = setInterval(() => {
                setDurationMillis(prev => prev + 1000);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Failed to start recording');
        }
    }

    async function stopRecording() {
        if (!recording) return;

        console.log('Stopping recording..');
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;

        setRecording(null);
        await recording.stopAndUnloadAsync();

        // Visual feedback
        setDurationMillis(0);

        const uri = recording.getURI();
        if (uri) {
            uploadRecording(uri);
        }
    }

    async function cancelRecording() {
        if (!recording) return;

        Alert.alert(
            "Discard Recording?",
            "This will delete the current recording.",
            [
                { text: "Keep Recording", style: "cancel" },
                {
                    text: "Discard",
                    style: "destructive",
                    onPress: async () => {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        intervalRef.current = null;
                        setRecording(null);
                        try {
                            await recording.stopAndUnloadAsync();
                        } catch (e) { }
                        setDurationMillis(0);
                    }
                }
            ]
        );
    }

    async function uploadRecording(uri: string) {
        try {
            const result = await uploadChunked(uri);

            Alert.alert('Success', 'Meeting uploaded. Processing started.', [
                { text: 'Go to Meeting', onPress: () => router.push(`/meeting/${result.meetingId}`) },
                { text: 'Done', style: 'cancel', onPress: () => resetUploadState() }
            ]);
        } catch (error: any) {
            console.error('Upload failed', error);
            Alert.alert('Upload Failed', error.message || 'Could not upload recording');
            resetUploadState();
        }
    }

    function handleCancelUpload() {
        Alert.alert(
            "Cancel Upload?",
            "This will stop the current upload.",
            [
                { text: "Continue Upload", style: "cancel" },
                {
                    text: "Cancel",
                    style: "destructive",
                    onPress: () => cancelUpload()
                }
            ]
        );
    }

    const formatDuration = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            {/* Dynamic Island Status Pill */}
            <View style={styles.statusPillContainer}>
                {recording ? (
                    <View style={styles.statusPill}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.statusText}>{formatDuration(durationMillis)}</Text>
                        <View style={styles.separator} />
                        <Text style={styles.statusDetail}>High Quality</Text>
                    </View>
                ) : (
                    <Text style={styles.headerTitle}>New Recording</Text>
                )}
            </View>


            <View style={styles.content}>
                <View style={styles.visualizerContainer}>
                    <Waveform isRecording={!!recording} />
                </View>

                {isUploading ? (
                    <View style={styles.uploadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={styles.uploadingText}>
                            {uploadStatus === 'initiating' ? 'Starting upload...' :
                                uploadStatus === 'completing' ? 'Finishing up...' :
                                    `Uploading: ${progress}%`}
                        </Text>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${progress}%` }]} />
                        </View>
                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelUpload}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.controlsContainer}>
                        {recording && (
                            <TouchableOpacity style={styles.secondaryBtn} onPress={cancelRecording}>
                                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.recordButton, recording ? styles.recording : styles.notRecording]}
                            onPress={recording ? stopRecording : startRecording}
                        >
                            <View style={recording ? styles.stopIcon : styles.micIcon}>
                                <Ionicons
                                    name={recording ? "stop" : "mic"}
                                    size={recording ? 32 : 48}
                                    color="#fff"
                                />
                            </View>
                        </TouchableOpacity>

                        {recording && (
                            <View style={styles.placeholderBtn} /> // For symmetry
                        )}
                    </View>
                )}

                <Text style={styles.instruction}>
                    {recording ? 'Recording in progress...' : 'Tap to start recording'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: 60,
    },
    statusPillContainer: {
        alignItems: 'center',
        marginBottom: 40,
        height: 48,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textMain,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
        gap: 8,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.danger,
    },
    statusText: {
        color: '#fff',
        fontVariant: ['tabular-nums'],
        fontWeight: '600',
    },
    separator: {
        width: 1,
        height: 12,
        backgroundColor: '#333',
    },
    statusDetail: {
        color: '#888',
        fontSize: 12,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 80,
    },
    visualizerContainer: {
        flex: 1,
        justifyContent: 'center',
        width: '100%',
    },
    timer: {
        fontSize: 64,
        fontWeight: '300',
        color: theme.colors.textMain,
        marginBottom: 60,
        fontVariant: ['tabular-nums'],
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
    },
    secondaryBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.shadows.sm.shadowColor,
        shadowOffset: theme.shadows.sm.shadowOffset,
        shadowOpacity: theme.shadows.sm.shadowOpacity,
        shadowRadius: theme.shadows.sm.shadowRadius,
        elevation: theme.shadows.sm.elevation,
    },
    placeholderBtn: {
        width: 50,
        height: 50,
    },
    recordButton: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    micIcon: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopIcon: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notRecording: {
        backgroundColor: theme.colors.primary,
    },
    recording: {
        backgroundColor: theme.colors.danger,
        transform: [{ scale: 1.1 }], // Make it slightly larger when recording
    },
    instruction: {
        marginTop: 32,
        color: theme.colors.textMuted,
        fontSize: 16,
    },
    uploadingContainer: {
        alignItems: 'center',
        height: 180,
        justifyContent: 'center',
    },
    uploadingText: {
        marginTop: 16,
        color: theme.colors.primary,
        fontSize: 16,
        fontWeight: '500',
    },
    progressBarContainer: {
        width: '80%',
        height: 6,
        backgroundColor: theme.colors.surface,
        borderRadius: 3,
        marginTop: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 3,
    },
    cancelButton: {
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
    },
    cancelButtonText: {
        color: theme.colors.textMuted,
        fontSize: 14,
        fontWeight: '500',
    },
});

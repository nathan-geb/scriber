import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@echomint/core';
import { Ionicons } from '@expo/vector-icons';
import { useSocketContext } from '../context/SocketContext';

type PipelineStep = 'upload' | 'transcription' | 'minutes' | 'done';
type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

interface PipelineProgressProps {
    meetingId: string;
    initialStatus?: string;
    compact?: boolean;
    onComplete?: () => void;
}

const STEPS: { key: PipelineStep; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'upload', label: 'Upload', icon: 'cloud-upload' },
    { key: 'transcription', label: 'Transcribe', icon: 'document-text' },
    { key: 'minutes', label: 'Minutes', icon: 'list' },
    { key: 'done', label: 'Done', icon: 'checkmark-circle' },
];

// Map socket step names to meeting status
const stepToStatusMap: Record<string, string> = {
    'upload': 'UPLOADED',
    'transcription': 'PROCESSING_TRANSCRIPT',
    'minutes': 'PROCESSING_MINUTES',
    'done': 'COMPLETED',
};

function getStepStatusFromMeetingStatus(
    stepKey: PipelineStep,
    meetingStatus: string
): StepStatus {
    const statusMap: Record<string, number> = {
        'UPLOADED': 1,
        'PROCESSING_TRANSCRIPT': 2,
        'TRANSCRIPT_READY': 2,
        'PROCESSING_MINUTES': 3,
        'COMPLETED': 4,
        'FAILED': -1,
    };

    const stepIndex: Record<PipelineStep, number> = {
        'upload': 1,
        'transcription': 2,
        'minutes': 3,
        'done': 4,
    };

    const currentProgress = statusMap[meetingStatus] || 0;
    const thisStep = stepIndex[stepKey];

    if (meetingStatus === 'FAILED') {
        return thisStep <= currentProgress ? 'failed' : 'pending';
    }
    if (currentProgress >= thisStep) {
        return 'completed';
    }
    if (currentProgress === thisStep - 1) {
        return 'active';
    }
    return 'pending';
}

export function PipelineProgressMobile({
    meetingId,
    initialStatus = 'UPLOADED',
    compact = false,
    onComplete,
}: PipelineProgressProps) {
    const [currentStatus, setCurrentStatus] = useState(initialStatus);
    const { socket, isConnected } = useSocketContext();

    // Listen for real-time socket events
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleJobStep = (data: { meetingId: string; step: string; status: string }) => {
            if (data.meetingId === meetingId) {
                const newStatus = stepToStatusMap[data.step] || data.status;
                setCurrentStatus(newStatus);
            }
        };

        const handleJobComplete = (data: { meetingId: string; status: string }) => {
            if (data.meetingId === meetingId) {
                setCurrentStatus(data.status === 'FAILED' ? 'FAILED' : 'COMPLETED');
            }
        };

        socket.on('job:step', handleJobStep);
        socket.on('job:complete', handleJobComplete);

        return () => {
            socket.off('job:step', handleJobStep);
            socket.off('job:complete', handleJobComplete);
        };
    }, [socket, isConnected, meetingId]);

    useEffect(() => {
        if (currentStatus === 'COMPLETED' || currentStatus === 'FAILED') {
            onComplete?.();
        }
    }, [currentStatus, onComplete]);

    const getStepColor = (status: StepStatus) => {
        switch (status) {
            case 'completed':
                return theme.colors.success;
            case 'active':
                return theme.colors.primary;
            case 'failed':
                return theme.colors.danger;
            default:
                return theme.colors.border;
        }
    };

    if (compact) {
        // Compact: horizontal row of icons
        return (
            <View style={styles.compactContainer}>
                {STEPS.map((step, index) => {
                    const status = getStepStatusFromMeetingStatus(step.key, currentStatus);
                    const color = getStepColor(status);
                    return (
                        <React.Fragment key={step.key}>
                            <View style={[styles.compactStep, { borderColor: color }]}>
                                <Ionicons
                                    name={step.icon}
                                    size={16}
                                    color={color}
                                />
                            </View>
                            {index < STEPS.length - 1 && (
                                <View
                                    style={[
                                        styles.compactConnector,
                                        { backgroundColor: status === 'completed' ? theme.colors.success : theme.colors.border },
                                    ]}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </View>
        );
    }

    // Full: vertical timeline
    return (
        <View style={styles.container}>
            {STEPS.map((step, index) => {
                const status = getStepStatusFromMeetingStatus(step.key, currentStatus);
                const color = getStepColor(status);
                return (
                    <View key={step.key} style={styles.stepRow}>
                        <View style={styles.iconColumn}>
                            <View style={[styles.stepCircle, { borderColor: color, backgroundColor: status === 'completed' ? color : 'transparent' }]}>
                                <Ionicons
                                    name={step.icon}
                                    size={20}
                                    color={status === 'completed' ? '#fff' : color}
                                />
                            </View>
                            {index < STEPS.length - 1 && (
                                <View
                                    style={[
                                        styles.connector,
                                        { backgroundColor: status === 'completed' ? theme.colors.success : theme.colors.border },
                                    ]}
                                />
                            )}
                        </View>
                        <View style={styles.labelColumn}>
                            <Text style={[styles.stepLabel, { color: status === 'pending' ? theme.colors.textMuted : theme.colors.textMain }]}>
                                {step.label}
                            </Text>
                            {status === 'active' && (
                                <Text style={styles.activeHint}>Processing...</Text>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconColumn: {
        alignItems: 'center',
        width: 40,
    },
    stepCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    connector: {
        width: 2,
        height: 24,
        marginVertical: 4,
    },
    labelColumn: {
        flex: 1,
        paddingLeft: 12,
        justifyContent: 'center',
        minHeight: 36,
    },
    stepLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    activeHint: {
        fontSize: 12,
        color: theme.colors.primary,
        marginTop: 2,
    },
    // Compact styles
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactStep: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactConnector: {
        width: 16,
        height: 2,
    },
});

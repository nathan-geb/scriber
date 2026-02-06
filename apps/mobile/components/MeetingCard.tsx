import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '@echomint/core';
import { Ionicons } from '@expo/vector-icons';
import type { Meeting } from '@echomint/core';

interface MeetingCardProps {
    meeting: Meeting;
    onPress: () => void;
}

export function MeetingCard({ meeting, onPress }: MeetingCardProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return theme.colors.success;
            case 'FAILED': return theme.colors.danger;
            case 'PROCESSING_TRANSCRIPT':
            case 'PROCESSING_MINUTES': return theme.colors.warning;
            default: return theme.colors.primary;
        }
    };

    const getStatusLabel = (status: string) => {
        return status.replace(/_/g, ' ').toLowerCase();
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        return `${mins}m`;
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.card}
        >
            <View style={styles.iconContainer}>
                <Ionicons name="document-text" size={22} color={theme.colors.primary} />
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title} numberOfLines={1}>
                        {meeting.title || 'Untitled Meeting'}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
                </View>

                <View style={styles.meta}>
                    <View style={[styles.badge, { backgroundColor: getStatusColor(meeting.status) + '15' }]}>
                        <View style={[styles.dot, { backgroundColor: getStatusColor(meeting.status) }]} />
                        <Text style={[styles.badgeText, { color: getStatusColor(meeting.status) }]}>
                            {getStatusLabel(meeting.status)}
                        </Text>
                    </View>

                    <View style={styles.details}>
                        <View style={styles.detailItem}>
                            <Ionicons name="calendar-outline" size={12} color={theme.colors.textMuted} />
                            <Text style={styles.detailText}>{formatDate(meeting.createdAt)}</Text>
                        </View>

                        {meeting.durationSeconds ? (
                            <View style={styles.detailItem}>
                                <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                                <Text style={styles.detailText}>{formatDuration(meeting.durationSeconds)}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        // Enhanced shadow
        shadowColor: theme.shadows.md.shadowColor,
        shadowOffset: theme.shadows.md.shadowOffset,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: theme.colors.borderLight || theme.colors.border + '50',
    },
    iconContainer: {
        width: 46,
        height: 46,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.primary50 || theme.colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.textMain,
        flex: 1,
        marginRight: 8,
        letterSpacing: -0.3,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: theme.radius.sm,
        gap: 5,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    details: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 12,
        color: theme.colors.textMuted,
        fontWeight: '500',
    },
});

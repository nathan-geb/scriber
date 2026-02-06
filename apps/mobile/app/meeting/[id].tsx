import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList, Share, Linking, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { theme } from '@echomint/core';
import { AudioPlayerMobile } from '../../components/AudioPlayerMobile';
import { PipelineProgressMobile } from '../../components/PipelineProgressMobile';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function MeetingDetail() {
    const { id } = useLocalSearchParams();
    const { token } = useAuth();
    const { apiUrl } = useConfig();
    const router = useRouter();

    const [meeting, setMeeting] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'minutes' | 'transcript'>('transcript');

    // Speaker editing state
    const [editingSpeaker, setEditingSpeaker] = useState<any>(null);
    const [newSpeakerName, setNewSpeakerName] = useState('');
    const [showSpeakerModal, setShowSpeakerModal] = useState(false);
    const [savingSpeaker, setSavingSpeaker] = useState(false);

    useEffect(() => {
        if (id && token) {
            fetchMeeting();
        }
    }, [id, token]);

    const fetchMeeting = async () => {
        try {
            const res = await fetch(`${apiUrl}/meetings/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            // If processing, check status endpoint for progress
            if (data.status === 'processing') {
                const statusRes = await fetch(`${apiUrl}/meetings/${id}/status`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const statusData = await statusRes.json();
                if (statusData.job) {
                    data.job = statusData.job;
                }
            }

            setMeeting(data);
            if (data.minutes) {
                setEditedContent(data.minutes.content);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load meeting details');
        } finally {
            setLoading(false);
        }
    };

    // Polling effect
    useEffect(() => {
        let interval: any;

        if (meeting?.status === 'processing') {
            interval = setInterval(() => {
                fetchMeeting();
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [meeting?.status]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${apiUrl}/minutes/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: editedContent }),
            });

            if (!res.ok) throw new Error('Failed to save');

            const updatedMinutes = await res.json();
            setMeeting({ ...meeting, minutes: updatedMinutes });
            setIsEditing(false);
            Alert.alert('Success', 'Minutes saved successfully');

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save minutes');
        } finally {
            setSaving(false);
        }
    };

    const handleShare = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/shares`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    meetingId: id,
                    shareType: 'FULL',
                    expiresInHours: 72 // Default 3 days
                })
            });

            if (!res.ok) throw new Error('Failed to create share link');

            const data = await res.json();
            const shareUrl = data.shareUrl;

            await Share.share({
                title: `Meeting: ${meeting.title}`,
                message: `Check out the minutes for "${meeting.title}": ${shareUrl}`,
                url: shareUrl, // iOS only
            });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to share meeting');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'docx' | 'pdf' | 'txt' | 'md') => {
        try {
            setLoading(true);
            const filename = `meeting-${id}.${format}`;
            const fileUri = FileSystem.documentDirectory + filename;
            const downloadUrl = `${apiUrl}/exports/${id}/${format}`;

            const downloadRes = await FileSystem.downloadAsync(
                downloadUrl,
                fileUri,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (downloadRes.status !== 200) {
                throw new Error('Download failed');
            }

            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert('Error', 'Sharing is not available on this device');
                return;
            }

            await Sharing.shareAsync(downloadRes.uri);
        } catch (error) {
            console.error('Export failed:', error);
            Alert.alert('Error', 'Failed to download and share file');
        } finally {
            setLoading(false);
        }
    };

    const handleSpeakerPress = (speaker: any) => {
        setEditingSpeaker(speaker);
        setNewSpeakerName(speaker.name || 'Unknown');
        setShowSpeakerModal(true);
    };

    const handleRenameSpeaker = async () => {
        if (!editingSpeaker || !newSpeakerName.trim()) return;

        setSavingSpeaker(true);
        try {
            const res = await fetch(`${apiUrl}/meetings/${id}/speakers/${editingSpeaker.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newSpeakerName.trim() }),
            });

            if (res.ok) {
                await fetchMeeting(); // Refresh to show new name
                setShowSpeakerModal(false);
                Alert.alert('Success', `Speaker renamed to "${newSpeakerName.trim()}"`);
            } else {
                throw new Error('Failed to rename');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to rename speaker');
        } finally {
            setSavingSpeaker(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (!meeting) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Meeting not found</Text>
            </View>
        );
    }

    // Helper to extract clean text from potentially JSON-wrapped content
    const extractCleanText = (text: string): string => {
        if (!text) return '';
        // Check if it starts with JSON markers
        if (text.startsWith('```json') || text.startsWith('[{') || text.startsWith('{')) {
            try {
                // Try to parse as JSON array
                let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                if (jsonStr.startsWith('[')) {
                    const parsed = JSON.parse(jsonStr);
                    if (Array.isArray(parsed)) {
                        return parsed.map((item: any) => item.text || '').join('\n\n');
                    }
                }
            } catch {
                // Not valid JSON, return as-is but strip markdown code blocks
                return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            }
        }
        return text;
    };

    const renderTranscriptItem = ({ item, index }: { item: any; index: number }) => {
        const cleanText = extractCleanText(item.text);
        const speakerName = item.speaker?.name || item.speakerLabel || 'Speaker';
        const timestamp = item.startTime ?
            new Date(item.startTime * 1000).toISOString().substr(14, 5) :
            '0:00';

        // Color palette for different speakers
        const speakerColors = [
            { bg: theme.colors.primary50 || '#EEF2FF', text: theme.colors.primary },
            { bg: '#ECFDF5', text: '#059669' },
            { bg: '#FDF4FF', text: '#9333EA' },
            { bg: '#FFF7ED', text: '#EA580C' },
        ];

        const colorIndex = (item.speaker?.id?.charCodeAt?.(0) || index) % speakerColors.length;
        const colors = speakerColors[colorIndex];

        return (
            <View style={styles.transcriptItem}>
                {/* Header row: Speaker badge + Timestamp */}
                <View style={styles.transcriptHeader}>
                    <TouchableOpacity
                        style={[styles.speakerBadge, { backgroundColor: colors.bg }]}
                        onPress={() => item.speaker && handleSpeakerPress(item.speaker)}
                        disabled={!item.speaker}
                    >
                        <View style={[styles.speakerDot, { backgroundColor: colors.text }]} />
                        <Text style={[styles.speakerName, { color: colors.text }]}>{speakerName}</Text>
                        {item.speaker && <Ionicons name="pencil" size={12} color={colors.text} style={{ opacity: 0.5 }} />}
                    </TouchableOpacity>
                    <Text style={styles.timestamp}>{timestamp}</Text>
                </View>
                {/* Transcript text */}
                <Text style={styles.transcriptText}>{cleanText}</Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backIconButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.textMain} />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>Meeting Details</Text>
                <TouchableOpacity onPress={handleShare}>
                    <Ionicons name="share-outline" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.contentContainer}>
                <Text style={styles.meetingTitle}>{meeting.title}</Text>
                <Text style={styles.date}>{new Date(meeting.createdAt).toLocaleDateString()}</Text>

                <AudioPlayerMobile
                    audioUrl={`${apiUrl}/meetings/${meeting.id}/audio`}
                    token={token}
                />

                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'minutes' && styles.activeTab]}
                        onPress={() => setActiveTab('minutes')}
                    >
                        <Text style={[styles.tabText, activeTab === 'minutes' && styles.activeTabText]}>Minutes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'transcript' && styles.activeTab]}
                        onPress={() => setActiveTab('transcript')}
                    >
                        <Text style={[styles.tabText, activeTab === 'transcript' && styles.activeTabText]}>Transcript</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'minutes' ? (
                    <View style={{ flex: 1 }}>
                        {meeting.minutes ? (
                            isEditing ? (
                                <View style={{ flex: 1 }}>
                                    <View style={styles.editToolbar}>
                                        <TouchableOpacity onPress={() => setIsEditing(false)}>
                                            <Text style={styles.cancelButton}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={handleSave} disabled={saving}>
                                            <Text style={styles.saveButton}>{saving ? 'Saving...' : 'Save'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        multiline
                                        value={editedContent}
                                        onChangeText={setEditedContent}
                                        placeholder="Edit minutes..."
                                        textAlignVertical="top"
                                    />
                                </View>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    <View style={styles.viewToolbar}>
                                        <TouchableOpacity onPress={() => setIsEditing(true)}>
                                            <Text style={styles.editButton}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.scrollView}>
                                        <Markdown style={markdownStyles}>
                                            {meeting.minutes.content}
                                        </Markdown>
                                    </ScrollView>
                                </View>
                            )
                        ) : (
                            <View style={styles.placeholderContainer}>
                                {meeting.status === 'processing' || meeting.status === 'PROCESSING_TRANSCRIPT' || meeting.status === 'PROCESSING_MINUTES' ? (
                                    <PipelineProgressMobile
                                        meetingId={meeting.id}
                                        initialStatus={meeting.status.toUpperCase()}
                                        onComplete={fetchMeeting}
                                    />
                                ) : (
                                    <Text style={styles.placeholderText}>
                                        No minutes generated yet.
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        {meeting.transcript && meeting.transcript.length > 0 ? (
                            <FlatList
                                data={meeting.transcript}
                                renderItem={renderTranscriptItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 24 }}
                            />
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <Text style={styles.placeholderText}>No transcript available.</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Export Actions */}
                <View style={styles.exportContainer}>
                    <Text style={styles.exportTitle}>Export</Text>
                    <View style={styles.exportButtons}>
                        <TouchableOpacity
                            style={styles.exportButton}
                            onPress={() => handleExport('pdf')}
                        >
                            <Ionicons name="document" size={20} color={theme.colors.primary} />
                            <Text style={styles.exportButtonText}>PDF</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.exportButton}
                            onPress={() => handleExport('docx')}
                        >
                            <Ionicons name="document-text" size={20} color={theme.colors.primary} />
                            <Text style={styles.exportButtonText}>Word</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.exportButton}
                            onPress={() => handleExport('md')}
                        >
                            <Ionicons name="logo-markdown" size={20} color={theme.colors.primary} />
                            <Text style={styles.exportButtonText}>MD</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.exportButton}
                            onPress={() => handleShare()}
                        >
                            <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.exportButtonText}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Speaker Edit Modal */}
            <Modal
                visible={showSpeakerModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSpeakerModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSpeakerModal(false)}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={() => { }}
                    >
                        <Text style={styles.modalTitle}>Rename Speaker</Text>
                        <Text style={styles.modalSubtitle}>
                            Current: {editingSpeaker?.name || 'Unknown'}
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newSpeakerName}
                            onChangeText={setNewSpeakerName}
                            placeholder="Enter new name"
                            autoFocus
                            selectTextOnFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setShowSpeakerModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSaveButton, savingSpeaker && styles.modalButtonDisabled]}
                                onPress={handleRenameSpeaker}
                                disabled={savingSpeaker}
                            >
                                {savingSpeaker ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.modalSaveText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: 60,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        color: theme.colors.textMuted,
        fontSize: 16,
    },
    backIconButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textMain,
        flex: 1,
        textAlign: 'center',
    },
    contentContainer: {
        flex: 1,
        padding: 24,
        paddingBottom: 0,
    },
    meetingTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.textMain,
        marginBottom: 4,
    },
    date: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginBottom: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: theme.colors.primary,
    },
    tabText: {
        fontSize: 16,
        color: theme.colors.textMuted,
        fontWeight: '500',
    },
    activeTabText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.textMain,
        textAlignVertical: 'top',
        padding: 12,
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 24,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: theme.colors.textMuted,
        textAlign: 'center',
        fontSize: 16,
    },
    errorText: {
        color: 'red',
        fontSize: 18,
        textAlign: 'center',
    },
    transcriptItem: {
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    transcriptHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    speakerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: theme.radius.sm,
        gap: 6,
    },
    speakerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    speakerName: {
        fontSize: 13,
        fontWeight: '600',
    },
    timestamp: {
        fontSize: 12,
        color: theme.colors.textMuted,
        fontFamily: 'monospace',
    },
    transcriptText: {
        fontSize: 15,
        color: theme.colors.textMain,
        lineHeight: 24,
    },
    viewToolbar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 8,
    },
    editToolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    editButton: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    saveButton: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    cancelButton: {
        color: theme.colors.textMuted,
    },
    exportContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    exportTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.textMuted,
        marginBottom: 12,
    },
    exportButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    exportButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    exportButtonText: {
        color: theme.colors.primary,
        fontWeight: '500',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 320,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textMain,
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginBottom: 16,
    },
    modalInput: {
        backgroundColor: theme.colors.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 12,
        fontSize: 16,
        color: theme.colors.textMain,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    modalCancelText: {
        color: theme.colors.textMuted,
        fontWeight: '500',
    },
    modalSaveButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
    },
    modalSaveText: {
        color: 'white',
        fontWeight: '600',
    },
    modalButtonDisabled: {
        opacity: 0.6,
    },
});

const markdownStyles = {
    body: {
        color: theme.colors.textMain,
        fontSize: 16,
        lineHeight: 24,
    },
    heading1: {
        color: theme.colors.textMain,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    heading2: {
        color: theme.colors.textMain,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    bullet_list: {
        marginBottom: 10,
    },
    ordered_list: {
        marginBottom: 10,
    },
};

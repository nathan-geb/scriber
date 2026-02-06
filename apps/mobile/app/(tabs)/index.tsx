import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { theme } from '@echomint/core';
import type { Meeting } from '@echomint/core';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeetingCard } from '../../components/MeetingCard';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            return;
        }

        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (projectId) {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            }
        } catch (e) {
            console.error(e);
        }
    }

    return token;
}

export default function HomeScreen() {
    const { user, token } = useAuth();
    const { apiUrl } = useConfig();
    const router = useRouter();

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Fetch unread count
    useEffect(() => {
        if (token && apiUrl) {
            const fetchUnread = async () => {
                try {
                    const res = await fetch(`${apiUrl}/notifications/unread-count`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    setUnreadCount(data.count);
                } catch (e) { console.error(e); }
            };
            fetchUnread();
            // Poll every 30s
            const interval = setInterval(fetchUnread, 30000);
            return () => clearInterval(interval);
        }
    }, [token, apiUrl]);

    useEffect(() => {
        if (token && user) {
            registerForPushNotificationsAsync().then(pushToken => {
                if (pushToken && apiUrl) {
                    fetch(`${apiUrl}/users/push-token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ token: pushToken })
                    }).catch(console.error);
                }
            });
        }
    }, [token, user, apiUrl]);

    const fetchMeetings = useCallback(async (isRefresh = false, isLoadMore = false) => {
        if (!token || !apiUrl) return;
        if (isLoadMore && !nextCursor) return;

        try {
            const url = new URL(`${apiUrl}/meetings`);
            if (searchQuery) {
                url.searchParams.set('search', searchQuery);
            }
            if (isLoadMore && nextCursor) {
                url.searchParams.set('cursor', nextCursor);
            }
            url.searchParams.set('limit', '20');

            if (isLoadMore) {
                setLoadingMore(true);
            } else if (!isRefresh) {
                setLoading(true); // Initial load
            }

            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            let newItems: Meeting[] = [];
            let newCursor: string | null = null;

            if ((data as any).items) {
                newItems = (data as any).items;
                newCursor = (data as any).nextCursor || null;
            } else if (Array.isArray(data)) {
                newItems = data;
            }

            if (isLoadMore) {
                setMeetings((prev: Meeting[]) => [...prev, ...newItems]);
            } else {
                setMeetings(newItems);
                // Cache initial page
                AsyncStorage.setItem('meetings_cache', JSON.stringify(newItems)).catch(console.error);
            }

            setNextCursor(newCursor);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [token, apiUrl, searchQuery, nextCursor]);

    useEffect(() => {
        // Load cache first
        AsyncStorage.getItem('meetings_cache').then(data => {
            if (data && !meetings.length) {
                setMeetings(JSON.parse(data));
            }
        });

        if (token) {
            fetchMeetings();
        }
    }, [token, searchQuery]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchMeetings(true);
        setRefreshing(false);
    }, [fetchMeetings]);

    const onEndReached = () => {
        if (!loadingMore && nextCursor) {
            fetchMeetings(false, true);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getGreeting()},</Text>
                    <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/notifications')}
                    style={styles.notificationBtn}
                >
                    <Ionicons name="notifications-outline" size={24} color={theme.colors.textMain} />
                    {unreadCount > 0 && (
                        <View style={styles.badge} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search meetings..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Content */}
            {loading && !refreshing && meetings.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={meetings}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={theme.colors.primary}
                        />
                    }
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.5}
                    ListHeaderComponent={
                        <Text style={styles.sectionTitle}>Recent Meetings</Text>
                    }
                    ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 10 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="mic-outline" size={64} color={theme.colors.textMuted} />
                            <Text style={styles.empty}>No meetings found</Text>
                            <Text style={styles.emptyHint}>Tap the microphone to start recording</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <MeetingCard
                            meeting={item}
                            onPress={() => router.push(`/meeting/${item.id}`)}
                        />
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    greeting: {
        fontSize: 15,
        color: theme.colors.textMuted,
        fontWeight: '500',
        marginBottom: 2,
    },
    userName: {
        fontSize: 26,
        fontWeight: 'bold',
        color: theme.colors.textMain,
        letterSpacing: -0.5,
    },
    notificationBtn: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        // Shadow
        shadowColor: theme.shadows.sm.shadowColor,
        shadowOffset: theme.shadows.sm.shadowOffset,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    badge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.colors.danger,
        borderWidth: 2,
        borderColor: theme.colors.surface,
    },
    searchContainer: {
        marginHorizontal: 24,
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 50,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.shadows.sm.shadowColor,
        shadowOffset: theme.shadows.sm.shadowOffset,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.textMain,
        height: '100%',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textMain,
        marginBottom: 16,
        marginLeft: 4,
        letterSpacing: -0.3,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: theme.colors.primary50 || theme.colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    empty: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.textMain,
    },
    emptyHint: {
        fontSize: 15,
        color: theme.colors.textMuted,
        marginTop: 8,
        textAlign: 'center',
    }
});

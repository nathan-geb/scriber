import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { theme } from '@echomint/core';
import { Ionicons } from '@expo/vector-icons';

interface Notification {
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export default function NotificationsScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { apiUrl } = useConfig();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = async () => {
        try {
            const res = await fetch(`${apiUrl}/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.notifications) {
                setNotifications(data.notifications);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchNotifications();
        }
    }, [token]);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

        try {
            await fetch(`${apiUrl}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error(error);
        }
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        try {
            await fetch(`${apiUrl}/notifications/read-all`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error(error);
        }
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.item, !item.read && styles.unreadItem]}
            onPress={() => markAsRead(item.id)}
        >
            <View style={styles.itemHeader}>
                <Text style={[styles.itemTitle, !item.read && styles.unreadText]}>{item.title}</Text>
                {!item.read && <View style={styles.dot} />}
            </View>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString()} • {new Date(item.createdAt).toLocaleTimeString()}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={styles.actionButton}>Read All</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        fetchNotifications();
                    }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={styles.emptyText}>No notifications</Text>
                        </View>
                    }
                    contentContainerStyle={notifications.length === 0 && styles.center}
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
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        color: theme.colors.textMuted,
        fontSize: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textMain,
    },
    actionButton: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    item: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
    },
    unreadItem: {
        backgroundColor: `${theme.colors.primary}10`, // 10% opacity
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.textMain,
    },
    unreadText: {
        color: theme.colors.primary,
    },
    message: {
        fontSize: 14,
        color: theme.colors.textMain,
        marginBottom: 8,
    },
    date: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.primary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyText: {
        color: theme.colors.textMuted,
        fontSize: 16,
    }
});

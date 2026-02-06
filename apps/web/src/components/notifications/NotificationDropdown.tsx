import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';
import { useRouter } from 'next/navigation';

interface Notification {
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    type: string;
    meetingId?: string;
}

export function NotificationDropdown() {
    const { token } = useAuth();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Poll for unread count
    useEffect(() => {
        if (!token) return;

        const fetchUnread = async () => {
            try {
                const res = await fetch(apiEndpoint(API_ENDPOINTS.USERS_ME) + '/notifications/unread-count', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.count);
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchUnread();
        const interval = setInterval(fetchUnread, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [token]);

    // Fetch notifications when opening
    useEffect(() => {
        if (isOpen && token) {
            const loadNotifications = async () => {
                setLoading(true);
                try {
                    const res = await fetch(apiEndpoint(API_ENDPOINTS.USERS_ME) + '/notifications', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    setNotifications(data?.notifications || []);
                    setUnreadCount(data?.unreadCount ?? 0);
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoading(false);
                }
            };
            loadNotifications();
        }
    }, [isOpen, token]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const markAsRead = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await fetch(apiEndpoint(API_ENDPOINTS.USERS_ME) + `/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error(e);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch(apiEndpoint(API_ENDPOINTS.USERS_ME) + '/notifications/read-all', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error(e);
        }
    };

    const deleteNotification = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(apiEndpoint(API_ENDPOINTS.USERS_ME) + `/notifications/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        if (notification.meetingId) {
            router.push(`/meetings/${notification.meetingId}`);
            setIsOpen(false);
        }
    };

    // Grouping Logic
    const groupedNotifications = React.useMemo(() => {
        const groups: Record<string, Notification[]> = {
            'Today': [],
            'Yesterday': [],
            'Earlier': []
        };

        notifications.forEach(n => {
            const date = new Date(n.createdAt);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                groups['Today'].push(n);
            } else if (date.toDateString() === yesterday.toDateString()) {
                groups['Yesterday'].push(n);
            } else {
                groups['Earlier'].push(n);
            }
        });

        // Filter out empty groups
        return Object.entries(groups).filter((entry) => entry[1].length > 0);
    }, [notifications]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full transition-colors"
                title="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-surface">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-background-secondary/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-text-main">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-text-muted hover:text-primary transition-colors flex items-center gap-1"
                            >
                                <Check size={14} /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[450px] overflow-y-auto">
                        {loading && notifications.length === 0 ? (
                            <div className="p-8 text-center text-text-muted text-sm">
                                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-12 text-center text-text-muted">
                                <Bell size={32} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            <div className="pb-2">
                                {groupedNotifications.map(([group, items]) => (
                                    <div key={group}>
                                        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm p-3 text-xs font-semibold text-text-muted border-b border-border/50 z-10">
                                            {group}
                                        </div>
                                        <div className="divide-y divide-border/50">
                                            {items.map(notification => (
                                                <div
                                                    key={notification.id}
                                                    onClick={() => handleNotificationClick(notification)}
                                                    className={`p-4 hover:bg-surface-hover transition-colors cursor-pointer relative group flex gap-3 ${!notification.read ? 'bg-primary/[0.03]' : ''}`}
                                                >
                                                    {/* Status Dot */}
                                                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!notification.read ? 'bg-primary' : 'bg-border'}`} />

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`text-sm mb-1 ${!notification.read ? 'font-semibold text-text-main' : 'font-medium text-text-secondary'}`}>
                                                            {notification.title}
                                                        </h4>
                                                        <p className="text-xs text-text-muted line-clamp-2 mb-2">
                                                            {notification.message}
                                                        </p>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] text-text-muted">
                                                                {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            {notification.meetingId && (
                                                                <span className="text-[10px] font-medium text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    View Meeting <ArrowRight size={10} />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <button
                                                        onClick={(e) => deleteNotification(notification.id, e)}
                                                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all self-start"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


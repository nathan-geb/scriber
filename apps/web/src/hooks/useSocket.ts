import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from '@echomint/core';
import { useAuth } from '../context/AuthContext';

export interface JobProgress {
    jobId: string;
    meetingId: string;
    type: 'transcription' | 'minutes';
    status: 'processing' | 'generating' | 'completed' | 'failed';
    progress: number;
    error?: string;
}

export function useSocket() {
    const { token } = useAuth(); // Removed unused 'user'
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Effect to manage connection - reconnect when token changes
    useEffect(() => {
        if (!token) return;

        // Use base API URL without /api/v1 suffix for WebSocket
        // Socket.io client expects http/https URL, it handles ws:// upgrades
        const socketUrl = config.apiUrl.replace('/api/v1', '');

        const newSocket = io(socketUrl, {
            auth: {
                token: token,
            },
            transports: ['websocket', 'polling'], // validation
            withCredentials: true,
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        newSocket.on('connect_error', () => { // Removed unused 'err'
            setIsConnected(false);
        });

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            setSocket(null);
            setIsConnected(false);
        };
    }, [token]);

    // Subscribe to meeting updates
    const subscribeToMeeting = useCallback((meetingId: string) => {
        if (socket) {
            socket.emit('subscribe:meeting', { meetingId });
        }
    }, [socket]);

    // Unsubscribe from meeting updates
    const unsubscribeFromMeeting = useCallback((meetingId: string) => {
        if (socket) {
            socket.emit('unsubscribe:meeting', { meetingId });
        }
    }, [socket]);

    return {
        socket,
        isConnected,
        subscribeToMeeting,
        unsubscribeFromMeeting,
    };
}

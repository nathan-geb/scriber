import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';

export interface JobProgress {
    jobId: string;
    meetingId: string;
    type: 'transcription' | 'minutes';
    status: 'processing' | 'generating' | 'completed' | 'failed';
    progress: number;
    error?: string;
}

export interface PipelineStep {
    meetingId: string;
    step: 'upload' | 'transcription' | 'minutes';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
}

export function useSocket() {
    const { token } = useAuth();
    const { apiUrl } = useConfig();
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectAttemptRef = useRef(0);
    const maxReconnectAttempts = 5;

    // Connect with exponential backoff
    const connect = useCallback(() => {
        if (!token || socketRef.current?.connected) return;

        // console.log('[Socket] Connecting to:', apiUrl);

        const socket = io(apiUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
        });

        socket.on('connect', () => {
            // console.log('[Socket] Connected', socket.id);
            setIsConnected(true);
            reconnectAttemptRef.current = 0;
        });

        socket.on('disconnect', (reason) => {
            // console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
            setIsConnected(false);
        });

        socketRef.current = socket;
    }, [token, apiUrl]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, []);

    // Effect to manage connection
    useEffect(() => {
        if (token) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [token, connect, disconnect]);

    // Subscribe to meeting updates
    const subscribeToMeeting = useCallback((meetingId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('subscribe:meeting', { meetingId });
        }
    }, []);

    // Unsubscribe from meeting updates
    const unsubscribeFromMeeting = useCallback((meetingId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('unsubscribe:meeting', { meetingId });
        }
    }, []);

    // Listen for pipeline step events
    const onPipelineStep = useCallback((callback: (step: PipelineStep) => void): (() => void) => {
        if (socketRef.current) {
            socketRef.current.on('job:step', callback);
            return () => {
                socketRef.current?.off('job:step', callback);
            };
        }
        return () => { };
    }, []);

    // Listen for pipeline complete events
    const onPipelineComplete = useCallback((callback: (data: { meetingId: string; status: string }) => void): (() => void) => {
        if (socketRef.current) {
            socketRef.current.on('job:complete', callback);
            return () => {
                socketRef.current?.off('job:complete', callback);
            };
        }
        return () => { };
    }, []);

    return {
        socket: socketRef.current,
        isConnected,
        subscribeToMeeting,
        unsubscribeFromMeeting,
        onPipelineStep,
        onPipelineComplete,
    };
}

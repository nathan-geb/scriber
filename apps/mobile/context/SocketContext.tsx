import React, { createContext, useContext, ReactNode } from 'react';
import { useSocket, PipelineStep } from '../hooks/useSocket';
import type { Socket } from 'socket.io-client';

interface SocketContextValue {
    socket: Socket | null;
    isConnected: boolean;
    subscribeToMeeting: (meetingId: string) => void;
    unsubscribeFromMeeting: (meetingId: string) => void;
    onPipelineStep: (callback: (step: PipelineStep) => void) => () => void;
    onPipelineComplete: (callback: (data: { meetingId: string; status: string }) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

interface SocketProviderProps {
    children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
    const socketState = useSocket();

    return (
        <SocketContext.Provider value={socketState}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocketContext() {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocketContext must be used within a SocketProvider');
    }
    return context;
}

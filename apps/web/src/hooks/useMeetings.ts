import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';

// Define Meeting interface locally or import it if available. 
// Based on usage, we define strict shape.
export interface Meeting {
    id: string;
    title: string;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UPLOADING' | 'UPLOADED' | 'PROCESSING_TRANSCRIPT' | 'PROCESSING_MINUTES' | 'CANCELLED';
    createdAt: string;
    duration?: string | number;
    durationSeconds?: number;
}

export function useMeetings() {
    const { token } = useAuth();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMeetings = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`${apiEndpoint(API_ENDPOINTS.MEETINGS)}?limit=20`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                // Handle both paginated and flat responses
                setMeetings(Array.isArray(data) ? data : (data.items || []));
            }
        } catch (error) {
            console.error('Failed to fetch meetings:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const deleteMeeting = useCallback(async (id: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${apiEndpoint(API_ENDPOINTS.MEETINGS)}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setMeetings(prev => prev.filter(m => m.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete meeting:', error);
        }
    }, [token]);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings]);

    return { meetings, loading, deleteMeeting, refresh: fetchMeetings };
}

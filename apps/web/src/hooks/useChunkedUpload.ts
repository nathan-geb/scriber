import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

interface ChunkedUploadState {
    uploadId: string | null;
    progress: number;
    totalChunks: number;
    uploadedChunks: number;
    isUploading: boolean;
    error: string | null;
    status: 'idle' | 'initiating' | 'uploading' | 'completing' | 'complete' | 'error';
}

interface ChunkedUploadResult {
    meetingId: string;
    jobId: string;
}

interface UseChunkedUploadOptions {
    chunkSize?: number;
    maxRetries?: number;
    retryDelay?: number;
}

export function useChunkedUpload(options: UseChunkedUploadOptions = {}) {
    const { chunkSize = DEFAULT_CHUNK_SIZE, maxRetries = 3, retryDelay = 1000 } = options;
    const { token } = useAuth();
    const abortControllerRef = useRef<AbortController | null>(null);

    const [state, setState] = useState<ChunkedUploadState>({
        uploadId: null,
        progress: 0,
        totalChunks: 0,
        uploadedChunks: 0,
        isUploading: false,
        error: null,
        status: 'idle',
    });

    const resetState = useCallback(() => {
        setState({
            uploadId: null,
            progress: 0,
            totalChunks: 0,
            uploadedChunks: 0,
            isUploading: false,
            error: null,
            status: 'idle',
        });
    }, []);

    const uploadWithRetry = useCallback(
        async (
            url: string,
            options: RequestInit,
            retries: number = maxRetries
        ): Promise<Response> => {
            try {
                const response = await fetch(url, options);
                if (!response.ok && retries > 0) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                    return uploadWithRetry(url, options, retries - 1);
                }
                return response;
            } catch (error) {
                if (retries > 0) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                    return uploadWithRetry(url, options, retries - 1);
                }
                throw error;
            }
        },
        [maxRetries, retryDelay]
    );

    const uploadChunked = useCallback(
        async (file: File, language?: string): Promise<ChunkedUploadResult> => {
            if (!token) {
                throw new Error('Not authenticated');
            }

            abortControllerRef.current = new AbortController();
            const { signal } = abortControllerRef.current;

            try {
                // Calculate chunks
                const totalChunks = Math.ceil(file.size / chunkSize);

                setState({
                    uploadId: null,
                    progress: 0,
                    totalChunks,
                    uploadedChunks: 0,
                    isUploading: true,
                    error: null,
                    status: 'initiating',
                });

                // Step 1: Initiate upload session
                const initResponse = await fetch(`${API_URL}/api/v1/uploads/chunked/initiate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        filename: file.name,
                        totalSize: file.size,
                        totalChunks,
                        mimeType: file.type || 'audio/mpeg',
                        language,
                    }),
                    signal,
                });

                if (!initResponse.ok) {
                    const error = await initResponse.json();
                    throw new Error(error.message || 'Failed to initiate upload');
                }

                const { uploadId } = await initResponse.json();

                setState((prev) => ({
                    ...prev,
                    uploadId,
                    status: 'uploading',
                }));

                // Step 2: Upload chunks
                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    if (signal.aborted) {
                        throw new Error('Upload cancelled');
                    }

                    const start = chunkIndex * chunkSize;
                    const end = Math.min(start + chunkSize, file.size);
                    const chunk = file.slice(start, end);

                    const formData = new FormData();
                    formData.append('chunk', chunk);

                    const chunkResponse = await uploadWithRetry(
                        `${API_URL}/api/v1/uploads/chunked/${uploadId}/chunk/${chunkIndex}`,
                        {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                            signal,
                        }
                    );

                    if (!chunkResponse.ok) {
                        const error = await chunkResponse.json();
                        throw new Error(error.message || `Failed to upload chunk ${chunkIndex}`);
                    }

                    const uploaded = chunkIndex + 1;
                    const progress = Math.round((uploaded / totalChunks) * 100);

                    setState((prev) => ({
                        ...prev,
                        uploadedChunks: uploaded,
                        progress,
                    }));
                }

                // Step 3: Complete upload
                setState((prev) => ({
                    ...prev,
                    status: 'completing',
                }));

                const completeResponse = await fetch(
                    `${API_URL}/api/v1/uploads/chunked/${uploadId}/complete`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ language }),
                        signal,
                    }
                );

                if (!completeResponse.ok) {
                    const error = await completeResponse.json();
                    throw new Error(error.message || 'Failed to complete upload');
                }

                const result: ChunkedUploadResult = await completeResponse.json();

                setState((prev) => ({
                    ...prev,
                    isUploading: false,
                    status: 'complete',
                    progress: 100,
                }));

                return result;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Upload failed';
                setState((prev) => ({
                    ...prev,
                    isUploading: false,
                    error: message,
                    status: 'error',
                }));
                throw error;
            }
        },
        [token, chunkSize, uploadWithRetry]
    );

    const cancelUpload = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        resetState();
    }, [resetState]);

    return {
        ...state,
        uploadChunked,
        cancelUpload,
        resetState,
    };
}

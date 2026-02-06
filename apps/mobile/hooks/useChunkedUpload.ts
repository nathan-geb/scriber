import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';

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
    const { apiUrl } = useConfig();
    const isCancelledRef = useRef<boolean>(false);

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
        isCancelledRef.current = false;
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

    const fetchWithRetry = useCallback(
        async (
            input: string,
            init?: RequestInit,
            retries: number = maxRetries
        ): Promise<Response> => {
            try {
                const response = await fetch(input, init);
                if (!response.ok && retries > 0) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                    return fetchWithRetry(input, init, retries - 1);
                }
                return response;
            } catch (error) {
                if (retries > 0) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                    return fetchWithRetry(input, init, retries - 1);
                }
                throw error;
            }
        },
        [maxRetries, retryDelay]
    );

    const uploadChunked = useCallback(
        async (fileUri: string, language?: string): Promise<ChunkedUploadResult> => {
            if (!token) {
                throw new Error('Not authenticated');
            }

            isCancelledRef.current = false;

            try {
                // Get file info
                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (!fileInfo.exists) {
                    throw new Error('File not found');
                }

                // Get file size - cast to access size property
                const fileSize = (fileInfo as FileSystem.FileInfo & { size?: number }).size || 0;
                if (fileSize === 0) {
                    throw new Error('File is empty');
                }

                const filename = fileUri.split('/').pop() || 'recording.m4a';
                const extension = filename.split('.').pop()?.toLowerCase() || 'm4a';
                const mimeType = `audio/${extension}`;
                const totalChunks = Math.ceil(fileSize / chunkSize);

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
                const initResponse = await fetch(`${apiUrl}/uploads/chunked/initiate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        filename,
                        totalSize: fileSize,
                        totalChunks,
                        mimeType,
                        language,
                    }),
                });

                if (!initResponse.ok) {
                    const errorData = await initResponse.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to initiate upload');
                }

                const { uploadId } = await initResponse.json();

                setState((prev: ChunkedUploadState) => ({
                    ...prev,
                    uploadId,
                    status: 'uploading' as const,
                }));

                // Step 2: Read file as base64 and split into chunks
                // Note: expo-file-system readAsStringAsync with encoding option
                const base64Content = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: 'base64',
                });

                // Calculate how many base64 characters per chunk
                // Base64 encodes 3 bytes into 4 characters
                const base64ChunkSize = Math.ceil((chunkSize * 4) / 3);

                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    if (isCancelledRef.current) {
                        throw new Error('Upload cancelled');
                    }

                    const start = chunkIndex * base64ChunkSize;
                    const chunkBase64 = base64Content.slice(start, start + base64ChunkSize);

                    // Upload chunk using FormData with base64 data URI
                    const formData = new FormData();
                    formData.append('chunk', {
                        uri: `data:${mimeType};base64,${chunkBase64}`,
                        name: `chunk_${chunkIndex}`,
                        type: 'application/octet-stream',
                    } as unknown as Blob);

                    const chunkResponse = await fetchWithRetry(
                        `${apiUrl}/uploads/chunked/${uploadId}/chunk/${chunkIndex}`,
                        {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                        }
                    );

                    if (!chunkResponse.ok) {
                        const errorData = await chunkResponse.json().catch(() => ({}));
                        throw new Error(errorData.message || `Failed to upload chunk ${chunkIndex}`);
                    }

                    const uploaded = chunkIndex + 1;
                    const progress = Math.round((uploaded / totalChunks) * 100);

                    setState((prev: ChunkedUploadState) => ({
                        ...prev,
                        uploadedChunks: uploaded,
                        progress,
                    }));
                }

                // Step 3: Complete upload
                setState((prev: ChunkedUploadState) => ({
                    ...prev,
                    status: 'completing' as const,
                }));

                const completeResponse = await fetch(
                    `${apiUrl}/uploads/chunked/${uploadId}/complete`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ language }),
                    }
                );

                if (!completeResponse.ok) {
                    const errorData = await completeResponse.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to complete upload');
                }

                const result: ChunkedUploadResult = await completeResponse.json();

                setState((prev: ChunkedUploadState) => ({
                    ...prev,
                    isUploading: false,
                    status: 'complete' as const,
                    progress: 100,
                }));

                return result;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Upload failed';
                setState((prev: ChunkedUploadState) => ({
                    ...prev,
                    isUploading: false,
                    error: message,
                    status: 'error' as const,
                }));
                throw error;
            }
        },
        [token, apiUrl, chunkSize, fetchWithRetry]
    );

    const cancelUpload = useCallback(() => {
        isCancelledRef.current = true;
        resetState();
    }, [resetState]);

    return {
        ...state,
        uploadChunked,
        cancelUpload,
        resetState,
    };
}

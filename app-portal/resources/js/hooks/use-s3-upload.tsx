import { useState } from 'react';

interface S3UploadResponse {
    key: string;
    signed_url: string;
}

interface UploadOptions {
    key?: string;
    expiresMinutes?: number;
    onProgress?: (progress: number) => void;
    onSuccess?: (response: S3UploadResponse) => void;
    onError?: (error: string) => void;
}

interface UploadState {
    uploading: boolean;
    progress: number;
    error: string | null;
    uploadedFile: S3UploadResponse | null;
}

export const useS3Upload = () => {
    const [uploadState, setUploadState] = useState<UploadState>({
        uploading: false,
        progress: 0,
        error: null,
        uploadedFile: null,
    });

    const uploadFile = async (file: File, options: UploadOptions = {}) => {
        console.log('S3Upload: Starting upload process', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            options
        });

        // Reset state
        setUploadState({
            uploading: true,
            progress: 0,
            error: null,
            uploadedFile: null,
        });

        try {
            // Validate file
            if (!file) {
                throw new Error('No file provided');
            }

            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                throw new Error('File size must be less than 10MB');
            }

            console.log('S3Upload: File validation passed, preparing FormData');

            // Prepare FormData
            const formData = new FormData();
            formData.append('file', file);

            if (options.key) {
                formData.append('key', options.key);
            }

            if (options.expiresMinutes) {
                formData.append('expires_minutes', options.expiresMinutes.toString());
            }

            console.log('S3Upload: Making request to /api/storage/upload');

            // Update progress
            setUploadState(prev => ({ ...prev, progress: 25 }));
            options.onProgress?.(25);

            // Make the upload request (simplified for testing)
            const response = await fetch('/api/storage/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            console.log('S3Upload: Received response', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            // Update progress
            setUploadState(prev => ({ ...prev, progress: 75 }));
            options.onProgress?.(75);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
                console.error('[S3 API] Upload failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData,
                    timestamp: new Date().toISOString()
                });
                throw new Error(errorData.error || errorData.message || `Upload failed with status ${response.status}`);
            }

            const data: S3UploadResponse = await response.json();

            console.log('[S3 API] Upload response received:', {
                key: data.key,
                signedUrl: data.signed_url,
                signedUrlPreview: data.signed_url?.substring(0, 100) + '...',
                fullResponse: data,
                timestamp: new Date().toISOString()
            });

            console.log('S3Upload: Upload successful', {
                key: data.key,
                signed_url_length: data.signed_url?.length || 0
            });

            // Update state with success
            setUploadState({
                uploading: false,
                progress: 100,
                error: null,
                uploadedFile: data,
            });

            options.onProgress?.(100);
            options.onSuccess?.(data);

            return data;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';

            console.error('S3Upload: Upload failed', {
                error: errorMessage,
                fileName: file.name,
                fileSize: file.size
            });

            setUploadState({
                uploading: false,
                progress: 0,
                error: errorMessage,
                uploadedFile: null,
            });

            options.onError?.(errorMessage);
            throw error;
        }
    };

    const generateSignedUrl = async (key: string, expiresMinutes: number = 10) => {
        console.log('S3Upload: Generating signed URL', { key, expiresMinutes });

        try {
            const params = new URLSearchParams({
                key,
                expires_minutes: expiresMinutes.toString(),
            });

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const response = await fetch(`/api/storage/signed-url?${params}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(csrfToken && { 'X-CSRF-TOKEN': csrfToken }),
                },
                credentials: 'same-origin',
            });

            console.log('S3Upload: Signed URL response', {
                status: response.status,
                ok: response.ok
            });

            if (!response.ok) {
                throw new Error('Failed to generate signed URL');
            }

            const data = await response.json();

            console.log('S3Upload: Signed URL generated successfully');

            return data.signed_url;

        } catch (error) {
            console.error('S3Upload: Failed to generate signed URL', { error, key });
            throw error;
        }
    };

    const deleteFile = async (key: string) => {
        console.log('S3Upload: Deleting file', { key });

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const response = await fetch('/api/storage/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(csrfToken && { 'X-CSRF-TOKEN': csrfToken }),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ key }),
            });

            console.log('S3Upload: Delete response', {
                status: response.status,
                ok: response.ok
            });

            if (!response.ok) {
                throw new Error('Failed to delete file');
            }

            console.log('S3Upload: File deleted successfully');

            return true;

        } catch (error) {
            console.error('S3Upload: Failed to delete file', { error, key });
            throw error;
        }
    };

    const reset = () => {
        console.log('S3Upload: Resetting upload state');
        setUploadState({
            uploading: false,
            progress: 0,
            error: null,
            uploadedFile: null,
        });
    };

    return {
        uploadFile,
        generateSignedUrl,
        deleteFile,
        reset,
        ...uploadState,
    };
};

export default useS3Upload;
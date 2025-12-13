// streamUtils.ts - Utility functions for WebRTC stream management

/**
 * Generates a consistent stream ID format across all components
 * @param roomId - The room identifier
 * @param userType - Type of user ('practitioner' | 'patient')
 * @param userId - Unique identifier for the user
 * @returns Formatted stream ID string
 */
export const generateStreamId = (roomId: string, userType: string, userId: string | number): string => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    return `${roomId}_${userType}_${userId}_${timestamp}_${randomId}`;
};

/**
 * Parses a stream ID to extract user information
 * @param streamId - The stream ID to parse
 * @returns Object containing parsed information
 */
export const parseStreamId = (streamId: string) => {
    const parts = streamId.split('_');
    if (parts.length >= 4) {
        return {
            roomId: parts[0],
            userType: parts[1],
            userId: parts[2],
            timestamp: parts[3],
            randomId: parts[4] || '',
            isValid: true
        };
    }
    return {
        roomId: null,
        userType: null,
        userId: null,
        timestamp: null,
        randomId: null,
        isValid: false
    };
};

/**
 * Validates if a stream ID follows the expected format
 * @param streamId - The stream ID to validate
 * @returns Boolean indicating if the stream ID is valid
 */
export const isValidStreamId = (streamId: string): boolean => {
    return parseStreamId(streamId).isValid;
};

/**
 * Gets user type from stream ID
 * @param streamId - The stream ID
 * @returns User type or null if invalid
 */
export const getUserTypeFromStreamId = (streamId: string): 'practitioner' | 'patient' | null => {
    const parsed = parseStreamId(streamId);
    if (parsed.isValid && (parsed.userType === 'practitioner' || parsed.userType === 'patient')) {
        return parsed.userType as 'practitioner' | 'patient';
    }
    return null;
};

/**
 * Debug utility to log WebRTC events with consistent formatting
 * @param component - Component name for identification
 * @param event - Event type
 * @param data - Additional data to log
 */
export const logWebRTCEvent = (component: string, event: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${component} - ${event}`, data || '');
};

/**
 * Retry mechanism for WebRTC operations
 * @param operation - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param delay - Delay between retries in milliseconds
 * @returns Promise that resolves when operation succeeds or max retries reached
 */
export const retryOperation = async (
    operation: () => Promise<any> | any,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<any> => {
    let lastError: any;
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const result = await operation();
            return result;
        } catch (error) {
            lastError = error;
            if (i < maxRetries) {
                console.log(`Operation failed, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
};

/**
 * Checks browser compatibility for WebRTC
 * @returns Object with compatibility information
 */
export const checkWebRTCSupport = () => {
    const hasUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasRTCPeerConnection = !!(window.RTCPeerConnection || window.webkitRTCPeerConnection);
    const hasWebSocket = !!window.WebSocket;
    
    return {
        isSupported: hasUserMedia && hasRTCPeerConnection && hasWebSocket,
        hasUserMedia,
        hasRTCPeerConnection,
        hasWebSocket,
        browserInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
        }
    };
};

/**
 * Gets media constraints based on device capabilities
 * @param preferredConstraints - Preferred media constraints
 * @returns Optimized media constraints
 */
export const getOptimizedMediaConstraints = async (preferredConstraints: MediaStreamConstraints = {}) => {
    const defaultConstraints: MediaStreamConstraints = {
        video: { 
            width: { ideal: 640, max: 1280 }, 
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 }
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };

    try {
        // Check available devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(device => device.kind === 'videoinput');
        const hasAudio = devices.some(device => device.kind === 'audioinput');

        return {
            ...defaultConstraints,
            ...preferredConstraints,
            video: hasVideo ? (preferredConstraints.video || defaultConstraints.video) : false,
            audio: hasAudio ? (preferredConstraints.audio || defaultConstraints.audio) : false
        };
    } catch (error) {
        console.warn('Could not enumerate devices, using default constraints', error);
        return {
            ...defaultConstraints,
            ...preferredConstraints
        };
    }
};
// webrtcConnectionManager.ts - Enhanced connection management for WebRTC

import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor';
import { logWebRTCEvent, retryOperation, generateStreamId } from './streamUtils';

export interface ConnectionConfig {
    antMediaUrl: string;
    roomId: string;
    userType: 'host' | 'participant';
    userId: string | number;
    userName?: string;
    mediaConstraints?: MediaStreamConstraints;
    maxRetries?: number;
    retryDelay?: number;
    maxParticipants?: number;
}

export interface ConnectionCallbacks {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: string) => void;
    onStreamAdded?: (streamId: string, stream: MediaStream) => void;
    onStreamRemoved?: (streamId: string) => void;
    onParticipantJoined?: (participantId: string, participantName: string) => void;
    onParticipantLeft?: (participantId: string) => void;
    onParticipantMuted?: (participantId: string, type: 'audio' | 'video') => void;
    onParticipantUnmuted?: (participantId: string, type: 'audio' | 'video') => void;
    onRoomFull?: () => void;
    onConferenceStarted?: () => void;
    onConferenceEnded?: () => void;
}

export class WebRTCConnectionManager {
    private adaptor: WebRTCAdaptor | null = null;
    private streamId: string = '';
    private config: ConnectionConfig;
    private callbacks: ConnectionCallbacks;
    private isConnected: boolean = false;
    private isInConference: boolean = false;
    private connectionAttempts: number = 0;
    private maxConnectionAttempts: number = 3;
    private participants: Map<string, { name: string; isVideoEnabled: boolean; isAudioEnabled: boolean }> = new Map();

    constructor(config: ConnectionConfig, callbacks: ConnectionCallbacks = {}) {
        this.config = {
            maxRetries: 3,
            retryDelay: 2000,
            maxParticipants: 10,
            mediaConstraints: {
                video: { width: 640, height: 480 },
                audio: true
            },
            ...config
        };
        this.callbacks = callbacks;
    }

    async initialize(): Promise<void> {
        try {
            logWebRTCEvent('ConnectionManager', 'Initializing WebRTC connection', {
                roomId: this.config.roomId,
                userType: this.config.userType
            });

            // Generate consistent stream ID only if not already set
            if (!this.streamId) {
                this.streamId = generateStreamId(
                    this.config.roomId,
                    this.config.userType,
                    this.config.userId
                );
            }

            // Dynamic import to ensure WebRTCAdaptor is available
            const { WebRTCAdaptor } = await import('@antmedia/webrtc_adaptor');

            await retryOperation(
                () => this.createAdaptor(WebRTCAdaptor),
                this.config.maxRetries,
                this.config.retryDelay
            );

            logWebRTCEvent('ConnectionManager', 'WebRTC initialized successfully', {
                streamId: this.streamId
            });

        } catch (error) {
            logWebRTCEvent('ConnectionManager', 'Failed to initialize WebRTC', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.callbacks.onError?.(`Initialization failed: ${errorMessage}`);
            throw error;
        }
    }

    private createAdaptor(WebRTCAdaptor: typeof import('@antmedia/webrtc_adaptor').WebRTCAdaptor): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('WebRTC initialization timeout'));
            }, 10000);

            this.adaptor = new WebRTCAdaptor({
                websocket_url: this.config.antMediaUrl,
                mediaConstraints: this.config.mediaConstraints,
                peerconnection_config: {
                    iceServers: [
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" }
                    ]
                },
                localVideoId: "localVideo",
                debug: true,
                callback: (info: string, obj: unknown) => {
                    this.handleCallback(info, obj, resolve, reject, timeoutId);
                },
                callbackError: (err: string, obj: unknown) => {
                    this.handleError(err, obj, reject, timeoutId);
                }
            });
        });
    }

    private handleCallback(
        info: string, 
        obj: unknown, 
        resolve?: () => void, 
        reject?: (reason?: unknown) => void, 
        timeoutId?: NodeJS.Timeout
    ): void {
        logWebRTCEvent('ConnectionManager', `Callback: ${info}`, obj);

        switch (info) {
            case "initialized":
                if (timeoutId) clearTimeout(timeoutId);
                this.joinRoom();
                resolve?.();
                break;

            case "joinedTheRoom":
                this.isConnected = true;
                this.isInConference = true;
                this.connectionAttempts = 0;
                this.callbacks.onConnected?.();
                this.callbacks.onConferenceStarted?.();
                
                // Start publishing after successful room join
                setTimeout(() => {
                    this.startPublishing();
                }, 1500);

                // Handle existing participants
                if (obj && typeof obj === 'object' && 'streams' in obj && Array.isArray(obj.streams)) {
                    obj.streams.forEach((streamId: string) => {
                        if (streamId !== this.streamId) {
                            this.playStream(streamId);
                            const participantName = this.config.userName || `Participant ${streamId.slice(-4)}`;
                            this.participants.set(streamId, {
                                name: participantName,
                                isVideoEnabled: true,
                                isAudioEnabled: true
                            });
                            this.callbacks.onParticipantJoined?.(streamId, participantName);
                        }
                    });
                }
                break;

            case "newStreamAvailable":
                if (obj && typeof obj === 'object' && 'streamId' in obj && typeof obj.streamId === 'string' && obj.streamId !== this.streamId) {
                    // Check if room is full
                    if (this.participants.size >= (this.config.maxParticipants || 10)) {
                        this.callbacks.onRoomFull?.();
                        return;
                    }
                    
                    const streamObj = obj as { streamId: string; stream?: MediaStream };
                    if (streamObj.stream) {
                        this.callbacks.onStreamAdded?.(obj.streamId, streamObj.stream);
                    }
                    const participantName = this.config.userName || `Participant ${obj.streamId.slice(-4)}`;
                    this.participants.set(obj.streamId, {
                        name: participantName,
                        isVideoEnabled: true,
                        isAudioEnabled: true
                    });
                    this.callbacks.onParticipantJoined?.(obj.streamId, participantName);
                }
                break;

            case "streamJoined":
                if (obj && typeof obj === 'object' && 'streamId' in obj && typeof obj.streamId === 'string' && obj.streamId !== this.streamId) {
                    setTimeout(() => this.playStream(obj.streamId as string), 2000);
                }
                break;

            case "streamLeaved":
                if (obj && typeof obj === 'object' && 'streamId' in obj && typeof obj.streamId === 'string') {
                    this.participants.delete(obj.streamId);
                    this.callbacks.onParticipantLeft?.(obj.streamId);
                    this.callbacks.onStreamRemoved?.(obj.streamId);
                }
                break;

            case "publish_started":
                logWebRTCEvent('ConnectionManager', 'Publishing started successfully');
                break;

            case "play_started":
                // Try to get stream reference for new participants
                if (obj && typeof obj === 'object' && 'streamId' in obj && typeof obj.streamId === 'string' && obj.streamId !== this.streamId) {
                    setTimeout(() => {
                        this.tryGetRemoteStream(obj.streamId as string);
                    }, 1000);
                }
                break;

            case "play_finished":
                if (obj && typeof obj === 'object' && 'streamId' in obj && typeof obj.streamId === 'string') {
                    this.callbacks.onStreamRemoved?.(obj.streamId);
                }
                break;

            default:
                logWebRTCEvent('ConnectionManager', `Unhandled callback: ${info}`, obj);
        }
    }

    private handleError(
        err: string, 
        obj: unknown, 
        reject?: (reason?: unknown) => void, 
        timeoutId?: NodeJS.Timeout
    ): void {
        logWebRTCEvent('ConnectionManager', `Error: ${err}`, obj);

        if (timeoutId) clearTimeout(timeoutId);

        switch (err) {
            case "websocketConnectionFailed":
                this.handleConnectionFailure("WebSocket connection failed", reject);
                break;

            case "notSetLocalDescription":
                this.callbacks.onError?.("Camera/microphone access denied. Please allow permissions and refresh.");
                reject?.(new Error("Media access denied"));
                break;

            case "no_stream_exist":
                // This is often temporary, don't treat as fatal error
                logWebRTCEvent('ConnectionManager', 'Stream does not exist - may be temporary');
                break;

            case "publishTimeoutError":
                this.handlePublishTimeout();
                break;

            default:
                this.callbacks.onError?.(`WebRTC error: ${err}`);
                break;
        }
    }

    private handleConnectionFailure(message: string, reject?: (reason?: unknown) => void): void {
        this.connectionAttempts++;
        
        if (this.connectionAttempts < this.maxConnectionAttempts) {
            logWebRTCEvent('ConnectionManager', `Connection failed, retrying... (${this.connectionAttempts}/${this.maxConnectionAttempts})`);
            
            setTimeout(() => {
                this.retryConnection();
            }, this.config.retryDelay || 2000);
        } else {
            this.callbacks.onError?.(message);
            reject?.(new Error(message));
        }
    }

    private handlePublishTimeout(): void {
        logWebRTCEvent('ConnectionManager', 'Publish timeout, attempting to rejoin room');
        
        setTimeout(() => {
            if (this.adaptor && this.config.roomId && this.streamId) {
                this.adaptor.joinRoom(this.config.roomId, this.streamId);
            }
        }, 2000);
    }

    private retryConnection(): void {
        if (this.adaptor) {
            this.adaptor.joinRoom(this.config.roomId, this.streamId);
        }
    }

    private joinRoom(): void {
        if (this.adaptor && this.config.roomId && this.streamId) {
            logWebRTCEvent('ConnectionManager', 'Joining room', {
                roomId: this.config.roomId,
                streamId: this.streamId
            });
            this.adaptor.joinRoom(this.config.roomId, this.streamId);
        }
    }

    private startPublishing(): void {
        if (this.adaptor && this.streamId) {
            logWebRTCEvent('ConnectionManager', 'Starting to publish stream', { streamId: this.streamId });
            this.adaptor.publish(this.streamId);
        }
    }

    private playStream(streamId: string): void {
        if (this.adaptor) {
            try {
                logWebRTCEvent('ConnectionManager', 'Playing stream', { streamId });
                this.adaptor.play(streamId);
            } catch (error) {
                logWebRTCEvent('ConnectionManager', 'Error playing stream', { streamId, error });
            }
        }
    }

    private tryGetRemoteStream(streamId: string): void {
        if (this.adaptor?.remoteVideo?.[streamId]) {
            const videoEl = this.adaptor.remoteVideo[streamId];
            const stream = videoEl.srcObject;
            if (stream) {
                this.callbacks.onStreamAdded?.(streamId, stream);
            }
        }
    }

    // Public methods for controlling the connection
    // Note: These methods should be implemented by the calling component using MediaStream API
    // as the WebRTCAdaptor methods may not be available or may have different signatures
    public toggleVideo(): void {
        console.warn('toggleVideo should be implemented by the calling component using MediaStream API');
    }

    public toggleAudio(): void {
        console.warn('toggleAudio should be implemented by the calling component using MediaStream API');
    }

    public turnOnVideo(): void {
        console.warn('turnOnVideo should be implemented by the calling component using MediaStream API');
    }

    public turnOffVideo(): void {
        console.warn('turnOffVideo should be implemented by the calling component using MediaStream API');
    }

    public unmuteAudio(): void {
        console.warn('unmuteAudio should be implemented by the calling component using MediaStream API');
    }

    public muteAudio(): void {
        console.warn('muteAudio should be implemented by the calling component using MediaStream API');
    }

    public disconnect(): void {
        if (this.adaptor && this.config.roomId && this.streamId) {
            logWebRTCEvent('ConnectionManager', 'Disconnecting', {
                roomId: this.config.roomId,
                streamId: this.streamId
            });
            
            try {
                // Check if adaptor is still connected before trying to leave room
                // Note: websocket property is not in the WebRTCAdaptor type definition
                const adaptorWithWebSocket = this.adaptor as WebRTCAdaptor & { websocket?: WebSocket }
                if (adaptorWithWebSocket.websocket && adaptorWithWebSocket.websocket.readyState === WebSocket.OPEN) {
                    this.adaptor.leaveFromRoom(this.config.roomId);
                }
                this.adaptor.stop(this.streamId);
            } catch (error) {
                logWebRTCEvent('ConnectionManager', 'Error during disconnect', error);
            }
            
            this.isConnected = false;
            this.callbacks.onDisconnected?.();
        }
    }

    public getStreamId(): string {
        return this.streamId;
    }

    public getConnectionStatus(): boolean {
        return this.isConnected;
    }

    public getAdaptor(): WebRTCAdaptor | null {
        return this.adaptor;
    }

    // Conference management methods
    public getParticipants(): Map<string, { name: string; isVideoEnabled: boolean; isAudioEnabled: boolean }> {
        return new Map(this.participants);
    }

    public getParticipantCount(): number {
        return this.participants.size;
    }

    public isConferenceActive(): boolean {
        return this.isInConference;
    }

    public muteParticipant(participantId: string, type: 'audio' | 'video'): void {
        if (this.adaptor && participantId !== this.streamId) {
            // Note: These methods may not exist in the current WebRTCAdaptor version
            // The actual implementation would depend on the specific Ant Media Server version
            if (type === 'audio') {
                // this.adaptor.muteRemoteAudio(participantId);
                console.warn('muteRemoteAudio method not available in current WebRTCAdaptor version');
            } else {
                // this.adaptor.turnOffRemoteCamera(participantId);
                console.warn('turnOffRemoteCamera method not available in current WebRTCAdaptor version');
            }
            
            const participant = this.participants.get(participantId);
            if (participant) {
                if (type === 'audio') {
                    participant.isAudioEnabled = false;
                } else {
                    participant.isVideoEnabled = false;
                }
                this.participants.set(participantId, participant);
                this.callbacks.onParticipantMuted?.(participantId, type);
            }
        }
    }

    public unmuteParticipant(participantId: string, type: 'audio' | 'video'): void {
        if (this.adaptor && participantId !== this.streamId) {
            // Note: These methods may not exist in the current WebRTCAdaptor version
            // The actual implementation would depend on the specific Ant Media Server version
            if (type === 'audio') {
                // this.adaptor.unmuteRemoteAudio(participantId);
                console.warn('unmuteRemoteAudio method not available in current WebRTCAdaptor version');
            } else {
                // this.adaptor.turnOnRemoteCamera(participantId);
                console.warn('turnOnRemoteCamera method not available in current WebRTCAdaptor version');
            }
            
            const participant = this.participants.get(participantId);
            if (participant) {
                if (type === 'audio') {
                    participant.isAudioEnabled = true;
                } else {
                    participant.isVideoEnabled = true;
                }
                this.participants.set(participantId, participant);
                this.callbacks.onParticipantUnmuted?.(participantId, type);
            }
        }
    }

    public kickParticipant(participantId: string): void {
        if (this.adaptor && participantId !== this.streamId) {
            // Note: This would require server-side implementation
            // For now, we'll just remove from our local tracking
            this.participants.delete(participantId);
            this.callbacks.onParticipantLeft?.(participantId);
        }
    }

    public endConference(): void {
        if (this.adaptor && this.config.roomId && this.streamId) {
            logWebRTCEvent('ConnectionManager', 'Ending conference', {
                roomId: this.config.roomId,
                streamId: this.streamId
            });
            
            try {
                // Check if adaptor is still connected before trying to leave room
                // Note: websocket property is not in the WebRTCAdaptor type definition
                const adaptorWithWebSocket = this.adaptor as WebRTCAdaptor & { websocket?: WebSocket }
                if (adaptorWithWebSocket.websocket && adaptorWithWebSocket.websocket.readyState === WebSocket.OPEN) {
                    this.adaptor.leaveFromRoom(this.config.roomId);
                }
                this.adaptor.stop(this.streamId);
            } catch (error) {
                logWebRTCEvent('ConnectionManager', 'Error during endConference', error);
            }
            
            this.isInConference = false;
            this.participants.clear();
            this.callbacks.onConferenceEnded?.();
            this.callbacks.onDisconnected?.();
        }
    }

    public getConferenceInfo(): {
        roomId: string;
        streamId: string;
        participantCount: number;
        maxParticipants: number;
        isHost: boolean;
    } {
        return {
            roomId: this.config.roomId,
            streamId: this.streamId,
            participantCount: this.participants.size + 1, // +1 for self
            maxParticipants: this.config.maxParticipants || 10,
            isHost: this.config.userType === 'host'
        };
    }

    public reset(): void {
        this.streamId = '';
        this.isConnected = false;
        this.isInConference = false;
        this.connectionAttempts = 0;
        this.participants.clear();
    }
}
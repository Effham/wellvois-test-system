import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor';
import { 
    Video, 
    VideoOff, 
    Mic, 
    MicOff, 
    Phone, 
    PhoneOff, 
    Settings, 
    Clock,
    Calendar,
    User,
    Mail,
    MapPin,
    Stethoscope,
    Camera,
    MessageSquare,
    Info,
    Sparkles,
    Shield,
    Users,
    Maximize,
    Minimize,
    Loader
} from 'lucide-react';

// Keep your existing interfaces
interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    email: string;
    phone_number?: string;
    date_of_birth?: string;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    designation?: string;
    profile_picture_s3_key?: string;
}

interface Service {
    id: number;
    name: string;
    description?: string;
}

interface Location {
    id: number;
    name: string;
    address?: string;
}

interface Appointment {
    id: number;
    status: string;
    mode: string;
    appointment_datetime?: string;
    appointment_datetime_formatted?: string;
    appointment_date?: string;
    appointment_time?: string;
    notes?: string;
    service: Service;
    location?: Location;
}

interface SessionStatus {
    is_active: boolean;
    can_join: boolean;
    status: 'upcoming' | 'starting_soon' | 'active' | 'ending_soon' | 'ended';
}

interface OrganizationSettings {
    practiceDetails: Record<string, string>;
    appearance: Record<string, string>;
}

interface Tenant {
    id: string;
    company_name: string;
}

// New interfaces for WebRTC
interface RemoteStream {
    id: string;
    stream: MediaStream;
}

interface WebRTCParticipant {
    id: string;
    streamId: string;
    name: string;
    type: 'patient' | 'practitioner';
    isVideoOn: boolean;
    isAudioOn: boolean;
    stream?: MediaStream;
}

interface Props {
    appointment: Appointment;
    patient?: Patient;
    practitioners: Practitioner[];
    sessionStatus: SessionStatus;
    organizationSettings: OrganizationSettings;
    tenant: Tenant;
    antMediaUrl: string;
}

export default function VirtualSession({ 
    appointment, 
    patient, 
    practitioners, 
    sessionStatus, 
    organizationSettings, 
    tenant, 
    antMediaUrl 
}: Props) {
    // Extract roomId from URL
    const { props, url } = usePage();
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');

    // WebRTC states
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [isInSession, setIsInSession] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    
    // WebRTC refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const adaptorRef = useRef<any>(null);
    const streamIdRef = useRef<string>("");
    
    // Participants state
    const [participants, setParticipants] = useState<WebRTCParticipant[]>([]);
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
    
    // UI states
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isVideoMaximized, setIsVideoMaximized] = useState(false);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    console.log('RENDERING' , antMediaUrl)
    // Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Apply clinic theme
    useEffect(() => {
        const themeColor = organizationSettings.appearance.appearance_theme_color;
        if (themeColor) {
            document.documentElement.style.setProperty('--primary', themeColor);
            document.documentElement.style.setProperty('--sidebar-accent', themeColor);
        }
    }, [organizationSettings.appearance.appearance_theme_color]);

    // WebRTC initialization
    const initializeWebRTC = useCallback(() => {
        if (!roomId || !antMediaUrl) {
            setConnectionError("Missing room ID or AntMedia URL");
            return;
        }

        // Generate unique stream ID for this user
        const userType = patient ? 'patient' : 'practitioner';
        const userId = patient?.id || (practitioners[0]?.id || 'unknown');
        const myStreamId = `${roomId}_${userType}_${userId}_${Date.now()}`;
        streamIdRef.current = myStreamId;
        
        console.log("Initializing WebRTC for room:", roomId, "with stream ID:", myStreamId);
        setIsConnecting(true);
        setConnectionError(null);

        const adaptor = new WebRTCAdaptor({
            websocket_url: `${antMediaUrl}`,
            mediaConstraints: { 
                video: { width: 640, height: 480 }, 
                audio: true 
            },
            peerconnection_config: { 
                iceServers: [
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" }
                ] 
            },
            localVideoId: "localVideo",
            debug: true,
            callback: (info: string, obj: any) => {
                console.log("WebRTCAdaptor callback:", info, obj);
                handleWebRTCCallback(info, obj, myStreamId);
            },
            callbackError: (err: string, obj: any) => {
                console.error("WebRTCAdaptor error:", err, obj);
                handleWebRTCError(err, obj);
            },
        });
        console.log('CONNECTING')
        adaptorRef.current = adaptor;
        return adaptor;
    }, [roomId, antMediaUrl, patient, practitioners]);

    const handleWebRTCCallback = (info: string, obj: any, myStreamId: string) => {
        const adaptor = adaptorRef.current;
        if (!adaptor) return;

        switch (info) {
            case "initialized":
                console.log("WebRTC initialized, joining room:", roomId);
                adaptor.joinRoom(roomId, myStreamId);
                break;

            case "joinedTheRoom":
                console.log("Successfully joined room:", obj.roomId || obj.room);
                setIsConnected(true);
                setIsConnecting(false);
                
                // Publish our own stream
                console.log("Publishing local stream:", myStreamId);
                adaptor.publish(myStreamId);
                
                // Update our participant info
                updateCurrentUserParticipant(myStreamId, true);
                
                // Play existing streams
                if (obj.streams && obj.streams.length > 0) {
                    obj.streams.forEach((streamId: string) => {
                        if (streamId !== myStreamId) {
                            console.log("Playing existing stream:", streamId);
                            adaptor.play(streamId);
                            addRemoteParticipant(streamId);
                        }
                    });
                }
                break;

            case "newStreamAvailable":
                console.log("New stream available:", obj.streamId);
                handleNewStream(obj.streamId, obj.stream);
                break;

            case "streamJoined":
                console.log("Stream joined room:", obj.streamId);
                if (obj.streamId !== myStreamId) {
                    adaptor.play(obj.streamId);
                    addRemoteParticipant(obj.streamId);
                }
                break;

            case "streamLeaved":
                console.log("Stream left room:", obj.streamId);
                removeParticipant(obj.streamId);
                break;

            case "publish_started":
                console.log("Publishing started for:", obj.streamId);
                if (obj.streamId === myStreamId) {
                    updateCurrentUserParticipant(myStreamId, true);
                }
                break;

            case "play_started":
                console.log("Playback started for:", obj.streamId);
                break;

            case "play_finished":
                console.log("Playback finished for:", obj.streamId);
                removeParticipant(obj.streamId);
                break;

            default:
                console.log("Unhandled callback:", info, obj);
        }
    };

    const handleWebRTCError = (err: string, obj: any) => {
        console.error("WebRTC Error:", err, obj);
        setIsConnecting(false);
        
        switch (err) {
            case "websocketConnectionFailed":
                setConnectionError("Failed to connect to video server. Please check your internet connection.");
                break;
            case "notSetLocalDescription":
                setConnectionError("Camera/microphone access denied. Please allow permissions and refresh.");
                break;
            default:
                setConnectionError(`Connection error: ${err}`);
        }
    };

    const handleNewStream = (streamId: string, stream: MediaStream) => {
        setRemoteStreams(prev => {
            if (prev.find(r => r.id === streamId)) {
                return prev;
            }
            return [...prev, { id: streamId, stream }];
        });

        // Update participant with stream
        setParticipants(prev => prev.map(p => 
            p.streamId === streamId 
                ? { ...p, stream, isVideoOn: true, isAudioOn: true }
                : p
        ));
    };

    const addRemoteParticipant = (streamId: string) => {
        // Try to determine participant type and name from streamId
        const isPatient = streamId.includes('patient');
        const participantName = isPatient 
            ? (patient ? getPatientDisplayName() : 'Patient')
            : 'Practitioner';

        const newParticipant: WebRTCParticipant = {
            id: streamId,
            streamId,
            name: participantName,
            type: isPatient ? 'patient' : 'practitioner',
            isVideoOn: false,
            isAudioOn: false
        };

        setParticipants(prev => {
            if (prev.find(p => p.streamId === streamId)) {
                return prev;
            }
            return [...prev, newParticipant];
        });
    };

    const removeParticipant = (streamId: string) => {
        setParticipants(prev => prev.filter(p => p.streamId !== streamId));
        setRemoteStreams(prev => prev.filter(r => r.id !== streamId));
    };

    const updateCurrentUserParticipant = (streamId: string, isPublishing: boolean) => {
        const userName = patient 
            ? getPatientDisplayName()
            : (practitioners[0] ? `Dr. ${practitioners[0].first_name} ${practitioners[0].last_name}` : 'You');
        
        const userType = patient ? 'patient' : 'practitioner';

        setParticipants(prev => {
            const existing = prev.find(p => p.streamId === streamId);
            if (existing) {
                return prev.map(p => 
                    p.streamId === streamId 
                        ? { ...p, isVideoOn: isVideoEnabled && isPublishing, isAudioOn: isAudioEnabled && isPublishing }
                        : p
                );
            } else {
                return [...prev, {
                    id: streamId,
                    streamId,
                    name: userName,
                    type: userType,
                    isVideoOn: isVideoEnabled && isPublishing,
                    isAudioOn: isAudioEnabled && isPublishing
                }];
            }
        });
    };

    const handleJoinSession = async () => {
        if (!roomId) {
            console.log('Handle join sess roomId',roomId)
            setConnectionError("No room ID provided in URL");
            return;
        }
            console.log(roomId,roomId)

        setIsConnecting(true);
        setConnectionError(null);

        try {
            // Step 1: Request camera/microphone permissions explicitly
            console.log("Requesting media permissions...");
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 },
                audio: true
            });
            
            console.log("Media permissions granted:", mediaStream);
            
            // Show the stream in local video immediately
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = mediaStream;
            }
            
            setIsVideoEnabled(true);
            setIsAudioEnabled(true);
            setIsInSession(true);
            
            // Step 2: Initialize WebRTC after permissions granted
            await initializeWebRTC();
            
        } catch (error) {
            console.error("Failed to get media permissions:", error);
            setIsConnecting(false);
            
            if (error.name === 'NotAllowedError') {
                setConnectionError("Camera/microphone access denied. Please allow permissions and try again.");
            } else if (error.name === 'NotFoundError') {
                setConnectionError("No camera or microphone found. Please check your devices.");
            } else if (error.name === 'NotSupportedError') {
                setConnectionError("Your browser doesn't support video calls. Please use Chrome, Firefox, or Safari.");
            } else {
                setConnectionError(`Media access error: ${error.message}`);
            }
        }
    };

    const handleLeaveSession = () => {
        const adaptor = adaptorRef.current;
        const currentStreamId = streamIdRef.current;
        
        if (adaptor && roomId && currentStreamId) {
            console.log("Leaving room:", roomId, "stopping stream:", currentStreamId);
            adaptor.leaveFromRoom(roomId);
            adaptor.stop(currentStreamId);
        }
        
        // Reset states
        setIsInSession(false);
        setIsConnected(false);
        setIsConnecting(false);
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        setParticipants([]);
        setRemoteStreams([]);
        setConnectionError(null);
        adaptorRef.current = null;
        streamIdRef.current = "";
    };

    const toggleVideo = useCallback(() => {
        const adaptor = adaptorRef.current;
        if (adaptor) {
            if (isVideoEnabled) {
                adaptor.turnOffLocalCamera();
            } else {
                adaptor.turnOnLocalCamera();
            }
            setIsVideoEnabled(!isVideoEnabled);
            
            // Update our participant info
            const currentStreamId = streamIdRef.current;
            if (currentStreamId) {
                updateCurrentUserParticipant(currentStreamId, isConnected);
            }
        }
    }, [isVideoEnabled, isConnected]);

    const toggleAudio = useCallback(() => {
        const adaptor = adaptorRef.current;
        if (adaptor) {
            if (isAudioEnabled) {
                adaptor.muteLocalAudio();
            } else {
                adaptor.unmuteLocalAudio();
            }
            setIsAudioEnabled(!isAudioEnabled);
            
            // Update our participant info
            const currentStreamId = streamIdRef.current;
            if (currentStreamId) {
                updateCurrentUserParticipant(currentStreamId, isConnected);
            }
        }
    }, [isAudioEnabled, isConnected]);

    // Existing helper functions
    const getStatusBadge = () => {
        const statusConfig = {
            upcoming: { variant: 'secondary' as const, text: 'Upcoming' },
            starting_soon: { variant: 'default' as const, text: 'Starting Soon' },
            active: { variant: 'default' as const, text: 'Active', className: 'bg-green-600 hover:bg-green-700' },
            ending_soon: { variant: 'outline' as const, text: 'Ending Soon' },
            ended: { variant: 'destructive' as const, text: 'Ended' },
        };

        const config = statusConfig[sessionStatus.status];
        return <Badge variant={config.variant} className={config.className}>{config.text}</Badge>;
    };

    const toggleVideoMaximize = () => {
        setIsVideoMaximized(!isVideoMaximized);
        setTimeout(() => {
            if (!isVideoMaximized && videoContainerRef.current) {
                videoContainerRef.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }, 100);
    };

    const getPatientDisplayName = () => {
        if (!patient) return 'Patient';
        return patient.preferred_name || `${patient.first_name} ${patient.last_name}`;
    };

    const getClinicName = () => {
        const practiceName = organizationSettings.practiceDetails.practice_details_name;
        return practiceName || tenant.company_name;
    };

    const getLogoUrl = () => {
        return organizationSettings.appearance.appearance_logo_url;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (adaptorRef.current && streamIdRef.current) {
                adaptorRef.current.stop(streamIdRef.current);
            }
        };
    }, []);

    return (
        <>
            <Head title={`Virtual Session - ${appointment.service.name} | ${getClinicName()}`} />
            
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <div className="container mx-auto px-4 py-4">
                    {/* Clinic Header */}
                    <div className="mb-4">
                        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    {getLogoUrl() ? (
                                        <img
                                            src={getLogoUrl()}
                                            alt={`${getClinicName()} logo`}
                                            className="h-10 w-auto"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                                            <span className="text-primary-foreground font-bold text-lg">
                                                {getClinicName().charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <h1 className="text-xl font-bold text-primary">
                                            {getClinicName()}
                                        </h1>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            Virtual Healthcare Session
                                            {roomId && <span className="ml-2">• Room: {roomId} Bab</span>}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-6">
                                    {patient && (
                                        <div className="flex items-center space-x-2 text-sm">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback className="text-xs">
                                                    {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-gray-700 dark:text-gray-300 font-medium">
                                                {getPatientDisplayName()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                                        <Clock className="h-4 w-4 text-primary" />
                                        <span>{appointment.appointment_datetime_formatted}</span>
                                    </div>
                                    {getStatusBadge()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <motion.div 
                        className={`${isVideoMaximized ? 'block' : 'flex flex-col lg:flex-row gap-6'}`}
                        layout
                        transition={{
                            duration: 0.3,
                            ease: "easeInOut"
                        }}
                    >
                        {/* Video Session Area */}
                        <div className={`${isVideoMaximized ? 'w-full' : 'flex-1'} flex flex-col`}>
                            <Card className="h-full border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex flex-col">
                                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20 py-3">
                                    <CardTitle className="flex items-center gap-3">
                                        <div className="p-1.5 bg-primary rounded-lg">
                                            <Video className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                        <span className="text-primary">Video Session</span>
                                        {isConnected && (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                                Connected
                                            </Badge>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4" ref={videoContainerRef}>
                                    <motion.div 
                                        className={`aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl relative overflow-hidden shadow-inner border border-gray-700 w-full ${
                                            isVideoMaximized ? 'max-h-[80vh]' : 'max-h-[450px]'
                                        }`}
                                        animate={{
                                            scale: isVideoMaximized ? 1.02 : 1,
                                        }}
                                        transition={{
                                            duration: 0.3,
                                            ease: "easeInOut"
                                        }}
                                    >
                                        {/* Maximize/Minimize Button */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleVideoMaximize}
                                            className="absolute top-3 right-3 z-10 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 border border-gray-600"
                                        >
                                            {isVideoMaximized ? (
                                                <Minimize className="h-4 w-4 text-white" />
                                            ) : (
                                                <Maximize className="h-4 w-4 text-white" />
                                            )}
                                        </Button>

                                        {/* Connection Error */}
                                        {connectionError && (
                                            <div className="absolute top-3 left-3 right-16 z-10 bg-red-600 text-white px-3 py-2 rounded-lg text-sm">
                                                {connectionError}
                                            </div>
                                        )}

                                        {/* Video Grid */}
                                        {participants.length > 0 || isInSession ? (
                                            <div className="w-full h-full p-4">
                                                {/* Local Video - Make it visible when in session */}
                                                <video
                                                    id="localVideo"
                                                    ref={localVideoRef}
                                                    autoPlay
                                                    playsInline
                                                    muted
                                                    className={`${participants.length > 0 ? 'absolute -top-full opacity-0' : 'hidden'}`}
                                                />
                                                
                                                <div className={`grid gap-2 h-full ${
                                                    participants.length === 0 && isInSession ? 'grid-cols-1' :
                                                    participants.length === 1 ? 'grid-cols-1' :
                                                    participants.length === 2 ? 'grid-cols-2' :
                                                    participants.length <= 4 ? 'grid-cols-2 grid-rows-2' :
                                                    'grid-cols-3 grid-rows-2'
                                                }`}>
                                                    {/* Show local preview if no participants yet but in session */}
                                                    {participants.length === 0 && isInSession && (
                                                        <div className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-600 flex items-center justify-center">
                                                            <div className="absolute top-2 left-2 z-10">
                                                                <Badge className="text-xs px-2 py-0.5 bg-blue-500 text-white">
                                                                    You (Connecting...)
                                                                </Badge>
                                                            </div>
                                                            
                                                            <video
                                                                autoPlay
                                                                playsInline
                                                                muted
                                                                className="w-full h-full object-cover"
                                                                ref={(el) => {
                                                                    if (el && localVideoRef.current?.srcObject) {
                                                                        el.srcObject = localVideoRef.current.srcObject;
                                                                    }
                                                                }}
                                                            />
                                                            
                                                            <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-white z-10">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-medium truncate">
                                                                        {patient ? getPatientDisplayName() : 'You'}
                                                                    </span>
                                                                    <div className="flex gap-1 ml-2">
                                                                        <div className={`p-0.5 rounded ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
                                                                            {isAudioEnabled ? (
                                                                                <Mic className="h-2.5 w-2.5 text-white" />
                                                                            ) : (
                                                                                <MicOff className="h-2.5 w-2.5 text-white" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {participants.map((participant) => (
                                                        <div 
                                                            key={participant.id}
                                                            className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-600 flex items-center justify-center"
                                                        >
                                                            {/* Role Badge */}
                                                            <div className="absolute top-2 left-2 z-10">
                                                                <Badge 
                                                                    variant={participant.type === 'practitioner' ? 'default' : 'secondary'}
                                                                    className={`text-xs px-2 py-0.5 ${
                                                                        participant.type === 'practitioner' 
                                                                            ? 'bg-primary text-primary-foreground' 
                                                                            : 'bg-blue-500 text-white'
                                                                    }`}
                                                                >
                                                                    {participant.type === 'practitioner' ? 'Doctor' : 'Patient'}
                                                                </Badge>
                                                            </div>

                                                            {/* Video Stream or Placeholder */}
                                                            {participant.stream ? (
                                                                <video
                                                                    autoPlay
                                                                    playsInline
                                                                    className="w-full h-full object-cover"
                                                                    ref={(el) => {
                                                                        if (el && participant.stream) {
                                                                            el.srcObject = participant.stream;
                                                                        }
                                                                    }}
                                                                />
                                                            ) : participant.isVideoOn ? (
                                                                <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center">
                                                                    <div className="text-center">
                                                                        <Avatar className="h-16 w-16 mx-auto mb-2">
                                                                            <AvatarFallback className={participant.type === 'practitioner' ? 'bg-primary text-primary-foreground text-lg' : 'bg-blue-500 text-white text-lg'}>
                                                                                {participant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="text-white text-xs opacity-75">Connecting...</div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                                                    <div className="text-center">
                                                                        <Avatar className="h-12 w-12 mx-auto mb-2">
                                                                            <AvatarFallback className="bg-gray-600 text-gray-300">
                                                                                {participant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <VideoOff className="h-6 w-6 text-gray-400 mx-auto" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Participant Info Overlay */}
                                                            <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-white z-10">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-medium truncate">
                                                                        {participant.name}
                                                                    </span>
                                                                    <div className="flex gap-1 ml-2">
                                                                        <div className={`p-0.5 rounded ${participant.isAudioOn ? 'bg-green-500' : 'bg-red-500'}`}>
                                                                            {participant.isAudioOn ? (
                                                                                <Mic className="h-2.5 w-2.5 text-white" />
                                                                            ) : (
                                                                                <MicOff className="h-2.5 w-2.5 text-white" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="text-white text-center relative">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/20 rounded-full blur-3xl"></div>
                                                    {isConnecting ? (
                                                        <>
                                                            <Loader className="h-16 w-16 mx-auto mb-4 text-primary/70 relative z-10 animate-spin" />
                                                            <p className="text-lg font-semibold relative z-10">Connecting...</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <VideoOff className="h-16 w-16 mx-auto mb-4 text-primary/70 relative z-10" />
                                                            <p className="text-lg font-semibold relative z-10">Waiting to Connect</p>
                                                            {sessionStatus.can_join && (
                                                                <p className="text-sm opacity-75 mt-2 relative z-10">
                                                                    Ready to start your session
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>

                                    {/* Controls */}
                                    <div className="mt-6 flex justify-center gap-4">
                                        {!roomId && (
                                            <div className="text-center text-red-600">
                                                <p className="text-sm font-medium">No room ID in URL</p>
                                                <p className="text-xs">Add ?roomId=your_room_id to the URL</p>
                                            </div>
                                        )}

                                        {roomId  && (
                                            <Button 
                                                onClick={handleJoinSession}
                                                size="lg"
                                                disabled={isConnecting}
                                                className="bg-primary hover:bg-primary/90 px-6 py-2.5 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                                            >
                                                {isConnecting ? (
                                                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Video className="h-4 w-4 mr-2" />
                                                )}
                                                {isConnecting ? "Connecting..." : "Join Session"}
                                            </Button>
                                        )}

                                        {isInSession && (
                                            <>
                                                <Button
                                                    variant={isVideoEnabled ? "default" : "destructive"}
                                                    size="lg"
                                                    onClick={toggleVideo}
                                                    className="w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                                                >
                                                    {isVideoEnabled ? (
                                                        <Video className="h-5 w-5" />
                                                    ) : (
                                                        <VideoOff className="h-5 w-5" />
                                                    )}
                                                </Button>

                                                <Button
                                                    variant={isAudioEnabled ? "default" : "destructive"}
                                                    size="lg"
                                                    onClick={toggleAudio}
                                                    className="w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                                                >
                                                    {isAudioEnabled ? (
                                                        <Mic className="h-5 w-5" />
                                                    ) : (
                                                        <MicOff className="h-5 w-5" />
                                                    )}
                                                </Button>

                                                <Button
                                                    variant="destructive"
                                                    size="lg"
                                                    onClick={handleLeaveSession}
                                                    className="px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                                                >
                                                    <PhoneOff className="h-4 w-4 mr-2" />
                                                    End Session
                                                </Button>
                                            </>
                                        )}
                                    </div>

                                    {/* Debug Information */}
                                    {isInSession && (
                                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>Room ID: {roomId}</div>
                                                <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
                                                <div>Video: {isVideoEnabled ? 'On' : 'Off'}</div>
                                                <div>Audio: {isAudioEnabled ? 'On' : 'Off'}</div>
                                                <div>Participants: {participants.length}</div>
                                                <div>Streams: {remoteStreams.length}</div>
                                            </div>
                                        </div>
                                    )}
                                    {!sessionStatus.can_join && sessionStatus.status === 'upcoming' && (
                                        <div className="mt-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                                            <div className="flex items-center gap-2 text-primary">
                                                <Info className="h-4 w-4" />
                                                <span className="font-medium text-sm">Session will be available 15 minutes before your appointment time</span>
                                            </div>
                                        </div>
                                    )}

                                    {sessionStatus.status === 'ended' && (
                                        <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                <Clock className="h-4 w-4" />
                                                <span className="font-medium text-sm">This session has ended</span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Session Information - Keep your existing sidebar */}
                        {!isVideoMaximized && (
                            <div className="w-106 space-y-4 bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg h-fit">
                                {/* Keep all your existing appointment details and practitioners sections */}
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-primary rounded-lg">
                                            <Calendar className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-primary">Appointment Details</h3>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Service</label>
                                                <p className="text-sm font-medium">{appointment.service.name}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Mode</label>
                                                <p className="text-sm capitalize">{appointment.mode}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Date</label>
                                                <p className="text-sm">{appointment.appointment_date}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Time</label>
                                                <p className="text-sm">{appointment.appointment_time}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
                                            <p className="text-sm capitalize">{appointment.status}</p>
                                        </div>

                                        {appointment.notes && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</label>
                                                <p className="text-sm">{appointment.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Practitioners */}
                                {practitioners.length > 0 && (
                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-primary rounded-lg">
                                                <Stethoscope className="h-4 w-4 text-primary-foreground" />
                                            </div>
                                            <h4 className="text-base font-semibold text-primary">Healthcare Team</h4>
                                        </div>
                                        <div className="space-y-3">
                                            {practitioners.map((practitioner) => (
                                                <div key={practitioner.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                    <Avatar className="h-8 w-8">
                                                        {practitioner.profile_picture_s3_key ? (
                                                            <AvatarImage 
                                                                src={`/profile-picture-proxy/${practitioner.id}`}
                                                                alt={`${practitioner.first_name} ${practitioner.last_name}`}
                                                            />
                                                        ) : null}
                                                        <AvatarFallback className="text-xs">
                                                            {practitioner.first_name.charAt(0)}{practitioner.last_name.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {practitioner.first_name} {practitioner.last_name}
                                                        </p>
                                                        {practitioner.designation && (
                                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                                {practitioner.designation}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                    
                    {/* Keep your existing support footer */}
                    <div className="mt-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-t border-primary/20">
                        <div className="container mx-auto px-4 py-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary rounded-lg">
                                        <Shield className="h-5 w-5 text-primary-foreground" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-semibold text-primary">Secure Healthcare Platform</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">HIPAA compliant • End-to-end encrypted • Professional grade</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span>HD Video Quality</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span>24/7 Support</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                        <span>Cross Platform</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
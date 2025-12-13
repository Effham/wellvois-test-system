import { useState, useRef, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { withAppLayout } from '@/utils/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowLeft, 
    Play, 
    Pause, 
    Download, 
    Clock, 
    FileAudio, 
    AlertCircle, 
    FileText, 
    Loader2,
    Sparkles,
    Brain,
    Edit,
    Users
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppointmentTabs from '@/components/appointments/AppointmentTabs';
import { formatDateTime } from '@/hooks/use-time-locale';
import { motion, AnimatePresence } from 'motion/react';

interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
}

interface Service {
    id: number;
    name: string;
}

interface Appointment {
    id: number;
    status: string;
    appointment_datetime: string;
    mode: string;
    service: Service;
    created_at: string;
}

interface TranscriptionTimestamp {
    start_time: number | null;
    end_time: number | null;
    content: string;
    confidence: number | null;
    type?: 'pronunciation' | 'punctuation';
    speaker_label?: string | null;
}

interface SpeakerSegment {
    speaker_label: string;
    start_time: number;
    end_time: number;
    text: string;
    items: TranscriptionTimestamp[];
}

interface Recording {
    id: number;
    file_name: string;
    mime_type: string;
    file_size: number;
    duration_seconds: number | null;
    signed_url: string | null;
    created_at: string;
    transcription_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
    transcription?: string | null;
    transcription_timestamps?: TranscriptionTimestamp[];
    transcription_speaker_segments?: SpeakerSegment[];
    speaker_names?: { [key: string]: string } | null;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
}

interface Encounter {
    id: number;
    status?: string;
}

interface Props {
    appointment: Appointment;
    patient?: Patient | null;
    encounter?: Encounter | null;
    recordings?: Recording[];
    practitioners?: Practitioner[];
    user_role?: string;
}

const getBreadcrumbs = (appointmentId: number) => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '/appointments' },
    { title: 'Appointment Details', href: `/appointments/${appointmentId}` },
    { title: 'Recordings', href: '' },
];

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDuration = (seconds: number | null | undefined): string | null => {
    if (seconds === null || seconds === undefined || seconds === 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatShortDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
};

const truncateTitle = (title: string, maxLength: number = 30): string => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
};

interface TranscriptionWithTimestampsProps {
    transcription: string;
    timestamps: TranscriptionTimestamp[] | undefined;
    currentTime: number;
    onSeek: (time: number) => void;
}

interface SpeakerTranscriptionProps {
    speakerSegments: SpeakerSegment[] | undefined;
    currentTime: number;
    onSeek: (time: number) => void;
    speakerNames?: { [key: string]: string } | null;
    onEditSpeakerNames?: () => void;
}

interface SpeakerNameEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    speakerSegments: SpeakerSegment[] | undefined;
    currentSpeakerNames: { [key: string]: string } | null | undefined;
    onSave: (speakerNames: { [key: string]: string }) => Promise<void>;
}

const SpeakerNameEditor = ({ open, onOpenChange, speakerSegments, currentSpeakerNames, onSave }: SpeakerNameEditorProps) => {
    const [speakerNames, setSpeakerNames] = useState<{ [key: string]: string }>({});
    const [isSaving, setIsSaving] = useState(false);

    // Initialize speaker names when dialog opens
    useEffect(() => {
        if (open && speakerSegments) {
            const names: { [key: string]: string } = {};
            const uniqueSpeakers = new Set(speakerSegments.map(s => s.speaker_label));
            
            uniqueSpeakers.forEach(speakerLabel => {
                // Use existing name or default
                names[speakerLabel] = currentSpeakerNames?.[speakerLabel] || '';
            });
            
            setSpeakerNames(names);
        }
    }, [open, speakerSegments, currentSpeakerNames]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(speakerNames);
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save speaker names:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!speakerSegments || speakerSegments.length === 0) {
        return null;
    }

    const uniqueSpeakers = Array.from(new Set(speakerSegments.map(s => s.speaker_label))).sort();

    const getDefaultSpeakerName = (speakerLabel: string): string => {
        const match = speakerLabel.match(/spk_(\d+)/);
        if (match) {
            const speakerNumber = parseInt(match[1], 10) + 1;
            return `Speaker ${speakerNumber}`;
        }
        return speakerLabel;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Edit Speaker Names
                    </DialogTitle>
                    <DialogDescription>
                        Set custom names for each speaker in this recording
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {uniqueSpeakers.map((speakerLabel) => (
                        <div key={speakerLabel} className="space-y-2">
                            <Label htmlFor={`speaker-${speakerLabel}`}>
                                {getDefaultSpeakerName(speakerLabel)}
                            </Label>
                            <Input
                                id={`speaker-${speakerLabel}`}
                                value={speakerNames[speakerLabel] || ''}
                                onChange={(e) => setSpeakerNames(prev => ({
                                    ...prev,
                                    [speakerLabel]: e.target.value
                                }))}
                                placeholder={`Enter name for ${getDefaultSpeakerName(speakerLabel)}`}
                            />
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SpeakerTranscription = ({ speakerSegments, currentTime, onSeek, speakerNames, onEditSpeakerNames }: SpeakerTranscriptionProps) => {
    if (!speakerSegments || speakerSegments.length === 0) {
        return null;
    }

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getSpeakerName = (speakerLabel: string): string => {
        // Use custom name if available, otherwise use default
        if (speakerNames?.[speakerLabel]) {
            return speakerNames[speakerLabel];
        }
        
        // Convert spk_0, spk_1 to Speaker 1, Speaker 2, etc.
        const match = speakerLabel.match(/spk_(\d+)/);
        if (match) {
            const speakerNumber = parseInt(match[1], 10) + 1;
            return `Speaker ${speakerNumber}`;
        }
        return speakerLabel;
    };

    return (
        <div className="space-y-4">
            {onEditSpeakerNames && (
                <div className="flex justify-end mb-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onEditSpeakerNames}
                        className="gap-2"
                    >
                        <Edit className="h-4 w-4" />
                        Edit Speaker Names
                    </Button>
                </div>
            )}
            {speakerSegments.map((segment, index) => {
                const isActive = currentTime >= segment.start_time && currentTime <= segment.end_time;

                return (
                    <div
                        key={index}
                        className={`
                            border-l-4 pl-4 py-2 transition-colors
                            ${isActive 
                                ? 'border-primary bg-primary/5' 
                                : 'border-gray-300 dark:border-gray-600'
                            }
                        `}
                    >
                        <div className="flex items-start gap-3">
                            <button
                                onClick={() => onSeek(segment.start_time)}
                                className={`
                                    flex-shrink-0 text-xs font-mono text-gray-500 hover:text-primary transition-colors
                                    ${isActive ? 'text-primary font-semibold' : ''}
                                `}
                                title={`Seek to ${formatTime(segment.start_time)}`}
                            >
                                {formatTime(segment.start_time)}
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`
                                        text-sm font-semibold
                                        ${isActive ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}
                                    `}>
                                        {getSpeakerName(segment.speaker_label)}
                                    </span>
                                    <span className="text-gray-400">=</span>
                                </div>
                                <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                    {segment.items.map((item, itemIndex) => {
                                        const isPunctuation = item.type === 'punctuation' || item.start_time === null;
                                        const isItemActive = !isPunctuation && item.start_time !== null && item.end_time !== null
                                            ? currentTime >= item.start_time && currentTime <= item.end_time
                                            : false;

                                        // Add space before pronunciation items (words), but not before punctuation
                                        const needsSpaceBefore = itemIndex > 0 && 
                                            item.type === 'pronunciation' && 
                                            segment.items[itemIndex - 1]?.type !== 'punctuation';

                                        if (isPunctuation) {
                                            // Punctuation is not clickable and attaches directly to previous word
                                            return <span key={itemIndex}>{item.content}</span>;
                                        }

                                        return (
                                            <span key={itemIndex}>
                                                {needsSpaceBefore && <span> </span>}
                                                <button
                                                    onClick={() => item.start_time !== null && onSeek(item.start_time)}
                                                    className={`
                                                        inline transition-colors duration-150 rounded px-1 py-0.5 -mx-1
                                                        ${isItemActive 
                                                            ? 'bg-primary/20 text-primary font-medium' 
                                                            : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                        }
                                                    `}
                                                    title={item.start_time !== null ? `Seek to ${formatTime(item.start_time)}` : undefined}
                                                >
                                                    {item.content}
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const TranscriptionWithTimestamps = ({ transcription, timestamps, currentTime, onSeek }: TranscriptionWithTimestampsProps) => {
    // If no timestamps available, just render plain text
    if (!timestamps || timestamps.length === 0) {
        return (
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {transcription}
            </p>
        );
    }

    // Build transcription from timestamps array
    // This ensures accurate word-to-timestamp mapping
    return (
        <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {timestamps.map((timestamp, index) => {
                const isPunctuation = timestamp.type === 'punctuation' || timestamp.start_time === null;
                const isActive = !isPunctuation && timestamp.start_time !== null && timestamp.end_time !== null
                    ? currentTime >= timestamp.start_time && currentTime <= timestamp.end_time
                    : false;
                
                // Add space before pronunciation items (words), but not before punctuation
                const needsSpaceBefore = index > 0 && 
                    timestamp.type === 'pronunciation' && 
                    timestamps[index - 1]?.type !== 'punctuation';

                if (isPunctuation) {
                    // Punctuation is not clickable and attaches directly to previous word
                    return (
                        <span key={index}>
                            {timestamp.content}
                        </span>
                    );
                }

                return (
                    <span key={index}>
                        {needsSpaceBefore && <span> </span>}
                        <button
                            onClick={() => timestamp.start_time !== null && onSeek(timestamp.start_time)}
                            className={`
                                inline transition-colors duration-150 rounded px-1 py-0.5 -mx-1
                                ${isActive 
                                    ? 'bg-primary/20 text-primary font-medium' 
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }
                            `}
                            title={timestamp.start_time !== null ? `Seek to ${timestamp.start_time.toFixed(2)}s` : undefined}
                        >
                            {timestamp.content}
                        </button>
                    </span>
                );
            })}
        </div>
    );
};

function Recordings({ appointment, patient, encounter, recordings = [], practitioners = [], user_role = 'admin' }: Props) {
    const hasLoadedData = useRef(false);

    // Fetch data using partial reload when data is null
    useEffect(() => {
        // Prevent infinite loop: only load once
        if (!patient && !hasLoadedData.current && appointment?.id) {
            hasLoadedData.current = true;

            router.reload({
                only: ['patient', 'encounter', 'recordings', 'practitioners'],
                onError: (errors) => {
                    console.error('Failed to load recordings data:', errors);
                    toast.error('Failed to load recordings', {
                        description: 'Please refresh the page to try again.',
                    });
                    hasLoadedData.current = false; // Reset on error to allow retry
                },
            });
        } else if (patient) {
            // Data already loaded, mark as loaded to prevent re-triggering
            hasLoadedData.current = true;
        }
    }, [patient, appointment?.id]);

    const [playingId, setPlayingId] = useState<number | null>(null);
    const [loadingId, setLoadingId] = useState<number | null>(null);
    const [errorId, setErrorId] = useState<number | null>(null);
    const [transcribingId, setTranscribingId] = useState<number | null>(null);
    const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(
        recordings.length > 0 ? recordings[0].id : null
    );
    const [audioDurations, setAudioDurations] = useState<{ [key: number]: number }>({});
    const [currentTime, setCurrentTime] = useState<{ [key: number]: number }>({});
    const audioRefs = useRef<{ [key: number]: HTMLAudioElement }>({});
    const [speakerNameEditorOpen, setSpeakerNameEditorOpen] = useState(false);
    const [speakerNames, setSpeakerNames] = useState<{ [key: number]: { [key: string]: string } }>({});

    // Show loading state while data is being fetched
    if (!patient || !recordings) {
        return (
            <>
                <Head title="Session Recordings" />
                <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading recordings data...</p>
                    </div>
                </div>
            </>
        );
    }

    const selectedRecording = recordings.find(r => r.id === selectedRecordingId) || recordings[0] || null;

    // Helper function to get duration for a recording (from audio metadata or database)
    const getRecordingDuration = (recording: Recording): number | null => {
        // First check if we have it from audio metadata
        if (audioDurations[recording.id]) {
            return audioDurations[recording.id];
        }
        // Fall back to database value
        return recording.duration_seconds;
    };

    // Log recordings data on mount and initialize speaker names
    useEffect(() => {
        console.log('=== Recordings Component Mounted ===');
        console.log('Recordings count:', recordings.length);
        recordings.forEach((recording, index) => {
            console.log(`Recording ${index + 1}:`, {
                id: recording.id,
                file_name: recording.file_name,
                mime_type: recording.mime_type,
                file_size: recording.file_size,
                duration_seconds: recording.duration_seconds,
                has_signed_url: !!recording.signed_url,
                signed_url_preview: recording.signed_url?.substring(0, 100),
                created_at: recording.created_at,
            });

            // Initialize speaker names from recording
            if (recording.speaker_names) {
                setSpeakerNames(prev => ({
                    ...prev,
                    [recording.id]: recording.speaker_names!,
                }));
            }
        });
        console.log('=== End Recordings Data ===');
    }, [recordings]);

    // Preload audio metadata to get durations for recordings without duration_seconds
    useEffect(() => {
        recordings.forEach((recording) => {
            // Skip if we already have duration from database or already loaded
            if (recording.duration_seconds || audioDurations[recording.id] || !recording.signed_url) {
                return;
            }

            // Create a temporary audio element to load metadata
            const audio = new Audio(recording.signed_url);
            audio.crossOrigin = 'anonymous';
            audio.preload = 'metadata';

            const handleLoadedMetadata = () => {
                if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                    setAudioDurations(prev => ({
                        ...prev,
                        [recording.id]: Math.floor(audio.duration)
                    }));
                }
                // Clean up
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
                audio.removeEventListener('error', handleError);
            };

            const handleError = () => {
                // Clean up on error
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
                audio.removeEventListener('error', handleError);
            };

            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            audio.addEventListener('error', handleError);
        });
    }, [recordings, audioDurations]);

    const handlePlayPause = async (recording: Recording) => {
        console.log('=== Audio Playback Debug ===');
        console.log('Recording ID:', recording.id);
        console.log('File name:', recording.file_name);
        console.log('MIME type:', recording.mime_type);
        console.log('File size:', recording.file_size);
        console.log('Signed URL available:', !!recording.signed_url);
        console.log('Signed URL (first 100 chars):', recording.signed_url?.substring(0, 100));

        if (!recording.signed_url) {
            console.error('❌ No signed URL available for recording', recording.id);
            setErrorId(recording.id);
            return;
        }

        let audio = audioRefs.current[recording.id];

        // Create audio element if it doesn't exist
        if (!audio) {
            try {
                console.log('📝 Creating new audio element for recording', recording.id);
                setLoadingId(recording.id);
                setErrorId(null);
                
                audio = new Audio(recording.signed_url);
                console.log('✅ Audio element created');
                
                // Log audio element properties
                console.log('Audio element properties:', {
                    src: audio.src.substring(0, 100),
                    crossOrigin: audio.crossOrigin,
                    readyState: audio.readyState,
                    networkState: audio.networkState,
                });

                // Add event listeners with detailed logging
                audio.addEventListener('loadstart', () => {
                    console.log('🔄 Audio loadstart event - Starting to load', recording.id);
                });

                audio.addEventListener('loadedmetadata', () => {
                    console.log('📊 Audio loadedmetadata event', recording.id, {
                        duration: audio.duration,
                        readyState: audio.readyState,
                    });
                    // Capture duration from audio metadata if available
                    if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                        setAudioDurations(prev => ({
                            ...prev,
                            [recording.id]: Math.floor(audio.duration)
                        }));
                    }
                });

                audio.addEventListener('loadeddata', () => {
                    console.log('✅ Audio loadeddata event - Data loaded', recording.id, {
                        readyState: audio.readyState,
                        duration: audio.duration,
                    });
                    setLoadingId(null);
                });

                audio.addEventListener('canplay', () => {
                    console.log('▶️ Audio canplay event - Ready to play', recording.id, {
                        readyState: audio.readyState,
                        duration: audio.duration,
                    });
                    setLoadingId(null);
                });

                audio.addEventListener('canplaythrough', () => {
                    console.log('🎵 Audio canplaythrough event - Can play through', recording.id);
                    setLoadingId(null);
                });

                audio.addEventListener('progress', () => {
                    console.log('📈 Audio progress event', recording.id, {
                        buffered: audio.buffered.length > 0 ? audio.buffered.end(0) : 0,
                        readyState: audio.readyState,
                    });
                });

                audio.addEventListener('error', (e) => {
                    console.error('❌ Audio error event for recording', recording.id, {
                        error: e,
                        errorCode: audio.error?.code,
                        errorMessage: audio.error?.message,
                        networkState: audio.networkState,
                        readyState: audio.readyState,
                        src: audio.src.substring(0, 100),
                    });
                    setLoadingId(null);
                    setErrorId(recording.id);
                    setPlayingId(null);
                });

                audio.addEventListener('stalled', () => {
                    console.warn('⚠️ Audio stalled event - Download stalled', recording.id);
                });

                audio.addEventListener('suspend', () => {
                    console.warn('⏸️ Audio suspend event - Download suspended', recording.id);
                });

                audio.addEventListener('abort', () => {
                    console.warn('🛑 Audio abort event - Download aborted', recording.id);
                });

                audio.addEventListener('ended', () => {
                    console.log('🏁 Audio ended event - Playback finished', recording.id);
                    setPlayingId(null);
                });

                audio.addEventListener('pause', () => {
                    console.log('⏸️ Audio pause event', recording.id);
                    if (playingId === recording.id) {
                        setPlayingId(null);
                    }
                });

                audio.addEventListener('play', () => {
                    console.log('▶️ Audio play event - Started playing', recording.id);
                });

                audio.addEventListener('playing', () => {
                    console.log('🎵 Audio playing event - Currently playing', recording.id);
                });

                audio.addEventListener('waiting', () => {
                    console.warn('⏳ Audio waiting event - Waiting for data', recording.id);
                });

                audio.addEventListener('timeupdate', () => {
                    if (audio.currentTime && isFinite(audio.currentTime)) {
                        setCurrentTime(prev => ({
                            ...prev,
                            [recording.id]: audio.currentTime
                        }));
                    }
                });

                // Set CORS attribute for cross-origin requests
                audio.crossOrigin = 'anonymous';
                console.log('🌐 Set CORS to anonymous');
                
                audioRefs.current[recording.id] = audio;
                console.log('💾 Audio element stored in refs');
            } catch (error) {
                console.error('❌ Failed to create audio element', {
                    error,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                setLoadingId(null);
                setErrorId(recording.id);
                return;
            }
        } else {
            console.log('♻️ Using existing audio element for recording', recording.id, {
                paused: audio.paused,
                readyState: audio.readyState,
                currentTime: audio.currentTime,
                duration: audio.duration,
            });
            // Ensure timeupdate listener is attached
            if (!audio.ontimeupdate) {
                audio.addEventListener('timeupdate', () => {
                    if (audio.currentTime && isFinite(audio.currentTime)) {
                        setCurrentTime(prev => ({
                            ...prev,
                            [recording.id]: audio.currentTime
                        }));
                    }
                });
            }
            // Initialize current time if not set
            if (audio.currentTime && !currentTime[recording.id]) {
                setCurrentTime(prev => ({
                    ...prev,
                    [recording.id]: audio.currentTime
                }));
            }
        }

        // Stop any currently playing audio
        Object.values(audioRefs.current).forEach(a => {
            if (a !== audio && !a.paused) {
                console.log('🛑 Stopping other audio');
                a.pause();
                a.currentTime = 0;
            }
        });

        if (playingId === recording.id) {
            // Pause current recording
            console.log('⏸️ Pausing current recording', recording.id);
            audio.pause();
            setPlayingId(null);
        } else {
            // Play the recording
            try {
                console.log('▶️ Attempting to play recording', recording.id, {
                    paused: audio.paused,
                    readyState: audio.readyState,
                    networkState: audio.networkState,
                });
                setErrorId(null);
                
                const playPromise = audio.play();
                console.log('📝 Play promise created', playPromise);
                
                if (playPromise !== undefined) {
                    await playPromise;
                    console.log('✅ Play promise resolved - Audio is playing', recording.id);
                    setPlayingId(recording.id);
                } else {
                    console.log('✅ Audio started playing (no promise)', recording.id);
                    setPlayingId(recording.id);
                }
            } catch (error) {
                console.error('❌ Failed to play audio', {
                    error,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    errorName: error instanceof Error ? error.name : undefined,
                    stack: error instanceof Error ? error.stack : undefined,
                    audioState: {
                        paused: audio.paused,
                        readyState: audio.readyState,
                        networkState: audio.networkState,
                        error: audio.error,
                    },
                });
                setErrorId(recording.id);
                setPlayingId(null);
            }
        }
        console.log('=== End Audio Playback Debug ===');
    };

    const handleSeek = (recording: Recording, seekTime: number) => {
        const audio = audioRefs.current[recording.id];
        if (audio && !isNaN(audio.duration)) {
            const clampedTime = Math.max(0, Math.min(seekTime, audio.duration));
            audio.currentTime = clampedTime;
            setCurrentTime(prev => ({
                ...prev,
                [recording.id]: clampedTime
            }));
        }
    };

    const handleDownload = (recording: Recording) => {
        if (recording.signed_url) {
            const link = document.createElement('a');
            link.href = recording.signed_url;
            link.download = recording.file_name || `recording_${recording.id}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleSaveSpeakerNames = async (recording: Recording, names: { [key: string]: string }) => {
        if (!encounter) {
            return;
        }

        try {
            const response = await fetch(route('encounters.recordings.speaker-names', {
                encounter: encounter.id,
                recording: recording.id,
            }), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ speaker_names: names }),
            });

            const data = await response.json();

            if (data.success) {
                // Update local state
                setSpeakerNames(prev => ({
                    ...prev,
                    [recording.id]: names,
                }));
                
                // Reload the page to show updated speaker names
                router.reload({ only: ['recordings'] });
            } else {
                throw new Error(data.message || 'Failed to save speaker names');
            }
        } catch (error) {
            console.error('Error saving speaker names:', error);
            alert('Failed to save speaker names. Please try again.');
            throw error;
        }
    };

    const handleTranscribe = async (recording: Recording) => {
        if (!encounter) {
            return;
        }

        // Check if already processing or completed
        if (recording.transcription_status === 'processing' || recording.transcription_status === 'pending') {
            return;
        }

        if (recording.transcription_status === 'completed' && recording.transcription) {
            return;
        }

        setTranscribingId(recording.id);

        try {
            const response = await fetch(route('encounters.recordings.transcribe', {
                encounter: encounter.id,
                recording: recording.id,
            }), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                // Reload the page to show updated transcription status
                router.reload({ only: ['recordings'] });
            } else {
                alert(data.message || 'Failed to start transcription');
                setTranscribingId(null);
            }
        } catch (error) {
            console.error('Error starting transcription:', error);
            alert('Failed to start transcription. Please try again.');
            setTranscribingId(null);
        }
    };

    const getTranscriptionStatusBadge = (status: string | null | undefined) => {
        if (!status) {
            return null;
        }

        const statusConfig = {
            pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
            processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
            completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
            failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

        return (
            <Badge className={config.className}>
                {config.label}
            </Badge>
        );
    };

    // Generate AI Summary placeholder (static for now)
    const generateAISummary = (): string => {
        if (recordings.length === 0) {
            return 'No recordings available to generate summary.';
        }

        const completedTranscriptions = recordings.filter(
            r => r.transcription_status === 'completed' && r.transcription
        );

        if (completedTranscriptions.length === 0) {
            return 'Transcribe recordings to generate AI summary.';
        }

        return `This document consolidates ${recordings.length} recording${recordings.length > 1 ? 's' : ''} from the appointment session. The recordings cover the patient consultation, including discussions about symptoms, medical history, examination findings, and treatment recommendations. Key topics discussed include the patient's chief complaint, relevant medical history, physical examination observations, clinical assessment, and the proposed treatment plan. The session provides a comprehensive overview of the patient encounter, documenting the practitioner's clinical reasoning and decision-making process.`;
    };

    return (
        <>
            <Head title="Session Recordings" />

            {/* Tabs Navigation */}
            <AppointmentTabs 
                appointmentId={appointment.id}
                encounterId={encounter?.id}
                currentTab="recordings"
                userRole={user_role}
                appointmentStatus={appointment.status}
            />

            <div className="h-[calc(100vh-200px)] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
                    <div className="flex items-center gap-4">
                        <Link href={route('appointments.show', appointment.id)}>
                            <Button variant="outline" size="sm" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">
                                {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'} - Session Recordings
                            </h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {appointment.service.name} • {formatDateTime(appointment.appointment_datetime)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {recordings.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center"
                        >
                            <FileAudio className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recordings Available</h3>
                            <p className="text-gray-600">
                                There are no recordings for this appointment session.
                            </p>
                        </motion.div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Sidebar - Recordings List */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            className="w-80 border-r bg-gray-50/50 flex flex-col"
                        >
                            {/* <div className="p-4 border-b bg-white">
                                <h2 className="text-sm font-semibold text-gray-900 mb-1">Recordings</h2>
                                <p className="text-xs text-gray-500">{recordings.length} recording{recordings.length !== 1 ? 's' : ''}</p>
                            </div> */}
                            
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                <AnimatePresence>
                                    {recordings.map((recording, index) => (
                                        <motion.button
                                            key={recording.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => {
                                                setSelectedRecordingId(recording.id);
                                            }}
                                            className={`w-full text-left p-3 rounded-lg transition-all ${
                                                selectedRecordingId === recording.id
                                                    ? 'bg-white shadow-sm border border-gray-200'
                                                    : 'hover:bg-white/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                                    selectedRecordingId === recording.id
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    <FileAudio className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`text-sm font-medium mb-1 truncate ${
                                                        selectedRecordingId === recording.id
                                                            ? 'text-gray-900'
                                                            : 'text-gray-700'
                                                    }`}>
                                                        {truncateTitle(recording.file_name || `Recording ${recording.id}`, 25)}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span>{formatShortDate(recording.created_at)}</span>
                                                        {(() => {
                                                            const duration = formatDuration(getRecordingDuration(recording));
                                                            return duration ? (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{duration}</span>
                                                                </>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                    {recording.transcription_status && (
                                                        <div className="mt-1.5">
                                                            {getTranscriptionStatusBadge(recording.transcription_status)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </motion.div>

                        {/* Right Content Area */}
                        <div className="flex-1 flex flex-col bg-white overflow-hidden">
                            {selectedRecording ? (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Document Title */}
                                    {/* <div className="px-8 pt-6 pb-4 border-b">
                                     
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            {(() => {
                                                const duration = formatDuration(getRecordingDuration(selectedRecording));
                                                return duration ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-4 w-4" />
                                                        <span>{duration}</span>
                                                    </div>
                                                ) : null;
                                            })()}
                                            <div className="flex items-center gap-1.5">
                                                <span>{formatFileSize(selectedRecording.file_size)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span>{formatDateTime(selectedRecording.created_at)}</span>
                                            </div>
                                        </div>
                                    </div> */}

                                    {/* Audio Player Section */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="px-8 py-4 border-b bg-white"
                                    >
                                        <div className="max-w-4xl mx-auto">
                                            <div className="flex items-center gap-4">
                                                {/* Play/Pause Button */}
                                                <button
                                                    onClick={() => handlePlayPause(selectedRecording)}
                                                    disabled={!selectedRecording.signed_url || loadingId === selectedRecording.id}
                                                    className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                >
                                                    {loadingId === selectedRecording.id ? (
                                                        <Loader2 className="h-5 w-5 animate-spin" />
                                                    ) : playingId === selectedRecording.id ? (
                                                        <Pause className="h-5 w-5" />
                                                    ) : (
                                                        <Play className="h-5 w-5 ml-0.5" />
                                                    )}
                                                </button>

                                                {/* Progress Bar and Time */}
                                                <div className="flex-1 flex items-center gap-3">
                                                    {/* Current Time */}
                                                    <span className="text-xs text-gray-600 font-mono tabular-nums min-w-[45px]">
                                                        {(() => {
                                                            const time = currentTime[selectedRecording.id] || 0;
                                                            return formatDuration(Math.floor(time)) || '0:00';
                                                        })()}
                                                    </span>

                                                    {/* Progress Bar */}
                                                    <div className="flex-1 relative group">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max={getRecordingDuration(selectedRecording) || 0}
                                                            value={currentTime[selectedRecording.id] || 0}
                                                            onChange={(e) => handleSeek(selectedRecording, parseFloat(e.target.value))}
                                                            disabled={!selectedRecording.signed_url || !getRecordingDuration(selectedRecording)}
                                                            className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-primary hover:h-2 transition-all"
                                                            style={{
                                                                background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((currentTime[selectedRecording.id] || 0) / (getRecordingDuration(selectedRecording) || 1)) * 100}%, rgb(229, 231, 235) ${((currentTime[selectedRecording.id] || 0) / (getRecordingDuration(selectedRecording) || 1)) * 100}%, rgb(229, 231, 235) 100%)`
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Duration */}
                                                    <span className="text-xs text-gray-600 font-mono tabular-nums min-w-[45px]">
                                                        {formatDuration(getRecordingDuration(selectedRecording)) || '--:--'}
                                                    </span>
                                                </div>

                                                {/* Download Button */}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDownload(selectedRecording)}
                                                    disabled={!selectedRecording.signed_url}
                                                    className="h-8 w-8 p-0 flex-shrink-0"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Error Message */}
                                            {errorId === selectedRecording.id && (
                                                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    <span>Error playing recording</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Transcription Section */}
                                    <div className="flex-1 overflow-y-auto">
                                        <div className="px-8 py-6">
                                            <div className="max-w-4xl mx-auto">
                                                <div className="mb-4">
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                                                        <FileText className="h-5 w-5" />
                                                        Transcription
                                                    </h3>
                                                    <p className="text-sm text-gray-500">Full transcript of the selected recording</p>
                                                </div>
                                                
                                                <AnimatePresence mode="wait">
                                                    <motion.div
                                                        key={`transcript-${selectedRecording.id}`}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        {selectedRecording.transcription_status === 'completed' && selectedRecording.transcription ? (
                                                            <>
                                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                                                                    {selectedRecording.transcription_speaker_segments && selectedRecording.transcription_speaker_segments.length > 0 ? (
                                                                        <SpeakerTranscription
                                                                            speakerSegments={selectedRecording.transcription_speaker_segments}
                                                                            currentTime={currentTime[selectedRecording.id] || 0}
                                                                            onSeek={(time) => handleSeek(selectedRecording, time)}
                                                                            speakerNames={selectedRecording.speaker_names || speakerNames[selectedRecording.id] || null}
                                                                            onEditSpeakerNames={() => setSpeakerNameEditorOpen(true)}
                                                                        />
                                                                    ) : (
                                                                        <TranscriptionWithTimestamps
                                                                            transcription={selectedRecording.transcription}
                                                                            timestamps={selectedRecording.transcription_timestamps}
                                                                            currentTime={currentTime[selectedRecording.id] || 0}
                                                                            onSeek={(time) => handleSeek(selectedRecording, time)}
                                                                        />
                                                                    )}
                                                                </div>
                                                                {selectedRecording.transcription_speaker_segments && selectedRecording.transcription_speaker_segments.length > 0 && (
                                                                    <SpeakerNameEditor
                                                                        open={speakerNameEditorOpen}
                                                                        onOpenChange={setSpeakerNameEditorOpen}
                                                                        speakerSegments={selectedRecording.transcription_speaker_segments}
                                                                        currentSpeakerNames={selectedRecording.speaker_names || speakerNames[selectedRecording.id] || null}
                                                                        onSave={(names) => handleSaveSpeakerNames(selectedRecording, names)}
                                                                    />
                                                                )}
                                                            </>
                                                        ) : selectedRecording.transcription_status === 'processing' || selectedRecording.transcription_status === 'pending' ? (
                                                            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                                                <p className="text-gray-600">Transcription in progress...</p>
                                                            </div>
                                                        ) : selectedRecording.transcription_status === 'failed' ? (
                                                            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                                <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
                                                                <p className="text-gray-600 mb-4">Transcription failed</p>
                                                                {encounter && (
                                                                    <Button
                                                                        onClick={() => handleTranscribe(selectedRecording)}
                                                                        disabled={transcribingId === selectedRecording.id}
                                                                    >
                                                                        {transcribingId === selectedRecording.id ? (
                                                                            <>
                                                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                                Starting...
                                                                            </>
                                                                        ) : (
                                                                            'Retry Transcription'
                                                                        )}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transcript Available</h3>
                                                                <p className="text-gray-600 mb-6 text-center max-w-md">
                                                                    Transcribe this recording to view the transcript and generate summaries.
                                                                </p>
                                                                {encounter && (
                                                                    <Button
                                                                        onClick={() => handleTranscribe(selectedRecording)}
                                                                        disabled={transcribingId === selectedRecording.id}
                                                                        className="gap-2"
                                                                    >
                                                                        {transcribingId === selectedRecording.id ? (
                                                                            <>
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Starting...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <FileText className="h-4 w-4" />
                                                                                Transcribe Recording
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                </AnimatePresence>

                                               
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <FileAudio className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Recording</h3>
                                        <p className="text-gray-600">
                                            Choose a recording from the sidebar to view details.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default withAppLayout(Recordings, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'Session Recordings' }
    ]
});

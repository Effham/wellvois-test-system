import { useState, useRef, useEffect, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { motion, AnimatePresence } from 'framer-motion';
import { withAppLayout } from '@/utils/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Play, Pause, Download, Clock, FileAudio, AlertCircle, FileText, Loader2, Brain, Sparkles, Mic, CheckCircle2, XCircle, SkipBack, SkipForward } from 'lucide-react';
import AppointmentTabs from '@/components/appointments/AppointmentTabs';
import { formatDateTime } from '@/hooks/use-time-locale';

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
    patient: Patient | null;
    encounter: Encounter | null;
    recordings: Recording[];
    practitioners: Practitioner[];
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

const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '0:00';
    const totalSeconds = Math.floor(Math.max(0, seconds));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function Recordings({ appointment, patient, encounter, recordings, practitioners, user_role = 'admin' }: Props) {
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentRecordingIndex, setCurrentRecordingIndex] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isPreloading, setIsPreloading] = useState<boolean>(true);
    const [preloadProgress, setPreloadProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [transcribingId, setTranscribingId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<string>('recordings');
    const [actualTotalDuration, setActualTotalDuration] = useState<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const currentRecordingIndexRef = useRef<number>(0);
    const isPlayingRef = useRef<boolean>(false);
    const recordingDurationsRef = useRef<Map<number, number>>(new Map());

    // Calculate cumulative start times for each recording
    const recordingBreakpoints = useMemo(() => {
        return recordings.reduce((acc, recording, index) => {
            const previousDuration = acc.length > 0 ? acc[acc.length - 1].cumulativeEnd : 0;
            // Try to get duration from stored values first (from audio metadata), then from recording data
            const storedDuration = recordingDurationsRef.current.get(recording.id);
            const duration = storedDuration || recording.duration_seconds || 0;
            acc.push({
                recording,
                startTime: previousDuration,
                endTime: previousDuration + duration,
                cumulativeEnd: previousDuration + duration,
            });
            return acc;
        }, [] as Array<{ recording: Recording; startTime: number; endTime: number; cumulativeEnd: number }>);
    }, [recordings, actualTotalDuration]);

    // Calculate total duration from breakpoints
    const calculatedTotalDuration = recordingBreakpoints.length > 0 
        ? recordingBreakpoints[recordingBreakpoints.length - 1].cumulativeEnd 
        : 0;
    
    // Use actual total duration if available (from audio metadata), otherwise use calculated
    const totalDuration = actualTotalDuration > 0 ? actualTotalDuration : calculatedTotalDuration;

    // Find which recording is currently playing based on currentTime
    const getCurrentRecordingIndex = (time: number): number => {
        for (let i = 0; i < recordingBreakpoints.length; i++) {
            if (time >= recordingBreakpoints[i].startTime && time < recordingBreakpoints[i].endTime) {
                return i;
            }
        }
        return recordingBreakpoints.length > 0 ? recordingBreakpoints.length - 1 : 0;
    };

    // Load and play a specific recording
    const loadAndPlayRecording = async (index: number, shouldPlay: boolean = false) => {
        if (index < 0 || index >= recordings.length) {
            setError(`Invalid recording index: ${index}`);
            return;
        }

        const recording = recordings[index];
        if (!recording?.signed_url) {
            setError(`Recording ${index + 1} URL not available`);
            return;
        }

        if (!audioRef.current) {
            setError('Audio player not initialized');
            return;
        }

        console.log(`Loading recording ${index + 1} of ${recordings.length}, shouldPlay: ${shouldPlay || isPlayingRef.current}`);

        setIsLoading(true);
        setError(null);
        setCurrentRecordingIndex(index);
        currentRecordingIndexRef.current = index;

        try {
            // Set source and wait for it to load
            audioRef.current.src = recording.signed_url;
            audioRef.current.currentTime = 0;
            
            // Wait for metadata to load
            await new Promise<void>((resolve, reject) => {
                if (!audioRef.current) {
                    reject(new Error('Audio element not available'));
                    return;
                }

                const handleCanPlay = () => {
                    if (audioRef.current) {
                        audioRef.current.removeEventListener('canplay', handleCanPlay);
                        audioRef.current.removeEventListener('error', handleError);
                    }
                    resolve();
                };

                const handleError = () => {
                    if (audioRef.current) {
                        audioRef.current.removeEventListener('canplay', handleCanPlay);
                        audioRef.current.removeEventListener('error', handleError);
                    }
                    reject(new Error('Failed to load audio'));
                };

                if (audioRef.current.readyState >= 2) {
                    // Already loaded
                    resolve();
                } else {
                    audioRef.current.addEventListener('canplay', handleCanPlay);
                    audioRef.current.addEventListener('error', handleError);
                    audioRef.current.load();
                }
            });

            setIsLoading(false);

            // Play if we're supposed to be playing
            const playNow = shouldPlay || isPlayingRef.current;
            if (playNow && audioRef.current) {
                console.log(`Playing recording ${index + 1}`);
                await audioRef.current.play();
            }
        } catch (err) {
            console.error('Error loading recording:', err);
            setError(`Failed to load recording ${index + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setIsLoading(false);
            setIsPlaying(false);
            isPlayingRef.current = false;
        }
    };

    // Preload all recordings and get their durations
    useEffect(() => {
        if (recordings.length === 0) {
            setIsPreloading(false);
            return;
        }

        const preloadAllRecordings = async () => {
            setIsPreloading(true);
            setPreloadProgress(0);
            setError(null);

            const audioElements: HTMLAudioElement[] = [];
            const loadPromises: Promise<void>[] = [];
            const validRecordings = recordings.filter(r => r.signed_url);
            const progressIncrement = validRecordings.length > 0 ? 100 / validRecordings.length : 100;

            // Create audio elements for all recordings
            recordings.forEach((recording, index) => {
                if (!recording.signed_url) {
                    console.warn(`Recording ${index + 1} has no signed URL`);
                    // Use stored duration_seconds if available
                    if (recording.duration_seconds) {
                        recordingDurationsRef.current.set(recording.id, recording.duration_seconds);
                    }
                    return;
                }

                const audio = new Audio();
                audio.crossOrigin = 'anonymous';
                audio.preload = 'metadata';
                audio.src = recording.signed_url;

                const loadPromise = new Promise<void>((resolve, reject) => {
                    const handleLoadedMetadata = () => {
                        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
                            recordingDurationsRef.current.set(recording.id, audio.duration);
                            console.log(`Loaded recording ${index + 1}: ${audio.duration.toFixed(2)}s`);
                        } else {
                            // Use stored duration_seconds if available
                            if (recording.duration_seconds) {
                                recordingDurationsRef.current.set(recording.id, recording.duration_seconds);
                            }
                        }
                        
                        setPreloadProgress((prev) => prev + progressIncrement);
                        resolve();
                    };

                    const handleError = () => {
                        console.warn(`Failed to load metadata for recording ${index + 1}`);
                        // Use stored duration_seconds if available
                        if (recording.duration_seconds) {
                            recordingDurationsRef.current.set(recording.id, recording.duration_seconds);
                        }
                        setPreloadProgress((prev) => prev + progressIncrement);
                        resolve(); // Don't reject, just use fallback duration
                    };

                    audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
                    audio.addEventListener('error', handleError, { once: true });
                    audio.load();
                });

                audioElements.push(audio);
                loadPromises.push(loadPromise);
            });

            try {
                // Wait for all recordings to load
                await Promise.all(loadPromises);

                // Calculate total duration
                let newTotal = 0;
                recordings.forEach((rec) => {
                    const storedDuration = recordingDurationsRef.current.get(rec.id);
                    const duration = storedDuration || rec.duration_seconds || 0;
                    newTotal += duration;
                });

                if (newTotal > 0) {
                    setActualTotalDuration(newTotal);
                }

                console.log(`All recordings preloaded. Total duration: ${newTotal.toFixed(2)}s`);
                setIsPreloading(false);
                setPreloadProgress(100);

                // Clean up temporary audio elements
                audioElements.forEach(audio => {
                    audio.src = '';
                    audio.remove();
                });
            } catch (err) {
                console.error('Error preloading recordings:', err);
                setError('Failed to preload some recordings');
                setIsPreloading(false);
            }
        };

        preloadAllRecordings();
    }, [recordings]);

    // Initialize audio player
    useEffect(() => {
        if (recordings.length === 0 || !recordings[0]?.signed_url || isPreloading) {
                return;
        }

        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        
        // Set up event listeners
        const handleLoadedMetadata = () => {
            setIsLoading(false);
        };

        const handleError = () => {
            setIsLoading(false);
            setError('Failed to load audio');
            setIsPlaying(false);
        };

        const handleEnded = async () => {
            // Move to next recording or stop
            const currentIdx = currentRecordingIndexRef.current;
            const nextIndex = currentIdx + 1;
            const wasPlaying = isPlayingRef.current;
            
            console.log(`Recording ${currentIdx + 1} ended, moving to recording ${nextIndex + 1}, wasPlaying: ${wasPlaying}`);
            
            if (nextIndex < recordings.length) {
                // Update index first
                setCurrentRecordingIndex(nextIndex);
                currentRecordingIndexRef.current = nextIndex;
                
                // Load and play the next recording if we were playing
                try {
                    await loadAndPlayRecording(nextIndex, wasPlaying);
                } catch (err) {
                    console.error('Error transitioning to next recording:', err);
                    setError(`Failed to load recording ${nextIndex + 1}`);
                    setIsPlaying(false);
                    isPlayingRef.current = false;
            }
        } else {
                // All recordings finished
                console.log('All recordings finished');
                setIsPlaying(false);
                isPlayingRef.current = false;
                setCurrentTime(totalDuration);
                // Keep current index at last recording
            }
        };

        const handleTimeUpdate = () => {
            if (!audioRef.current) return;
            const idx = currentRecordingIndexRef.current;
            const recordingStart = recordingBreakpoints[idx]?.startTime || 0;
            const relativeTime = audioRef.current.currentTime;
            const absoluteTime = recordingStart + relativeTime;
            setCurrentTime(absoluteTime);
            
            // Note: We rely on the 'ended' event to transition between recordings
            // This prevents race conditions and ensures smooth transitions
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('error', handleError);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('timeupdate', handleTimeUpdate);

        audioRef.current = audio;

        // Preload the first recording (but don't auto-play)
        if (recordings[0]?.signed_url) {
            audio.src = recordings[0].signed_url;
            audio.load();
            // Set initial state
            setCurrentRecordingIndex(0);
            currentRecordingIndexRef.current = 0;
        }

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [recordings, recordingBreakpoints]);

    // Handle play/pause
    const handlePlayPause = async () => {
        if (!audioRef.current || recordings.length === 0) {
            setError('No recordings available');
            return;
        }

        if (isPlayingRef.current) {
            // Pause
            audioRef.current.pause();
            setIsPlaying(false);
            isPlayingRef.current = false;
        } else {
            // Play
            try {
                setIsLoading(true);
                setError(null);
                
                // If no source is loaded or we're at a different recording, load it first
                const currentSrc = audioRef.current.src;
                const expectedSrc = recordings[currentRecordingIndexRef.current]?.signed_url;
                
                if (!currentSrc || currentSrc !== expectedSrc) {
                    await loadAndPlayRecording(currentRecordingIndexRef.current, true);
                }
                
                // Ensure audio is ready
                if (audioRef.current.readyState < 2) {
                    await new Promise<void>((resolve, reject) => {
                        if (!audioRef.current) {
                            reject(new Error('Audio element not available'));
                            return;
                        }
                        
                        const handleCanPlay = () => {
                            if (audioRef.current) {
                                audioRef.current.removeEventListener('canplay', handleCanPlay);
                                audioRef.current.removeEventListener('error', handleError);
                            }
                            resolve();
                        };

                        const handleError = () => {
                            if (audioRef.current) {
                                audioRef.current.removeEventListener('canplay', handleCanPlay);
                                audioRef.current.removeEventListener('error', handleError);
                            }
                            reject(new Error('Failed to load audio'));
                        };

                        audioRef.current.addEventListener('canplay', handleCanPlay);
                        audioRef.current.addEventListener('error', handleError);
                        audioRef.current.load();
                    });
                }
                
                await audioRef.current.play();
                setIsPlaying(true);
                isPlayingRef.current = true;
                setIsLoading(false);
            } catch (err) {
                console.error('Error playing audio:', err);
                setError(`Failed to play audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setIsPlaying(false);
                isPlayingRef.current = false;
                setIsLoading(false);
            }
        }
    };

    // Jump to a specific time (which may be in a different recording)
    const handleSeek = async (time: number) => {
        if (!audioRef.current || recordingBreakpoints.length === 0 || totalDuration === 0) {
            return;
        }

        // Clamp time to valid range
        const clampedTime = Math.max(0, Math.min(time, totalDuration));
        
        const targetIndex = getCurrentRecordingIndex(clampedTime);
        const targetBreakpoint = recordingBreakpoints[targetIndex];
        
        if (!targetBreakpoint) {
            return;
        }

        const relativeTime = clampedTime - targetBreakpoint.startTime;
        const wasPlaying = isPlayingRef.current;
        const currentIdx = currentRecordingIndexRef.current;
        
        console.log(`Seeking to ${clampedTime.toFixed(2)}s (Recording ${targetIndex + 1}, relative: ${relativeTime.toFixed(2)}s)`);
        
        // If switching to a different recording, load it first
        if (targetIndex !== currentIdx) {
            setCurrentRecordingIndex(targetIndex);
            currentRecordingIndexRef.current = targetIndex;
            
            // Load the new recording
            try {
                setIsLoading(true);
                await loadAndPlayRecording(targetIndex, false); // Don't auto-play, we'll handle that
                
                // Wait a bit for the audio to be ready, then set the time
                if (audioRef.current) {
                    // Wait for canplay event
                    await new Promise<void>((resolve) => {
                        if (!audioRef.current) {
                            resolve();
                            return;
                        }
                        
                        if (audioRef.current.readyState >= 2) {
                            resolve();
                } else {
                            const handleCanPlay = () => {
                                if (audioRef.current) {
                                    audioRef.current.removeEventListener('canplay', handleCanPlay);
                                }
                                resolve();
                            };
                            audioRef.current.addEventListener('canplay', handleCanPlay);
                            audioRef.current.load();
                        }
                    });
                    
                    // Set the time after loading
                    const maxTime = targetBreakpoint.recording.duration_seconds || 0;
                    audioRef.current.currentTime = Math.max(0, Math.min(relativeTime, maxTime));
                    setIsLoading(false);
                    
                    // Resume playing if we were playing before
                    if (wasPlaying && audioRef.current) {
                        try {
                            await audioRef.current.play();
                        } catch (err) {
                            console.error('Error resuming playback after seek:', err);
                        }
                    }
                }
            } catch (err) {
                console.error('Error seeking to different recording:', err);
                setError('Failed to load recording for seek');
                setIsLoading(false);
            }
        } else {
            // Same recording, just seek
            if (audioRef.current) {
                const maxTime = targetBreakpoint.recording.duration_seconds || 0;
                audioRef.current.currentTime = Math.max(0, Math.min(relativeTime, maxTime));
                
                // Resume playing if we were playing before
                if (wasPlaying && audioRef.current.paused) {
                    try {
                        await audioRef.current.play();
                    } catch (err) {
                        console.error('Error resuming playback after seek:', err);
                    }
                }
            }
        }
        
        setCurrentTime(clampedTime);
    };

    // Jump to previous/next recording
    const handlePreviousRecording = async () => {
        if (currentRecordingIndexRef.current > 0) {
            const prevIndex = currentRecordingIndexRef.current - 1;
            setCurrentRecordingIndex(prevIndex);
            currentRecordingIndexRef.current = prevIndex;
            const wasPlaying = isPlayingRef.current;
            await loadAndPlayRecording(prevIndex, wasPlaying);
        }
    };

    const handleNextRecording = async () => {
        if (currentRecordingIndexRef.current < recordings.length - 1) {
            const nextIndex = currentRecordingIndexRef.current + 1;
            setCurrentRecordingIndex(nextIndex);
            currentRecordingIndexRef.current = nextIndex;
            const wasPlaying = isPlayingRef.current;
            await loadAndPlayRecording(nextIndex, wasPlaying);
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

    // Calculate total file size and transcription stats
    const totalSize = recordings.reduce((sum, r) => sum + r.file_size, 0);
    const completedTranscriptions = recordings.filter(r => r.transcription_status === 'completed').length;

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

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('appointments.show', appointment.id)}>
                            <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Session Recordings</h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">Appointment #{appointment.id}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
{/*                 
                {recordings.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                        >
                            <Card className="border-gray-200 dark:border-gray-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 hover:shadow-lg transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                            <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Recordings</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{recordings.length}</p>
                            </div>
                                        <motion.div 
                                            className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"
                                            whileHover={{ scale: 1.1 }}
                                            transition={{ type: "spring", stiffness: 400 }}
                                        >
                                            <Mic className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                        </motion.div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                        >
                            <Card className="border-gray-200 dark:border-gray-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 hover:shadow-lg transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                            <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Duration</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatDuration(totalDuration)}</p>
                            </div>
                                        <motion.div 
                                            className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"
                                            whileHover={{ scale: 1.1 }}
                                            transition={{ type: "spring", stiffness: 400 }}
                                        >
                                            <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                        </motion.div>
                            </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.3 }}
                        >
                            <Card className="border-gray-200 dark:border-gray-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 hover:shadow-lg transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                            <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Transcribed</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{completedTranscriptions}/{recordings.length}</p>
                            </div>
                                        <motion.div 
                                            className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                                            whileHover={{ scale: 1.1 }}
                                            transition={{ type: "spring", stiffness: 400 }}
                                        >
                                            <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                                        </motion.div>
                        </div>
                    </CardContent>
                </Card>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.4 }}
                        >
                            <Card className="border-gray-200 dark:border-gray-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 hover:shadow-lg transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                            <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Size</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatFileSize(totalSize)}</p>
                            </div>
                                        <motion.div 
                                            className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"
                                            whileHover={{ scale: 1.1 }}
                                            transition={{ type: "spring", stiffness: 400 }}
                                        >
                                            <FileAudio className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                        </motion.div>
                        </div>
                    </CardContent>
                </Card>
                        </motion.div>
                    </div>
                )} */}

                {/* Main Content Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-lg">
                        <TabsTrigger 
                            value="recordings" 
                            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800"
                        >
                            <Mic className="h-4 w-4 mr-2" />
                            Recordings
                            {recordings.length > 0 && (
                                <Badge variant="secondary" className="ml-2 bg-gray-200 dark:bg-gray-700">
                                    {recordings.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="ai-summary"
                            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800"
                        >
                            <Brain className="h-4 w-4 mr-2" />
                            AI Summary
                        </TabsTrigger>
                    </TabsList>

                    {/* Recordings Tab */}
                    <TabsContent value="recordings" className="space-y-6 mt-0">
                        <AnimatePresence mode="wait">
                {recordings.length === 0 ? (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Card className="border-gray-200 dark:border-gray-800">
                                        <CardContent className="py-16">
                            <div className="text-center">
                                                <motion.div 
                                                    className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4"
                                                    animate={{ rotate: [0, 10, -10, 0] }}
                                                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                                >
                                                    <FileAudio className="h-8 w-8 text-gray-400" />
                                                </motion.div>
                                                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Recordings Available</h3>
                                                <p className="text-gray-600 dark:text-gray-400">
                                    There are no recordings for this appointment session.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                                </motion.div>
                            ) : isPreloading ? (
                                <motion.div
                                    key="preloading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card className="border-gray-200 dark:border-gray-800">
                                        <CardContent className="py-16">
                                            <div className="text-center">
                                                <motion.div 
                                                    className="h-16 w-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto mb-4"
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                >
                                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                                </motion.div>
                                                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                                    Loading Recordings
                                                </h3>
                                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                                    Preloading {recordings.length} recording{recordings.length !== 1 ? 's' : ''}...
                                                </p>
                                                <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                    <motion.div
                                                        className="bg-primary h-full rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${preloadProgress}%` }}
                                                        transition={{ duration: 0.3 }}
                                                    />
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                                    {Math.round(preloadProgress)}% complete
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="recordings"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-6"
                                >
                                    {/* Unified Audio Player */}
                                    <Card className="border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
                                <CardContent className="p-6">
                                            {/* Player Controls */}
                                            <div className="flex items-center gap-4 mb-6">
                                                <motion.button
                                                    onClick={handlePlayPause}
                                                    disabled={isLoading || recordings.length === 0 || isPreloading}
                                                    className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center hover:from-primary/90 hover:to-primary/70 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    transition={{ type: "spring", stiffness: 400 }}
                                                >
                                                    {isLoading ? (
                                                        <motion.div 
                                                            className="h-7 w-7 border-2 border-white border-t-transparent rounded-full"
                                                            animate={{ rotate: 360 }}
                                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        />
                                                    ) : isPlaying ? (
                                                        <Pause className="h-7 w-7" />
                                                    ) : (
                                                        <Play className="h-7 w-7 ml-1" />
                                                    )}
                                                </motion.button>

                                                <div className="flex-1">
                                                    {/* Timeline with Breakpoints */}
                                                    <div className="relative mb-2">
                                                        <div 
                                                            className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors group"
                                                            onClick={async (e) => {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const x = e.clientX - rect.left;
                                                                const percentage = Math.max(0, Math.min(1, x / rect.width));
                                                                const seekTime = percentage * totalDuration;
                                                                await handleSeek(seekTime);
                                                            }}
                                                            onMouseMove={(e) => {
                                                                if (totalDuration <= 0) return;
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const x = e.clientX - rect.left;
                                                                const percentage = Math.max(0, Math.min(1, x / rect.width));
                                                                const hoverTime = percentage * totalDuration;
                                                                e.currentTarget.setAttribute('title', `Seek to ${formatDuration(hoverTime)}`);
                                                            }}
                                                        >
                                                            {/* Progress Bar */}
                                                            <motion.div
                                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary/80 rounded-full z-10"
                                                                style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
                                                                transition={{ duration: 0.1 }}
                                                            />

                                                            {/* Breakpoints */}
                                                            {recordingBreakpoints.map((breakpoint, index) => (
                                                                <div
                                                                    key={breakpoint.recording.id}
                                                                    className={`absolute top-0 h-full w-1 bg-white dark:bg-gray-800 cursor-pointer hover:bg-primary hover:w-1.5 transition-all z-20 ${
                                                                        currentRecordingIndex === index ? 'bg-primary w-1.5' : ''
                                                                    }`}
                                                                    style={{ left: `${(breakpoint.startTime / totalDuration) * 100}%` }}
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        await handleSeek(breakpoint.startTime);
                                                                    }}
                                                                    title={`Jump to Recording ${index + 1} (${formatDuration(breakpoint.startTime)})`}
                                                                />
                                                            ))}
                                                        </div>
                                                </div>
                                                
                                                    {/* Time Display */}
                                                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                                                        <span>{formatDuration(currentTime)}</span>
                                                        <span>{formatDuration(totalDuration)}</span>
                                                        </div>
                                                    </div>

                                                {/* Navigation Buttons */}
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handlePreviousRecording}
                                                        disabled={currentRecordingIndex === 0}
                                                        className="border-gray-200 dark:border-gray-700"
                                                    >
                                                        <SkipBack className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleNextRecording}
                                                        disabled={currentRecordingIndex >= recordings.length - 1}
                                                        className="border-gray-200 dark:border-gray-700"
                                                    >
                                                        <SkipForward className="h-4 w-4" />
                                                    </Button>
                                                    </div>
                                                </div>

                                            {/* Current Recording Info */}
                                            {recordings[currentRecordingIndex] && (
                                                <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <div className="h-10 w-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                                                        <Mic className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                            Recording {currentRecordingIndex + 1} of {recordings.length}
                                                        </p>
                                                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                            {recordings[currentRecordingIndex].duration_seconds && (
                                                                <span>{formatDuration(recordings[currentRecordingIndex].duration_seconds!)}</span>
                                                            )}
                                                            <span>{formatFileSize(recordings[currentRecordingIndex].file_size)}</span>
                                                            <span>{formatDateTime(recordings[currentRecordingIndex].created_at)}</span>
                                                        </div>
                                                    </div>
                                                    </div>
                                                )}

                                            {/* Error Message */}
                                            {error && (
                                                <div className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-md border border-red-200 dark:border-red-900">
                                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                    <span>{error}</span>
                                                    </div>
                                                )}
                                        </CardContent>
                                    </Card>

                                    {/* Recordings List (without file names) */}
                                    <div className="space-y-3">
                                        {recordings.map((recording, index) => (
                                            <motion.div
                                                key={recording.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                            >
                                                <Card 
                                                    className={`border-gray-200 dark:border-gray-800 transition-all duration-200 ${
                                                        currentRecordingIndex === index 
                                                            ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                                                            : 'hover:border-gray-300 dark:hover:border-gray-700'
                                                    }`}
                                                >
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4 flex-1">
                                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                                                    currentRecordingIndex === index
                                                                        ? 'bg-primary text-primary-foreground'
                                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                                }`}>
                                                                    <FileAudio className="h-5 w-5" />
                                                        </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                                                            Recording {index + 1}
                                                                        </span>
                                                                        {currentRecordingIndex === index && (
                                                                            <Badge className="bg-primary text-primary-foreground">
                                                                                Playing
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                                        {recording.duration_seconds && (
                                                                            <div className="flex items-center gap-1">
                                                                                <Clock className="h-3 w-3" />
                                                                                <span>{formatDuration(recording.duration_seconds)}</span>
                                                    </div>
                                                )}
                                                                        <span>{formatFileSize(recording.file_size)}</span>
                                                                        <span>{formatDateTime(recording.created_at)}</span>
                                                                    </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                                            <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleTranscribe(recording)}
                                                disabled={
                                                    !encounter ||
                                                    transcribingId === recording.id ||
                                                    recording.transcription_status === 'processing' ||
                                                    recording.transcription_status === 'pending' ||
                                                    (recording.transcription_status === 'completed' && !!recording.transcription)
                                                }
                                                                    className="border-gray-200 dark:border-gray-700"
                                            >
                                                {transcribingId === recording.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Starting...
                                                    </>
                                                ) : recording.transcription_status === 'completed' && recording.transcription ? (
                                                    <>
                                                                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                                        Transcribed
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Transcribe
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownload(recording)}
                                                disabled={!recording.signed_url}
                                                                    className="border-gray-200 dark:border-gray-700"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                    </div>

                                                        {/* Transcription Status */}
                                                        {recording.transcription_status && (
                                                            <div className="mt-3 flex items-center gap-2">
                                                                {getTranscriptionStatusBadge(recording.transcription_status)}
                                                            </div>
                                                        )}

                                                        {/* Transcription Text */}
                                                        {recording.transcription_status === 'completed' && recording.transcription && (
                                                            <div className="mt-3 p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Transcription</span>
                                                                </div>
                                                                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                                                                    {recording.transcription}
                                                                </p>
                                                            </div>
                                                        )}
                                </CardContent>
                            </Card>
                                            </motion.div>
                        ))}
                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </TabsContent>

                    {/* AI Summary Tab */}
                    <TabsContent value="ai-summary" className="space-y-6 mt-0">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <Card className="border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
                            <CardHeader className="pb-4">
                                    <div className="flex items-center gap-3">
                                        <motion.div 
                                            className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg"
                                            animate={{ 
                                                boxShadow: [
                                                    "0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.2)",
                                                    "0 20px 25px -5px rgba(59, 130, 246, 0.4), 0 10px 10px -5px rgba(59, 130, 246, 0.2)",
                                                    "0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.2)"
                                                ]
                                            }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        >
                                            <Brain className="h-6 w-6 text-white" />
                                        </motion.div>
                                    <div>
                                        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                            AI Summary
                                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                                <Sparkles className="h-3 w-3 mr-1" />
                                                Powered by AI
                                            </Badge>
                                        </CardTitle>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Comprehensive summary of all session recordings
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Summary Content */}
                                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-8 min-h-[400px] shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">AI Generated Summary</span>
                                    </div>
                                    
                                    {recordings.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                                                <FileAudio className="h-8 w-8 text-blue-400" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Recordings Available</h3>
                                            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                                                AI summary will be generated once recordings are available for this appointment session.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                                    This is a placeholder for the AI-generated summary. The summary will analyze all recordings from this session and provide:
                                                </p>
                                                <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mt-4">
                                                    <li>Key discussion points and topics covered</li>
                                                    <li>Important decisions and action items</li>
                                                    <li>Patient concerns and practitioner responses</li>
                                                    <li>Treatment recommendations and next steps</li>
                                                    <li>Overall session insights and outcomes</li>
                                                </ul>
                                                <div className="mt-6 p-4 bg-white/60 dark:bg-gray-900/40 rounded-lg border border-blue-200 dark:border-blue-800">
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                                        <strong>Note:</strong> This is a static placeholder. The actual AI summary functionality will be implemented to process all recordings and generate comprehensive insights.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Summary Stats */}
                                {recordings.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Recordings Analyzed</p>
                                                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{recordings.length}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Duration</p>
                                                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDuration(totalDuration)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Transcriptions</p>
                                                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{completedTranscriptions}/{recordings.length}</p>
                                                </div>
                                            </div>
                                        </div>
                    </div>
                )}
                            </CardContent>
                        </Card>
                        </motion.div>
                    </TabsContent>
                </Tabs>
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


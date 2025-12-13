import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Clock, ClockIcon, Play, Square, Timer, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { formatTime, convertToTenantTimezone, getTenantTimezone } from '@/hooks/use-time-locale';
import { Skeleton } from './ui/skeleton';

interface AttendanceData {
    status: 'clocked_in' | 'clocked_out' | 'not_clocked_in';
    clock_in_time?: string;
    clock_out_time?: string;
    total_duration_minutes?: number;
    current_duration_minutes?: number;
}

interface AttendanceWidgetProps {
    userRole: string;
    hasSignedIn: boolean;
}

export function AttendanceWidget({ userRole, hasSignedIn }: AttendanceWidgetProps) {
    const [attendanceData, setAttendanceData] = useState<AttendanceData | any>({
        // status: 'not_clocked_in'
    });
    const [currentTime, setCurrentTime] = useState(() => convertToTenantTimezone(new Date()));
    const [showSignInPopover, setShowSignInPopover] = useState(false);
    const { auth } = usePage().props;

    // Don't show widget for patients
    if (userRole === 'patient') {
        return null;
    }

    // Update current time every second - always running for real-time updates using tenant timezone
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(convertToTenantTimezone(new Date()));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Calculate current duration if clocked in - using tenant timezone
    const getCurrentDuration = () => {
        if (attendanceData.status === 'clocked_in' && attendanceData.clock_in_time) {
            // Use current time in tenant timezone
            const now = convertToTenantTimezone(new Date());

            // Create clock-in time for today in tenant timezone
            const today = convertToTenantTimezone(new Date());
            const [hours, minutes, seconds] = attendanceData.clock_in_time.split(':').map(Number);
            const clockInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds || 0);

            // Calculate difference in minutes
            const diffMs = now.getTime() - clockInTime.getTime();
            const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));

            return diffMinutes;
        }
        return 0;
    };

    // Format duration to HH:MM
    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const handleClockIn = async () => {
        try {
            const response = await fetch(route('attendance.clock-in'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                toast.success(data.message || 'Successfully clocked in!');
                
                // Update attendance data immediately with clock-in time if provided
                if (data.clock_in_time) {
                    setAttendanceData(prev => ({
                        ...prev,
                        status: 'clocked_in',
                        clock_in_time: data.clock_in_time,
                        current_duration_minutes: 0
                    }));
                }
                
                // Also fetch fresh data from backend
                fetchAttendanceData();
                setShowSignInPopover(false); // Close the sign-in popover after successful clock-in
            } else {
                toast.error(data.message || 'Failed to clock in');
            }
        } catch (error) {
            console.error('Failed to clock in:', error);
            toast.error('Failed to clock in. Please try again.');
        }
    };

    const handleClockOut = async () => {
        try {
            const response = await fetch(route('attendance.clock-out'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                toast.success(data.message || 'Successfully clocked out!');
                if (data.total_duration_minutes) {
                    const hours = Math.floor(data.total_duration_minutes / 60);
                    const mins = data.total_duration_minutes % 60;
                    const durationText = `${hours}h ${mins}m`;
                    toast.info(`Total time today: ${durationText}`, { duration: 4000 });
                }
                fetchAttendanceData(); // Refresh attendance data
            } else {
                toast.error(data.message || 'Failed to clock out');
            }
        } catch (error) {
            console.error('Failed to clock out:', error);
            toast.error('Failed to clock out. Please try again.');
        }
    };

    const fetchAttendanceData = async () => {
        try {
            const response = await fetch(route('attendance.status'), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setAttendanceData(data);
            }
        } catch (error) {
            console.error('Failed to fetch attendance data:', error);
        }
    };

    // Fetch attendance data on component mount and periodically
    useEffect(() => {
        fetchAttendanceData();
        
        // Refresh attendance data every 5 minutes to sync status (not for real-time duration)
        const interval = setInterval(() => {
            fetchAttendanceData();
        }, 300000); // 5 minutes
        
        return () => clearInterval(interval);
    }, []);

    // Check if user should see sign-in popover
    // COMMENTED OUT: Popup disabled per user request
    // useEffect(() => {
    //     // Consider user as "signed in" if they have clocked in today
    //     const actuallySignedIn = attendanceData.status === 'clocked_in' || attendanceData.status === 'clocked_out';
    //     
    //     if (attendanceData.status === 'not_clocked_in' && !actuallySignedIn) {
    //         const timer = setTimeout(() => {
    //             setShowSignInPopover(true);
    //         }, 3000); // Show after 3 seconds of usage
    //         
    //         return () => clearTimeout(timer);
    //     }
    // }, [attendanceData.status]);

    const currentDuration = getCurrentDuration();

    return (
        <>
            {/* Sign-in Popover */}
            {/* COMMENTED OUT: Popup disabled per user request */}
            {/* {showSignInPopover && attendanceData.status !== 'clocked_in' && (
                <Popover open={showSignInPopover} onOpenChange={setShowSignInPopover}>
                    <PopoverTrigger asChild>
                        <div className="invisible"></div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-gray-900">Not Signed In</h4>
                                <p className="text-sm text-gray-600 mt-1">
                                    You haven't clocked in yet but you're using the system. 
                                    Would you like to clock in now?
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <Button size="sm" onClick={handleClockIn}>
                                        Clock In Now
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setShowSignInPopover(false)}>
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )} */}

            {/* Attendance Widget */}
            <div className="flex items-center gap-2">
                {/* Attendance Status */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-2 px-3 border-2 hover:border-primary/50 transition-all duration-200"
                        >
                            <div className="flex items-center gap-2">
                                {attendanceData.status === 'clocked_in' ? (
                                    <>
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            <Clock className="h-4 w-4 text-green-600" />
                                        </div>
                                        <span className="text-sm font-medium text-green-700">
                                            {formatDuration(currentDuration)}
                                        </span>
                                    </>
                                ) : attendanceData.status === 'clocked_out' ? (
                                    <>
                                        <Square className="h-4 w-4 text-gray-600" />
                                        <span className="text-sm font-medium text-gray-700">
                                            Clocked Out
                                        </span>
                                    </>
                                ) :!attendanceData?.status ? (
                                    <>
                                       <Skeleton className="h-[20px] w-[80px] rounded-full" />
                                    </>
                                )
                            :(
                                    <>
                                        <Timer className="h-4 w-4 text-gray-600" />
                                        <span className="text-sm font-medium text-gray-700">
                                            Not Clocked In
                                        </span>
                                    </>
                            )
                            }
                            </div>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                            <div className="text-center">
                                <h4 className="font-semibold text-gray-900 mb-2">Attendance Status</h4>
                                <Badge 
                                    variant={
                                        attendanceData.status === 'clocked_in' ? 'default' :
                                        attendanceData.status === 'clocked_out' ? 'secondary' : 'outline'
                                    }
                                    className="text-sm"
                                >
                                    {attendanceData.status === 'clocked_in' ? 'Clocked In' :
                                     attendanceData.status === 'clocked_out' ? 'Clocked Out' : 'Not Clocked In'}
                                </Badge>
                            </div>

                            {attendanceData.clock_in_time && (
                                <div className="text-center text-sm text-gray-600">
                                    Clock In: {formatTime(attendanceData.clock_in_time)}
                                    <div className="text-xs text-gray-500">{getTenantTimezone().split('/').pop()}</div>
                                </div>
                            )}

                            {attendanceData.status === 'clocked_in' && (
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600 mb-1">
                                        {formatDuration(currentDuration)}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Duration today
                                    </div>
                                </div>
                            )}

                            {attendanceData.status === 'clocked_out' && attendanceData.total_duration_minutes && (
                                <div className="text-center">
                                    <div className="text-lg font-semibold text-gray-700 mb-1">
                                        {formatDuration(attendanceData.total_duration_minutes)}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Total time today
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 justify-center">
                                {attendanceData.status === 'not_clocked_in' || attendanceData.status === 'clocked_out' ? (
                                    <Button onClick={handleClockIn} className="flex items-center gap-2">
                                        <Play className="h-4 w-4" />
                                        Clock In
                                    </Button>
                                ) : (
                                    <Button 
                                        onClick={handleClockOut} 
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <Square className="h-4 w-4" />
                                        Clock Out
                                    </Button>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </>
    );
}

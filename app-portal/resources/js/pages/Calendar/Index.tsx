import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import PageHeader from '@/components/general/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { formatTime, formatDateTime, getTenantTimezone } from '@/hooks/use-time-locale';
import { setUserTimezoneInSession, detectUserTimezone, getUserTimezoneAbbreviation } from '@/utils/user-timezone';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CalendarIcon, ClockIcon, MapPinIcon, UserIcon, ChevronLeftIcon, ChevronRightIcon, FilterIcon, BuildingIcon, SlidersHorizontalIcon, RotateCcw, X, Send, Check, AlertCircle, CheckCircle, Hourglass, XCircle } from 'lucide-react';
import { BreadcrumbItem } from '@/types';

type Appointment = {
    id: number | string;
    title: string;
    date: string;
    time: string;
    duration: number;
    patient: string;
    practitioner: string;
    type: string;
    status: 'confirmed' | 'pending' | 'urgent' | 'cancelled' | 'completed';
    location: string;
    clinic: string;
    notes?: string;
    source?: 'clinic' | 'google';
    clickable?: boolean;
    tenant_id?: string;
    mode?: string;
    appointment_datetime?: string;
    tenant_timezone?: string; // Tenant's timezone info
    timezone?: string; // Timezone the appointment is currently in
    utc_start_time?: string; // Explicit UTC time for conversion
    utc_end_time?: string; // Explicit UTC time for conversion
};

type CalendarPageProps = {
    appointments: Appointment[];
    currentDate: string;
    isCentral?: boolean;
    practitioner?: any;
    practitioners?: Array<{id: number; name: string}>; // For tenant calendar practitioner filter
};



const statusColors = {
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    urgent: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
};

const typeColors = {
    'General Consultation': 'bg-blue-50 border-l-blue-400',
    'Follow-up': 'bg-purple-50 border-l-purple-400',
    'Initial Consultation': 'bg-green-50 border-l-green-400',
    'Routine Checkup': 'bg-gray-50 border-l-gray-400',
    'Emergency': 'bg-red-50 border-l-red-400',
    'Physical Therapy': 'bg-orange-50 border-l-orange-400',
    'Diabetes Management': 'bg-indigo-50 border-l-indigo-400',
    'Pediatric Care': 'bg-pink-50 border-l-pink-400',
    'Vaccination': 'bg-cyan-50 border-l-cyan-400',
    'Mental Health': 'bg-teal-50 border-l-teal-400',
    'Cardiology': 'bg-rose-50 border-l-rose-400',
    'Laboratory': 'bg-amber-50 border-l-amber-400',
    'Orthopedic': 'bg-lime-50 border-l-lime-400',
    'Dermatology': 'bg-emerald-50 border-l-emerald-400',
    'Prenatal Care': 'bg-violet-50 border-l-violet-400',
    'Surgery': 'bg-red-100 border-l-red-500',
    'Neurology': 'bg-purple-100 border-l-purple-500',
    'Critical Care': 'bg-gray-100 border-l-gray-500',
    'Oncology': 'bg-rose-100 border-l-rose-500',
    'Dialysis': 'bg-cyan-100 border-l-cyan-500',
    'Diagnostic': 'bg-amber-100 border-l-amber-500',
    'Pain Management': 'bg-orange-100 border-l-orange-500',
    'Sleep Study': 'bg-slate-100 border-l-slate-500',
    'Dental Care': 'bg-lime-100 border-l-lime-500',
    'Eye Exam': 'bg-sky-100 border-l-sky-500',
    'Ophthalmology': 'bg-sky-100 border-l-sky-500',
    'Wound Care': 'bg-stone-100 border-l-stone-500',
    'Consultation': 'bg-blue-100 border-l-blue-500',
};

function getDaysInMonth(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get first day of week (0 = Sunday)
    const startDay = firstDay.getDay();
    
    const days: Date[] = [];
    
    // Add empty days for previous month
    for (let i = 0; i < startDay; i++) {
        const prevDate = new Date(year, month, -startDay + i + 1);
        days.push(prevDate);
    }
    
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }
    
    // Add days for next month to complete the grid (42 days = 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push(new Date(year, month + 1, i));
    }
    
    return days;
}

// Remove local formatTime function - using the one from use-time-locale hook instead

export default function CalendarIndex({ appointments, currentDate, isCentral = false, practitioner, practitioners = [] }: CalendarPageProps) {
    console.log('practitioner',practitioner)
    console.log('practitioners',practitioners)
    const breadcrumbs: BreadcrumbItem[] = isCentral
        ? [
            { title: 'Dashboard', href: '/central/practitioner-dashboard' },
            { title: 'Calendar', href: '/central/calendar' },
          ]
        : [
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Calendar', href: '/calendar' },
          ];

        const { auth, tenancy }: any = usePage().props;
          console.log('auth',auth);
        
        // Tenant-specific checks (only in tenant context)
        const isTenantPractitioner = !isCentral && (auth?.user?.is_tenant_practitioner || false);
        const isTenantPatient = !isCentral && (auth?.user?.is_tenant_patient || false);

    // Get appropriate timezone based on calendar type
    const displayTimezone = isCentral ? detectUserTimezone() : getTenantTimezone();
    const displayTimezoneAbbr = isCentral ? getUserTimezoneAbbreviation() : getTenantTimezone().split('/').pop();

    // Convert UTC times to local time for central calendar
    const processedAppointments = useMemo(() => {
        if (!isCentral) {
            // Tenant calendar: times are already in tenant timezone
            return appointments;
        }

        // Central calendar: convert UTC times to user's local timezone
        return appointments.map(appointment => {
            // If timezone is UTC and we have utc_start_time, convert to local
            if (appointment.timezone === 'UTC' && appointment.utc_start_time) {
                const localDate = new Date(appointment.utc_start_time);
                return {
                    ...appointment,
                    date: localDate.toISOString().split('T')[0], // YYYY-MM-DD
                    time: localDate.toTimeString().slice(0, 5), // HH:mm
                };
            }
            return appointment;
        });
    }, [appointments, isCentral]);

    const [selectedDate, setSelectedDate] = useState(new Date(currentDate));
    // Applied filters (what's actually filtering the data)
    const [appliedClinic, setAppliedClinic] = useState<string>('all');
    const [appliedStatus, setAppliedStatus] = useState<string>('all');
    // Pending filters (what's selected in the UI but not yet applied)
    const [pendingClinic, setPendingClinic] = useState<string>('all');
    const [pendingStatus, setPendingStatus] = useState<string>('all');
    // Practitioner filters for tenant calendar
    const [selectedPractitioners, setSelectedPractitioners] = useState<number[]>([]);
    const [pendingPractitioners, setPendingPractitioners] = useState<number[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [dayViewOpen, setDayViewOpen] = useState(false);
    const [selectedDayAppointments, setSelectedDayAppointments] = useState<Appointment[]>([]);
    const [currentView, setCurrentView] = useState<'month' | 'week' | 'day' | 'list'>('month');
    const [selectedDetailDate, setSelectedDetailDate] = useState<Date | null>(null);

    // Modal state for appointment details
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [inviteEmails, setInviteEmails] = useState<string[]>([]);
    const [currentEmailInput, setCurrentEmailInput] = useState('');

    // Use dynamic appointments from backend instead of static data

    // Email handling functions
    const addEmail = (email: string) => {
        const trimmedEmail = email.trim();
        if (trimmedEmail && isValidEmail(trimmedEmail) && !inviteEmails.includes(trimmedEmail)) {
            setInviteEmails([...inviteEmails, trimmedEmail]);
        }
        setCurrentEmailInput('');
    };

    const removeEmail = (emailToRemove: string) => {
        setInviteEmails(inviteEmails.filter(email => email !== emailToRemove));
    };

    const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleEmailKeyPress = (e: React.KeyboardEvent) => {
        // Stop event from bubbling to prevent calendar navigation
        e.stopPropagation();
        
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentEmailInput.trim()) {
                addEmail(currentEmailInput);
            }
        }
    };

    const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Stop event from bubbling to prevent any conflicts
        e.stopPropagation();
        setCurrentEmailInput(e.target.value);
    };

    const handleEmailBlur = () => {
        if (currentEmailInput.trim()) {
            addEmail(currentEmailInput);
        }
    };

    // Appointment click handler
    const handleAppointmentClick = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setIsAppointmentModalOpen(true);
        setInviteEmails([]);
        setCurrentEmailInput('');
    };

    // Send invitations
    const handleSendInvitations = () => {
        console.log('Sending invitations to:', inviteEmails, 'for appointment:', selectedAppointment);
        setIsAppointmentModalOpen(false);
        setSelectedAppointment(null);
        setInviteEmails([]);
    };

    // Clinic color mapping for visual identification
    const clinicColors = {
        'SSO Clinic': { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700', dot: 'bg-blue-500' },
        'McDowall Health': { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', dot: 'bg-green-500' },
        'Mahroz Clinic': { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', dot: 'bg-purple-500' },
        'Imran Medical Center': { bg: 'bg-orange-50', border: 'border-l-orange-500', text: 'text-orange-700', dot: 'bg-orange-500' },
        'Muneeb Clinic': { bg: 'bg-pink-50', border: 'border-l-pink-500', text: 'text-pink-700', dot: 'bg-pink-500' },
    };

    // Get unique clinics for filter dropdown
    const clinics = [...new Set(appointments.map(apt => apt.clinic))].sort();
    
    // PERFORMANCE: Memoized filtering to prevent unnecessary re-calculations
    const filteredAppointments = useMemo(() => {
        return processedAppointments.filter(appointment => {
            const clinicMatch = appliedClinic === 'all' || appointment.clinic === appliedClinic;
            const statusMatch = appliedStatus === 'all' || appointment.status === appliedStatus;

            // For tenant calendar, also filter by selected practitioners
            let practitionerMatch = true;
            if (!isCentral && selectedPractitioners.length > 0) {
                practitionerMatch = selectedPractitioners.some(practitionerId => {
                    const practitioner = practitioners.find(p => p.id === practitionerId);
                    return practitioner && appointment.practitioner.includes(practitioner.name);
                });
            }

            return clinicMatch && statusMatch && practitionerMatch;
        });
    }, [processedAppointments, appliedClinic, appliedStatus, selectedPractitioners, isCentral, practitioners]);

    // PERFORMANCE: Pre-group appointments by date for O(1) lookups
    const appointmentsByDate = useMemo(() => {
        const grouped: Record<string, Appointment[]> = {};
        filteredAppointments.forEach(appointment => {
            if (!grouped[appointment.date]) {
                grouped[appointment.date] = [];
            }
            grouped[appointment.date].push(appointment);
        });
        return grouped;
    }, [filteredAppointments]);
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <CheckCircle className="h-4 w-4" />;
            case 'pending':
                return <Hourglass className="h-4 w-4" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4" />;
            case 'cancelled':
                return <XCircle className="h-4 w-4" />;
            case 'declined':
                return <XCircle className="h-4 w-4" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
        }
    };
const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'completed':
                return 'bg-blue-100 text-blue-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            case 'declined':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const days = getDaysInMonth(selectedDate);
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    
    // PERFORMANCE: Memoized date lookup function
    const getAppointmentsForDate = useCallback((date: Date) => {
        // Use UTC date methods to avoid timezone conversion issues
        // This ensures we match the UTC dates coming from the backend
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return appointmentsByDate[dateStr] || [];
    }, [appointmentsByDate]);

    // PERFORMANCE: Memoized week calculation
    const getWeekDays = useCallback((date: Date) => {
        const week = [];
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - day);
        
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            week.push(dayDate);
        }
        return week;
    }, []);

    // PERFORMANCE: Memoized view data
    const viewData = useMemo(() => {
        switch (currentView) {
            case 'month':
                return { days: getDaysInMonth(selectedDate) };
            case 'week':
                return { days: getWeekDays(selectedDate) };
            case 'day':
                return { days: [selectedDate] };
            case 'list':
                return { appointments: filteredAppointments.slice(0, 50) }; // Limit for performance
            default:
                return { days: getDaysInMonth(selectedDate) };
        }
    }, [currentView, selectedDate, filteredAppointments, getWeekDays]);
    
    // Enhanced navigation for different views
    const navigate = useCallback((direction: 'prev' | 'next') => {
        setSelectedDate(prev => {
            const newDate = new Date(prev);
            switch (currentView) {
                case 'month':
                    if (direction === 'prev') {
                        newDate.setMonth(prev.getMonth() - 1);
                    } else {
                        newDate.setMonth(prev.getMonth() + 1);
                    }
                    break;
                case 'week':
                    if (direction === 'prev') {
                        newDate.setDate(prev.getDate() - 7);
                    } else {
                        newDate.setDate(prev.getDate() + 7);
                    }
                    break;
                case 'day':
                    if (direction === 'prev') {
                        newDate.setDate(prev.getDate() - 1);
                    } else {
                        newDate.setDate(prev.getDate() + 1);
                    }
                    break;
                case 'list':
                    // List view doesn't need date navigation
                    return prev;
                default:
                    return prev;
            }
            return newDate;
        });
    }, [currentView]);

    // Keyboard navigation
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                navigate('prev');
                break;
            case 'ArrowRight':
                event.preventDefault();
                navigate('next');
                break;
            case 't':
            case 'T':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    setSelectedDate(new Date());
                }
                break;
            case 'm':
            case 'M':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    setCurrentView('month');
                }
                break;
            case 'w':
            case 'W':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    setCurrentView('week');
                }
                break;
            case 'd':
            case 'D':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    setCurrentView('day');
                }
                break;
            case 'l':
            case 'L':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    setCurrentView('list');
                }
                break;
        }
    }, [navigate]);

    // Send user timezone to server for central calendar (on mount)
    useEffect(() => {
        if (isCentral) {
            setUserTimezoneInSession();
        }
    }, [isCentral]);

    // Add keyboard event listener only when modal is closed
    useEffect(() => {
        if (!isAppointmentModalOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown, isAppointmentModalOpen]);

// PERFORMANCE: Memoized Calendar Day Component
const CalendarDay = memo(({ 
    date, 
    dayAppointments, 
    isCurrentMonthDay, 
    isTodayDay, 
    clinicColors,
    statusColors,
    formatTime,
    setSelectedDayAppointments,
    setDayViewOpen,
    viewType = 'month'
}: {
    date: Date;
    dayAppointments: Appointment[];
    isCurrentMonthDay: boolean;
    isTodayDay: boolean;
    clinicColors: any;
    statusColors: any;
    formatTime: (time: string) => string;
    setSelectedDayAppointments: (appointments: Appointment[]) => void;
    setDayViewOpen: (open: boolean) => void;
    viewType?: 'month' | 'week' | 'day';
}) => {
    const maxVisible = viewType === 'day' ? 10 : viewType === 'week' ? 6 : 4;
    const cellHeight = viewType === 'day' ? 'min-h-[300px]' : viewType === 'week' ? 'min-h-[200px]' : 'min-h-[140px]';

    return (
        <div
            className={`
                ${cellHeight} p-2 border-r border-b border-border relative transition-colors duration-150
                ${isCurrentMonthDay ? 'bg-background hover:bg-muted/30' : 'bg-muted/20'}
                ${isTodayDay ? 'bg-primary/5 border-primary/20' : ''}
                hover:bg-muted/40 cursor-pointer
            `}
            role="gridcell"
            aria-label={`${date.toDateString()}, ${dayAppointments.length} appointments`}
            tabIndex={0}
        >
            
            <div className={`
                text-sm font-medium mb-2 flex items-center justify-center w-6 h-6 rounded-full
                ${isCurrentMonthDay ? 'text-foreground' : 'text-muted-foreground'}
                ${isTodayDay ? 'bg-primary text-primary-foreground font-semibold' : ''}
            `}>
                {date.getDate()}
            </div>
            <div className="space-y-1 relative overflow-hidden">
                {dayAppointments.slice(0, maxVisible).map((appointment, appointmentIndex) => (
                    <Dialog key={appointment.id}>
                        <DialogTrigger asChild>
                            <div
                                className={`
                                    p-1.5 rounded text-xs cursor-pointer transition-all duration-150 mb-0.5 relative
                                    ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.bg || 'bg-card'} 
                                    ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.border || 'border-l-primary/70'} 
                                    border-l-2 hover:bg-muted/50 border border-border/50 hover:z-10 hover:scale-105
                                    ${dayAppointments.length > 1 ? 'shadow-lg' : 'shadow-sm'}
                                    ${appointmentIndex === 0 && dayAppointments.length > 1 ? 'transform -rotate-1' : ''}
                                    ${appointmentIndex === 1 && dayAppointments.length > 2 ? 'transform rotate-1 -mt-1' : ''}
                                    ${appointmentIndex === 2 && dayAppointments.length > 3 ? 'transform -rotate-0.5 -mt-1' : ''}
                                    ${appointmentIndex === 3 && dayAppointments.length > 4 ? 'transform rotate-0.5 -mt-1' : ''}
                                `}
                                style={{
                                    zIndex: dayAppointments.length - appointmentIndex,
                                }}
                                role="button"
                                aria-label={`${appointment.title} at ${formatTime(appointment.time)}`}
                                onClick={() => handleAppointmentClick(appointment)}
                            >

                                <div className="font-medium truncate text-xs leading-tight flex items-center gap-1">
                                        {formatTime(appointment.time)}

                                    <span className="bg-gray-100 text-gray-600 px-1 py-0.5 rounded text-xs font-normal">{displayTimezoneAbbr}</span>
                                </div>
                                <div className="text-muted-foreground truncate text-xs leading-tight">
                                    {appointment.patient}
                                </div>
                                <div className={`font-medium truncate text-xs leading-tight ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.text || 'text-primary'}`}>
                                    {appointment.clinic}
                                </div>
                                  <Badge className={getStatusColor(appointment.status)}>
                                                        {getStatusIcon(appointment.status)}
                                                        <span className="ml-1 capitalize">{appointment.status}</span>
                                                    </Badge>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="w-[90vw] max-w-none max-h-[85vh] overflow-y-auto">
                            <DialogHeader className="pb-6">
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <span>{appointment.title}</span>
                                    <Badge className={statusColors[appointment.status]}>
                                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                    </Badge>
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <UserIcon className="h-4 w-4 text-gray-500" />
                                        <div>
                                            <Label className="text-sm text-gray-500">Patient</Label>
                                            <div className="font-medium">{appointment.patient}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <UserIcon className="h-4 w-4 text-blue-500" />
                                        <div>
                                            <Label className="text-sm text-gray-500">Practitioner</Label>
                                            <div className="font-medium">{appointment.practitioner}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <CalendarIcon className="h-4 w-4 text-purple-500" />
                                        <div>
                                            <Label className="text-sm text-gray-500">Date & Time</Label>
                                            <div className="font-medium flex items-center gap-2">
                                                {formatTime(appointment.time)}
                                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-normal">{displayTimezoneAbbr}</span>
                                            </div>
                                            <div className="text-sm text-gray-500">{appointment.duration} minutes</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.dot || 'bg-primary'}`}></div>
                                        <div>
                                            <Label className="text-sm text-gray-500">Clinic</Label>
                                            <div className="font-medium">{appointment.clinic}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <MapPinIcon className="h-4 w-4 text-green-500" />
                                        <div>
                                            <Label className="text-sm text-gray-500">Location</Label>
                                            <div className="font-medium">{appointment.location}</div>
                                        </div>
                                    </div>
                                </div>

                                {appointment.notes && (
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                        <Label className="text-sm text-gray-500">Notes</Label>
                                        <div className="text-sm mt-1">{appointment.notes}</div>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                ))}
                {dayAppointments.length > maxVisible && (
                    <div 
                        className="text-xs text-primary font-medium cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors border border-primary/20 bg-primary/5 hover:bg-primary/10"
                        onClick={() => {
                            setSelectedDayAppointments(dayAppointments);
                            setDayViewOpen(true);
                        }}
                        role="button"
                        aria-label={`View ${dayAppointments.length - maxVisible} more appointments`}
                    >
                        +{dayAppointments.length - maxVisible} more
                    </div>
                )}
            </div>
        </div>
    );
});
    
    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };
    
    const isCurrentMonth = (date: Date) => {
        return date.getMonth() === currentMonth;
    };

    // PERFORMANCE: Memoized List View Component
    const ListViewComponent = memo(() => (
        <Card className="lg:col-span-3">
            <CardHeader className="border-b bg-background">
                <CardTitle className="text-lg font-semibold">All Appointments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                    {viewData.appointments && viewData.appointments.length > 0 ? (
                        <div className="divide-y">
                            {viewData.appointments.map((appointment) => (
                                <div
                                    key={appointment.id}
                                    className={`
                                        p-6 hover:bg-muted/30 transition-colors cursor-pointer
                                        ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.bg || 'bg-card'} 
                                        border-l-4 ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.border || 'border-l-primary/70'}
                                    `}
                                    role="listitem"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="font-semibold text-base flex items-center gap-2">
                                                    {formatTime(appointment.time)} - {appointment.title}
                                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-normal">{displayTimezoneAbbr}</span>
                                                </div>
                                                <Badge className={statusColors[appointment.status]}>
                                                    {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                                </Badge>
                                                <div className={`w-3 h-3 rounded-full ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.dot || 'bg-primary'}`}></div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <UserIcon className="h-4 w-4" />
                                                    <span>{appointment.patient}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <UserIcon className="h-4 w-4 text-blue-500" />
                                                    <span>{appointment.practitioner}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPinIcon className="h-4 w-4" />
                                                    <span>{appointment.location}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="h-4 w-4" />
                                                    <span>{appointment.duration} min</span>
                                                </div>
                                            </div>
                                            <div className={`font-medium text-sm mt-2 ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.text || 'text-primary'}`}>
                                                {appointment.clinic} • {new Date(appointment.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-12">
                            <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                            <p>No appointments found</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    ));

    // PERFORMANCE: Memoized Calendar Grid Component  
    const CalendarGridComponent = memo(({ viewType }: { viewType: 'month' | 'week' | 'day' }) => {
        const days = viewData.days || [];
        const gridCols = viewType === 'day' ? 'grid-cols-1' : 'grid-cols-7';
        
        return (
            <Card className="lg:col-span-3">
                
                <CardHeader className="border-b bg-background">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-semibold text-foreground">
                            {currentView === 'month' && `${monthNames[currentMonth]} ${currentYear}`}
                            {currentView === 'week' && `Week of ${selectedDate.toLocaleDateString()}`}
                            {currentView === 'day' && selectedDate.toLocaleDateString()}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('prev')}
                                className="hover:bg-muted"
                                aria-label="Previous"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDate(new Date())}
                                className="hover:bg-muted"
                                aria-label="Today"
                            >
                                Today
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('next')}
                                className="hover:bg-muted"
                                aria-label="Next"
                            >
                                <ChevronRightIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Week day headers */}
                    {viewType !== 'day' && (
                        <div className={`grid ${gridCols} border-b bg-background`} role="row">
                            {weekDays.map(day => (
                                <div 
                                    key={day} 
                                    className="p-3 text-sm font-medium text-center border-r border-border"
                                    role="columnheader"
                                >
                                    {day}
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Calendar grid */}
                    <div className={`grid ${gridCols}`} role="grid" aria-label={`${currentView} view calendar`}>
                        {days.map((date, index) => {
                            const dayAppointments = getAppointmentsForDate(date);
                            const isCurrentMonthDay = isCurrentMonth(date);
                            const isTodayDay = isToday(date);
                            
                            return (
                                <CalendarDay
                                    key={index}
                                    date={date}
                                    dayAppointments={dayAppointments}
                                    isCurrentMonthDay={isCurrentMonthDay}
                                    isTodayDay={isTodayDay}
                                    clinicColors={clinicColors}
                                    statusColors={statusColors}
                                    formatTime={formatTime}
                                    setSelectedDayAppointments={setSelectedDayAppointments}
                                    setDayViewOpen={setDayViewOpen}
                                    viewType={viewType}
                                />
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        );
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calendar" />
            <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <PageHeader title="Calendar" breadcrumbs={breadcrumbs} />
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        {/* View Switching Buttons */}
                        <div className="grid grid-cols-4 sm:flex sm:items-center gap-1 p-1 bg-muted rounded-lg" role="tablist" aria-label="Calendar views">
                            <Button
                                variant={currentView === 'month' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setCurrentView('month')}
                                className="h-8 px-2 sm:px-3 text-xs"
                                role="tab"
                                aria-selected={currentView === 'month'}
                                aria-label="Month view"
                            >
                                <span className="hidden sm:inline">Month</span>
                                <span className="sm:hidden">M</span>
                            </Button>
                            <Button
                                variant={currentView === 'week' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setCurrentView('week')}
                                className="h-8 px-2 sm:px-3 text-xs"
                                role="tab"
                                aria-selected={currentView === 'week'}
                                aria-label="Week view"
                            >
                                <span className="hidden sm:inline">Week</span>
                                <span className="sm:hidden">W</span>
                            </Button>
                            <Button
                                variant={currentView === 'day' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setCurrentView('day')}
                                className="h-8 px-2 sm:px-3 text-xs"
                                role="tab"
                                aria-selected={currentView === 'day'}
                                aria-label="Day view"
                            >
                                <span className="hidden sm:inline">Day</span>
                                <span className="sm:hidden">D</span>
                            </Button>
                            <Button
                                variant={currentView === 'list' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setCurrentView('list')}
                                className="h-8 px-2 sm:px-3 text-xs"
                                role="tab"
                                aria-selected={currentView === 'list'}
                                aria-label="List view"
                            >
                                <span className="hidden sm:inline">List</span>
                                <span className="sm:hidden">L</span>
                            </Button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                    setAppliedClinic('all');
                                    setAppliedStatus('all');
                                    setPendingClinic('all');
                                    setPendingStatus('all');
                                }}
                                disabled={appliedClinic === 'all' && appliedStatus === 'all'}
                                className="h-9 flex-1 sm:flex-none"
                            >
                                <RotateCcw className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Reset</span>
                            </Button>
                            <Sheet open={isFilterOpen} onOpenChange={(open) => {
                                if (open) {
                                    // Initialize pending filters with current applied filters when opening
                                    setPendingClinic(appliedClinic);
                                    setPendingStatus(appliedStatus);
                                }
                                setIsFilterOpen(open);
                            }}>
                                <SheetTrigger asChild>
                                    <Button variant="outline" className="flex items-center gap-2 flex-1 sm:flex-none">
                                        <SlidersHorizontalIcon className="h-4 w-4" />
                                        <span className="hidden sm:inline">Filters</span>
                                        {(appliedClinic !== 'all' || appliedStatus !== 'all') && (
                                            <span className="ml-1 h-2 w-2 rounded-full bg-primary"></span>
                                        )}
                                    </Button>
                                </SheetTrigger>
                            <SheetContent side="top" className="h-auto max-h-[80vh] p-8">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <SheetTitle className="text-xl font-semibold">Filter Appointments</SheetTitle>
                                            <SheetDescription className="text-sm text-muted-foreground mt-1">
                                                Customize your calendar view by filtering appointments
                                            </SheetDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-sm text-muted-foreground">
                                                    {filteredAppointments.length} appointments found
                                                </span>
                                                {(appliedClinic !== 'all' || appliedStatus !== 'all') && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => {
                                                            setAppliedClinic('all');
                                                            setAppliedStatus('all');
                                                            setPendingClinic('all');
                                                            setPendingStatus('all');
                                                        }}
                                                        className="h-8 px-3 text-xs"
                                                    >
                                                        Clear All
                                                    </Button>
                                                )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {isCentral &&
                                                <div className="space-y-3">
                                                    <label className="text-sm font-medium block">Clinic</label>
                                                    <Select value={pendingClinic} onValueChange={setPendingClinic}>
                                                        <SelectTrigger className="h-11 px-3">
                                                            <div className="flex items-center gap-2">
                                                                <BuildingIcon className="h-4 w-4 text-muted-foreground" />
                                                                <SelectValue placeholder="Select clinic" />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all" className="py-2 px-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3"></div>
                                                                    <span>All Clinics</span>
                                                                </div>
                                                            </SelectItem>
                                                            {clinics.map((clinic) => (
                                                                <SelectItem key={clinic} value={clinic} className="py-2 px-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-3 h-3 rounded-full ${clinicColors[clinic as keyof typeof clinicColors]?.dot || 'bg-primary'}`}></div>
                                                                        <span>{clinic}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                        }
                                        {true && (
                                            <div className="space-y-3">
                                                <label className="text-sm font-medium block">Status</label>
                                                <Select value={pendingStatus} onValueChange={setPendingStatus}>
                                                    <SelectTrigger className="h-11 px-3">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all" className="py-2 px-3">
                                                            <span>All Statuses</span>
                                                        </SelectItem>
                                                        <SelectItem value="confirmed" className="py-2 px-3">
                                                            <span>Confirmed</span>
                                                        </SelectItem>
                                                        <SelectItem value="pending" className="py-2 px-3">
                                                            <span>Pending</span>
                                                        </SelectItem>
                                                        <SelectItem value="urgent" className="py-2 px-3">
                                                            <span>Urgent</span>
                                                        </SelectItem>
                                                        <SelectItem value="cancelled" className="py-2 px-3">
                                                            <span>Cancelled</span>
                                                        </SelectItem>
                                                        <SelectItem value="completed" className="py-2 px-3">
                                                            <span>Completed</span>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        
                                        {false && (
                                            <div className="space-y-3">
                                                <label className="text-sm font-medium block">Status</label>
                                                <div className="flex items-center gap-2 h-11 px-3 py-2 border rounded-md bg-gray-50">
                                                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                                                        Confirmed Only
                                                    </Badge>
                                                    <span className="text-sm text-muted-foreground">Only confirmed appointments are shown</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <label className="text-sm font-medium block">Actions</label>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => {
                                                        setPendingClinic('all');
                                                        setPendingStatus('all');
                                                    }}
                                                    className="h-11 px-3 text-xs flex-1"
                                                >
                                                    <RotateCcw className="mr-1 h-3 w-3" />
                                                    Reset All
                                                </Button>
                                                <Button 
                                                    variant="default" 
                                                    size="sm"
                                                    onClick={() => {
                                                        setAppliedClinic(pendingClinic);
                                                        setAppliedStatus(pendingStatus);
                                                        setIsFilterOpen(false);
                                                    }}
                                                    className="h-11 px-4 text-xs"
                                                >
                                                    Apply Filters
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" role="main">
                    {/* For tenant calendar: filter on left, calendar on right */}
                    {!isCentral && !isTenantPractitioner && !isTenantPatient ? (
                        <>
                            {/* Practitioner Filter on Left for Tenant */}
                            <Card className="lg:col-span-1">
                                <CardHeader className="border-b bg-background">
                                    <CardTitle className="text-lg font-semibold text-foreground">Filter by Practitioners</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Select practitioners to view their appointments
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Select Practitioners</Label>
                                            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                                                {practitioners.map((practitioner) => (
                                                    <div key={practitioner.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`practitioner-${practitioner.id}`}
                                                            checked={selectedPractitioners.includes(practitioner.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedPractitioners(prev => [...prev, practitioner.id]);
                                                                } else {
                                                                    setSelectedPractitioners(prev => prev.filter(id => id !== practitioner.id));
                                                                }
                                                            }}
                                                        />
                                                        <Label
                                                            htmlFor={`practitioner-${practitioner.id}`}
                                                            className="text-sm font-normal cursor-pointer flex-1"
                                                        >
                                                            {practitioner.name}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {selectedPractitioners.length > 0 && (
                                            <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-lg">
                                                <Label className="text-xs font-medium text-muted-foreground w-full mb-1">Selected:</Label>
                                                {selectedPractitioners.map(practitionerId => {
                                                    const practitioner = practitioners.find(p => p.id === practitionerId);
                                                    return practitioner ? (
                                                        <span
                                                            key={practitioner.id}
                                                            className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
                                                        >
                                                            {practitioner.name}
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedPractitioners(prev => prev.filter(id => id !== practitioner.id));
                                                                }}
                                                                className="hover:bg-primary/20 rounded-full p-0.5"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedPractitioners(practitioners.map(p => p.id));
                                                }}
                                                className="flex-1 text-xs"
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedPractitioners([]);
                                                }}
                                                className="flex-1 text-xs"
                                            >
                                                Clear All
                                            </Button>
                                        </div>

                                        <div className="pt-2 border-t text-center text-sm text-muted-foreground">
                                            {selectedPractitioners.length === 0 
                                                ? `Showing all appointments (${filteredAppointments.length})`
                                                : `Showing ${filteredAppointments.length} appointments for ${selectedPractitioners.length} practitioner${selectedPractitioners.length > 1 ? 's' : ''}`
                                            }
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            
                            {/* Calendar on Right for Tenant */}
                            {currentView === 'list' ? (
                                <ListViewComponent />
                            ) : (
                                <CalendarGridComponent viewType={currentView} />
                            )}
                        </>
                    ) : (
                        <>
                            {/* For central calendar: calendar on left, today's schedule on right */}
                            {currentView === 'list' ? (
                                <ListViewComponent />
                            ) : (
                                <CalendarGridComponent viewType={currentView} />
                            )}
                            
                            {/* Today's Schedule on Right for Central */}
                            <Card className="lg:col-span-1">
                                <CardHeader className="border-b bg-background">
                                    <CardTitle className="text-lg font-semibold text-foreground">Today's Schedule</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {new Date().toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {getAppointmentsForDate(new Date()).length > 0 ? (
                                            getAppointmentsForDate(new Date()).map(appointment => (
                                                <Dialog key={appointment.id}>
                                                    <DialogTrigger asChild>
                                                        <div className={`
                                                            p-3 rounded cursor-pointer transition-colors hover:bg-muted/50
                                                            ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.bg || 'bg-card'} 
                                                            ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.border || 'border-l-primary'} 
                                                            border-l-2
                                                        `}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-sm font-medium flex items-center gap-2">
                                                                    {formatTime(appointment.time)}
                                                                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-normal">{displayTimezoneAbbr}</span>
                                                                </span>
                                                                <Badge className={statusColors[appointment.status]}>
                                                                    {appointment.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-sm font-medium mb-1">
                                                                {appointment.patient}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mb-1">
                                                                {appointment.practitioner}
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-muted-foreground">
                                                                    {appointment.type}
                                                                </span>
                                                                <span className={`font-medium ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.text || 'text-primary'}`}>
                                                                    {appointment.clinic}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                📍 {appointment.location}
                                                            </div>
                                                        </div>
                                                    </DialogTrigger>
                                                    <DialogContent className="w-[90vw] max-w-none max-h-[85vh] overflow-y-auto">
                                                        <DialogHeader className="pb-6">
                                                            <DialogTitle className="flex items-center gap-2 text-xl">
                                                                <span>{appointment.title}</span>
                                                                <Badge className={statusColors[appointment.status]}>
                                                                    {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                                                </Badge>
                                                            </DialogTitle>
                                                        </DialogHeader>
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="flex items-center gap-3">
                                                                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                                                                    <div>
                                                                        <Label className="text-sm text-muted-foreground">Patient</Label>
                                                                        <div className="font-medium">{appointment.patient}</div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-3">
                                                                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                                                                    <div>
                                                                        <Label className="text-sm text-muted-foreground">Practitioner</Label>
                                                                        <div className="font-medium">{appointment.practitioner}</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-4 h-4 rounded-full ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.dot || 'bg-primary'}`}></div>
                                                                <div>
                                                                    <Label className="text-sm text-muted-foreground">Clinic</Label>
                                                                    <div className={`font-medium ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.text || 'text-primary'}`}>
                                                                        {appointment.clinic}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-3">
                                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                                <div>
                                                                    <Label className="text-sm text-muted-foreground">Date & Time</Label>
                                                                    <div className="font-medium">
                                                                        {new Date(appointment.date).toLocaleDateString('en-US', {
                                                                            weekday: 'long',
                                                                            year: 'numeric',
                                                                            month: 'long',
                                                                            day: 'numeric'
                                                                        })}
                                                                    </div>
                                                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                                        {formatTime(appointment.time)} ({appointment.duration} min)
                                                                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-normal">{displayTimezoneAbbr}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="flex items-center gap-3">
                                                                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                                                                    <div>
                                                                        <Label className="text-sm text-muted-foreground">Type</Label>
                                                                        <div className="font-medium">{appointment.type}</div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-3">
                                                                    <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                                                                    <div>
                                                                        <Label className="text-sm text-muted-foreground">Location</Label>
                                                                        <div className="font-medium">{appointment.location}</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {appointment.notes && (
                                                                <div className="mt-4 p-3 bg-muted rounded">
                                                                    <Label className="text-sm text-muted-foreground">Notes</Label>
                                                                    <div className="text-sm mt-1">{appointment.notes}</div>
                                                                </div>
                                                            )}

                                                            {/* Conduct Appointment Button */}
                                                            {appointment.source === 'clinic' && appointment.clickable && appointment.tenant_id && appointment.status === 'confirmed' && auth?.user?.is_practitioner &&  (
                                                                <div className="mt-6 pt-4 border-t">
                                                                    <Button 
                                                                        onClick={() => {
                                                                            // Use the new SSO redirect logic to switch tenant and redirect to current session
                                                                            // Since we're in central context (isCentral=true), use tenant.sso.redirect
                                                                            router.post(route('tenant.sso.redirect'), { 
                                                                                tenant_id: appointment.tenant_id,
                                                                                redirect: `/current-session/${appointment.id}`
                                                                            });
                                                                        }}
                                                                        className="w-full"
                                                                        size="lg"
                                                                    >
                                                                        <Send className="h-4 w-4 mr-2" />
                                                                        Conduct Appointment
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            ))
                                        ) : (
                                            <div className="text-center text-muted-foreground py-8">
                                                <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                                                <p className="text-sm">
                                                    {appliedClinic !== 'all' || appliedStatus !== 'all' 
                                                        ? 'No appointments match your filters today' 
                                                        : 'No appointments today'
                                                    }
                                                </p>
                                                {(appliedClinic !== 'all' || appliedStatus !== 'all') && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => {
                                                            setAppliedClinic('all');
                                                            setAppliedStatus('all');
                                                            setPendingClinic('all');
                                                            setPendingStatus('all');
                                                        }}
                                                        className="mt-2"
                                                    >
                                                        Clear Filters
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>

            {/* Day View Dialog for showing all appointments */}
            <Dialog open={dayViewOpen} onOpenChange={setDayViewOpen}>
                <DialogContent className="w-[90vw] max-w-none max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5" />
                            All Appointments
                            <Badge variant="secondary" className="ml-2">
                                {selectedDayAppointments.length} total
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-6">
                        {selectedDayAppointments.length > 0 ? (
                            <div className="grid gap-3">
                                {selectedDayAppointments
                                    .sort((a, b) => a.time.localeCompare(b.time))
                                    .map((appointment) => (
                                    <div
                                        key={appointment.id}
                                        className={`
                                            p-4 rounded-lg border transition-colors duration-150
                                            ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.bg || 'bg-card'} 
                                            ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.border || 'border-l-primary/70'} 
                                            border-l-4 hover:bg-muted/30 shadow-sm
                                        `}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="font-semibold text-sm flex items-center gap-2">
                                                        {formatTime(appointment.time)}
                                                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-normal">{displayTimezoneAbbr}</span>
                                                    </div>
                                                    <Badge className={statusColors[appointment.status]}>
                                                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                                    </Badge>
                                                    <div className={`w-3 h-3 rounded-full ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.dot || 'bg-primary'}`}></div>
                                                </div>
                                                <div className="font-medium text-base mb-1">
                                                    {appointment.title}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <UserIcon className="h-4 w-4" />
                                                        <span>{appointment.patient}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <UserIcon className="h-4 w-4 text-blue-500" />
                                                        <span>{appointment.practitioner}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPinIcon className="h-4 w-4" />
                                                        <span>{appointment.location}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <ClockIcon className="h-4 w-4" />
                                                        <span>{appointment.duration} min</span>
                                                    </div>
                                                </div>
                                                <div className={`font-medium text-sm mt-2 ${clinicColors[appointment.clinic as keyof typeof clinicColors]?.text || 'text-primary'}`}>
                                                    {appointment.clinic}
                                                </div>
                                                {appointment.notes && (
                                                    <div className="mt-3 p-3 bg-muted/50 rounded text-sm">
                                                        <strong>Notes:</strong> {appointment.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                                <p>No appointments found for this day</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Appointment Details Modal */}
            <Dialog open={isAppointmentModalOpen} onOpenChange={setIsAppointmentModalOpen}>
                <DialogContent className="w-[70vw] max-w-none">
                    <DialogHeader>
                        <DialogTitle>Appointment Details</DialogTitle>
                    </DialogHeader>
                    {selectedAppointment && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-lg">{selectedAppointment.title}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <CalendarIcon className="h-4 w-4" />
                                    {selectedAppointment.date} at {formatTime(selectedAppointment.time)}
                                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-normal">{displayTimezoneAbbr}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <UserIcon className="h-4 w-4" />
                                    <span>Patient: {selectedAppointment.patient}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <UserIcon className="h-4 w-4" />
                                    <span>Doctor: {selectedAppointment.practitioner}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPinIcon className="h-4 w-4" />
                                    <span>{selectedAppointment.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <BuildingIcon className="h-4 w-4" />
                                    <span>{selectedAppointment.clinic}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <ClockIcon className="h-4 w-4" />
                                    <span>{selectedAppointment.duration} minutes</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge className={statusColors[selectedAppointment.status]}>
                                    {selectedAppointment.status}
                                </Badge>
                                <Badge variant="outline">{selectedAppointment.type}</Badge>
                            </div>

                            {selectedAppointment.notes && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Notes</Label>
                                    <div className="text-sm bg-muted p-3 rounded-md">
                                        {selectedAppointment.notes}
                                    </div>
                                </div>
                            )}

                            {/* Invite Others Section */}
                            <div className="space-y-3 pt-4 border-t">
                                <Label className="text-sm font-medium">Invite Others</Label>
                                
                                <div className="space-y-3">
                                    {/* Email chips */}
                                    {inviteEmails.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {inviteEmails.map((email, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm border"
                                                >
                                                    <span>{email}</span>
                                                    <button
                                                        onClick={() => removeEmail(email)}
                                                        className="hover:bg-primary/20 rounded-full p-0.5 ml-1"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Email input */}
                                    <div className="space-y-2">
                                        <input
                                            type="email"
                                            placeholder="Enter email addresses separated by commas"
                                            value={currentEmailInput}
                                            onChange={handleEmailInputChange}
                                            onKeyDown={handleEmailKeyPress}
                                            onBlur={handleEmailBlur}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Type email addresses and press Enter or comma to add them
                                        </p>
                                    </div>

                                    {inviteEmails.length > 0 && (
                                        <Button 
                                            onClick={handleSendInvitations}
                                            className="w-full flex items-center gap-2"
                                        >
                                            <Send className="h-4 w-4" />
                                            Send Invitations ({inviteEmails.length})
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAppointmentModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
} 
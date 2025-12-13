import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import PageHeader from '@/components/general/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    FilterIcon,
    Clock,
    MapPin,
    User,
    CheckCircle,
    AlertCircle,
    XCircle,
    Video,
    Plus,
    RotateCcw
} from 'lucide-react';
import { formatTime } from '@/hooks/use-time-locale'; 
import { cn } from '@/lib/utils';
import { route } from 'ziggy-js';

// --- TYPES ---
type Appointment = {
    id: number | string;
    practitioner_id: number;
    title: string;
    patient: string;
    type: string;
    status: 'confirmed' | 'pending' | 'urgent' | 'cancelled' | 'completed';
    mode: string;
    location: string;
    location_id?: number; // Optional location ID for filtering
    date: string;
    time: string;
    start_time: string;
    end_time: string;
    duration: number; // in minutes
    notes?: string;
    payment_status?: 'paid' | 'billed' | 'cancelled' | 'none';
    invoice_status?: string | null;
};

type Practitioner = {
    id: number;
    name: string;
    first_name: string;
    last_name: string;
};

type Location = {
    id: number;
    name: string;
};

type TimeRange = {
    start: string;  // "HH:MM"
    end: string;    // "HH:MM"
};

type PractitionerAvailabilityMap = {
    [practitionerId: number]: {
        [locationId: number]: {
            [day: string]: TimeRange[];
        };
    };
};

type CalendarV2Props = {
    appointments: Record<number, Appointment[]>;
    practitioners: Practitioner[];
    currentDate: string;
    appointmentSessionDuration?: number;
    locations: Location[];
    practitionerAvailability: PractitionerAvailabilityMap;
};

// --- CONSTANTS ---
const SLOT_HEIGHT = 100; // Increased height for better visibility and professional look

// Generate time slots dynamically based on slot duration and availability range
const generateTimeSlots = (slotDurationMinutes: number = 30, minHour: number = 8, maxHour: number = 17) => {
    const slots = [];
    for (let hour = minHour; hour <= maxHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotDurationMinutes) {
            if (hour === maxHour && minute > 0) break;
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            slots.push(time);
        }
    }
    return slots;
};

// Generate time labels at regular 15-minute intervals for better readability
const generateTimeLabels = (minHour: number = 8, maxHour: number = 17) => {
    const labels = [];
    for (let hour = minHour; hour <= maxHour; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            if (hour === maxHour && minute > 0) break;
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            labels.push(time);
        }
    }
    return labels;
};

// --- HELPERS ---

const getAppointmentColors = (mode: string, type: string) => {
    // Kept for backward compatibility if needed, but we are moving to status-based styling primarily
    const t = type.toLowerCase();
    const m = mode.toLowerCase();
    
    if (m === 'virtual' || t.includes('virtual')) {
        return { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', badge: 'bg-purple-800 text-white' };
    }
    if (t.includes('therapy') || t.includes('tor')) {
        return { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', badge: 'bg-emerald-800 text-white' };
    }
    if (t.includes('assessment')) {
        return { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', badge: 'bg-blue-800 text-white' };
    }
    return { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', badge: 'bg-indigo-800 text-white' };
};

const getAppointmentColorsByPaymentStatus = (paymentStatus?: 'paid' | 'billed' | 'cancelled' | 'none', mode?: string, type?: string) => {
     // Kept for backward compatibility
    if (paymentStatus === 'paid') {
        return { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', badge: 'bg-emerald-800 text-white', label: 'Paid' };
    }
    if (paymentStatus === 'billed') {
        return { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', badge: 'bg-purple-800 text-white', label: 'Billed' };
    }
    if (paymentStatus === 'cancelled') {
        return { bg: 'bg-red-600', hover: 'hover:bg-red-700', badge: 'bg-red-800 text-white', label: 'Cancelled' };
    }
    // Fallback to mode/type based colors
    if (mode && type) {
        const colors = getAppointmentColors(mode, type);
        return { ...colors, label: null };
    }
    return { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', badge: 'bg-indigo-800 text-white', label: null };
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'confirmed': return <CheckCircle className="h-3 w-3 text-white" />;
        case 'pending': return <Clock className="h-3 w-3 text-white" />;
        case 'urgent': return <AlertCircle className="h-3 w-3 text-white" />;
        case 'cancelled': return <XCircle className="h-3 w-3 text-white" />;
        case 'completed': return <CheckCircle className="h-3 w-3 text-white" />;
        default: return <Clock className="h-3 w-3 text-white" />;
    }
};

// Helper to determine if a border should be shown for a slot
// For small slot durations, only show borders at certain intervals to reduce visual clutter
const shouldShowBorder = (time: string, slotDurationMinutes: number): boolean => {
    // For slot durations >= 15 minutes, show border on all slots
    if (slotDurationMinutes >= 15) {
        return true;
    }
    
    // For 1-minute slots, only show borders every 15 minutes to reduce clutter
    if (slotDurationMinutes === 1) {
        const [hour, minute] = time.split(':').map(Number);
        return minute % 15 === 0;
    }
    
    // For other small durations (2-14 minutes), show borders at 5-minute intervals
    const [hour, minute] = time.split(':').map(Number);
    return minute % 5 === 0;
};

// Precise pixel calculation based on 8:00 AM start
const calculatePosition = (startTime: string, duration: number, slotDurationMinutes: number = 30) => {
    const pixelsPerMinute = SLOT_HEIGHT / slotDurationMinutes;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const baseMinutes = 8 * 60; // 8:00 AM
    
    const relativeMinutes = startMinutes - baseMinutes;
    
    const top = relativeMinutes * pixelsPerMinute;
    const height = duration * pixelsPerMinute;
    
    return { top, height };
};

// Check if a time slot is within practitioner's availability
// Note: Availability times are expected to be in tenant timezone format (HH:MM)
// The date parameter should be in the tenant timezone context
const isSlotAvailable = (
    practitionerId: number,
    locationId: number | null,
    date: Date,
    slotTime: string,
    availability: PractitionerAvailabilityMap
): boolean => {
    // Get day of week in lowercase (e.g., "monday", "tuesday")
    // This matches the format used in practitionerAvailability (day names as keys)
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const practitionerAvail = availability[practitionerId];

    // If no availability data for practitioner, mark as unavailable
    if (!practitionerAvail) return false;

    // Convert slot time to minutes since midnight for comparison
    // Both slotTime and availability times are in HH:MM format (tenant timezone)
    const [slotHour, slotMinute] = slotTime.split(':').map(Number);
    const slotMinutes = slotHour * 60 + slotMinute;

    // Helper to check if time falls within a range
    // Times are compared as minutes since midnight, which works correctly
    // as long as both are in the same timezone (tenant timezone)
    const isTimeInRange = (range: TimeRange) => {
        const [startHour, startMinute] = range.start.split(':').map(Number);
        const [endHour, endMinute] = range.end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    };

    // If specific location selected, check only that location
    if (locationId) {
        const locationAvail = practitionerAvail[locationId];
        if (!locationAvail?.[dayOfWeek]) return false;
        return locationAvail[dayOfWeek].some(isTimeInRange);
    }

    // No location selected: check if available at ANY location
    for (const locId in practitionerAvail) {
        const locationAvail = practitionerAvail[locId];
        if (locationAvail?.[dayOfWeek]?.some(isTimeInRange)) {
            return true;
        }
    }

    return false;
};

function CalendarIndexV2({
    appointments,
    practitioners,
    currentDate,
    appointmentSessionDuration = 30,
    locations,
    practitionerAvailability
}: CalendarV2Props) {
    // --- STATE ---
    const [selectedDate, setSelectedDate] = useState(new Date(currentDate));
    const [viewType, setViewType] = useState<'day' | 'week'>('day');
    const [selectedPractitioners, setSelectedPractitioners] = useState<number[]>(practitioners.map(p => p.id));
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Calculate min/max hours from practitioner availability
    const availabilityRange = useMemo(() => {
        let minHour = 8; // Default start: 8 AM
        let maxHour = 17; // Default end: 5 PM

        if (practitionerAvailability && Object.keys(practitionerAvailability).length > 0) {
            const allHours: number[] = [];
            
            // Iterate through all practitioners and their availability
            Object.values(practitionerAvailability).forEach((practitionerAvail) => {
                Object.values(practitionerAvail).forEach((locationAvail) => {
                    Object.values(locationAvail).forEach((dayAvail: TimeRange[]) => {
                        dayAvail.forEach((range: TimeRange) => {
                            const [startHour] = range.start.split(':').map(Number);
                            const [endHour, endMinute] = range.end.split(':').map(Number);
                            
                            allHours.push(startHour);
                            // If end time is exactly on the hour (e.g., 11:00), include that hour
                            // If end time has minutes (e.g., 11:30), include the next hour for display
                            allHours.push(endMinute > 0 ? endHour + 1 : endHour);
                        });
                    });
                });
            });

            if (allHours.length > 0) {
                minHour = Math.min(...allHours);
                maxHour = Math.max(...allHours);
                // Ensure we show at least until the end hour
                if (maxHour < 17) {
                    maxHour = Math.max(maxHour, 11); // At least show until 11 AM if availability exists
                }
            }
        }

        return { minHour, maxHour };
    }, [practitionerAvailability]);

    // Generate time slots dynamically based on appointment session duration and availability range
    const timeSlots = useMemo(() => 
        generateTimeSlots(appointmentSessionDuration, availabilityRange.minHour, availabilityRange.maxHour), 
        [appointmentSessionDuration, availabilityRange]
    );

    // Generate time labels at regular 15-minute intervals for better readability
    const timeLabels = useMemo(() => 
        generateTimeLabels(availabilityRange.minHour, availabilityRange.maxHour), 
        [availabilityRange]
    );

    // --- FILTERS ---
    const visiblePractitioners = useMemo(() => 
        practitioners.filter(p => selectedPractitioners.includes(p.id)), 
    [practitioners, selectedPractitioners]);

    const filteredAppointments = useMemo(() => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const filtered: Record<number, Appointment[]> = {};
        
        Object.entries(appointments).forEach(([pId, appts]) => {
            filtered[Number(pId)] = appts.filter(apt => {
                // Filter by date
                if (apt.date !== dateStr) return false;
                
                // Filter by location if location filter is set
                if (selectedLocationId !== null && apt.location_id && apt.location_id !== selectedLocationId) {
                    return false;
                }
                
                return true;
            });
        });
        return filtered;
    }, [appointments, selectedDate, selectedLocationId]);

    // --- ACTIONS ---
    const navigateDate = (dir: 'prev' | 'next') => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
        setSelectedDate(d);
    };

    const handleBookAppointment = (pId: number, slot: string) => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        router.visit(route('appointments.quick-book', { practitioner_id: pId, date: dateStr, time_slot: slot }));
    };

    // --- RENDER ---
    return (
        <>
            <Head title="Calendar" />
            
            <div className="m-3 sm:m-6 space-y-6">
                <PageHeader title="Calendar" description="Manage appointments" />

                {/* CONTROLS (Date, Filter, Etc) */}
                <Card>
                    <CardContent className="p-4 flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}><ChevronLeftIcon className="h-4 w-4" /></Button>
                            <span className="font-semibold w-48 text-center">
                                {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </span>
                            <Button variant="outline" size="icon" onClick={() => navigateDate('next')}><ChevronRightIcon className="h-4 w-4" /></Button>
                            <Button variant="outline" onClick={() => setSelectedDate(new Date())}>Today</Button>
                        </div>

                        {/* Right Side Controls: View Type, Refresh, Filter */}
                        <div className="flex gap-2 items-center">
                             <Select value={viewType} onValueChange={(v) => setViewType(v as 'day' | 'week')}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Day</SelectItem>
                                    <SelectItem value="week">Week</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline" size="icon" onClick={() => router.reload()}>
                                <RotateCcw className="h-4 w-4" />
                            </Button>

                             <Select
                                value={selectedPractitioners.length === practitioners.length ? 'all' : selectedPractitioners.length === 1 ? selectedPractitioners[0].toString() : 'custom'}
                                onValueChange={(v) => {
                                    if (v === 'all') {
                                        setSelectedPractitioners(practitioners.map(p => p.id));
                                    } else {
                                        const practitionerId = Number(v);
                                        if (!isNaN(practitionerId)) {
                                            setSelectedPractitioners([practitionerId]);
                                        }
                                    }
                                }}
                            >
                                <SelectTrigger className="w-[200px]"><FilterIcon className="mr-2 h-4 w-4" /><SelectValue placeholder="Practitioners" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Practitioners</SelectItem>
                                    {practitioners.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>
                                            {p.first_name} {p.last_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Location Filter */}
                            <Select
                                value={selectedLocationId?.toString() ?? 'all'}
                                onValueChange={(v) => setSelectedLocationId(v === 'all' ? null : Number(v))}
                            >
                                <SelectTrigger className="w-[200px]">
                                    <MapPin className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Locations</SelectItem>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id.toString()}>
                                            {loc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* --- MAIN GRID --- */}
                <Card className="overflow-hidden border-2">
                    <CardContent className="p-0">
                        {/* Outer container - no overflow, inner handles scrolling */}
                        <div>
                            <div className="min-w-[800px] flex flex-col">
                                
                                {/* 1. HEADER ROW */}
                                <div className="flex border-b bg-gray-50 dark:bg-gray-800">
                                    <div className="flex-none w-20 border-r border-gray-200 dark:border-gray-700 bg-white/50" />
                                    {visiblePractitioners.map(p => (
                                        <div key={p.id} className="flex-1 p-5 text-center border-r border-gray-300 dark:border-gray-600 min-w-[260px]">
                                            <div className="font-bold text-base text-gray-900 dark:text-gray-100">
                                                {p.first_name} {p.last_name}
                                            </div>
                                            <Badge variant="secondary" className="mt-2 text-xs font-medium">
                                                {filteredAppointments[p.id]?.length || 0} appointments
                                            </Badge>
                                        </div>
                                    ))}
                                </div>

                                {/* 2. BODY ROW (Handles Both Vertical and Horizontal Scroll) */}
                                <div 
                                    ref={scrollContainerRef}
                                    className="flex overflow-y-auto overflow-x-auto h-[calc(100vh-350px)]"
                                >
                                    {/* A. TIME LABELS */}
                                    <div className="flex-none w-20 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 sticky left-0 z-30">
                                        {timeLabels.map(time => {
                                            const showBorder = shouldShowBorder(time, appointmentSessionDuration);
                                            // Calculate height: SLOT_HEIGHT represents appointmentSessionDuration minutes
                                            // Each label represents 15 minutes, so height = SLOT_HEIGHT * (15 / appointmentSessionDuration)
                                            const labelHeight = (SLOT_HEIGHT * 15) / appointmentSessionDuration;
                                            return (
                                                <div 
                                                    key={time} 
                                                    className={cn(
                                                        "flex items-start justify-end pr-2 pt-1 text-xs text-gray-500 font-medium box-border",
                                                        showBorder && "border-b border-gray-200 dark:border-gray-700"
                                                    )}
                                                    style={{ height: `${labelHeight}px` }}
                                                >
                                                    {time}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* B. PRACTITIONER COLUMNS */}
                                    {visiblePractitioners.map((practitioner, index) => (
                                        <div 
                                            key={practitioner.id} 
                                            className="flex-1 relative min-w-[260px] border-r border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950"
                                        >
                                            {/* B1. Background Grid */}
                                            <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">
                                                {timeSlots.map(time => {
                                                    const isAvailable = isSlotAvailable(
                                                        practitioner.id,
                                                        selectedLocationId,
                                                        selectedDate,
                                                        time,
                                                        practitionerAvailability
                                                    );

                                                    const showBorder = shouldShowBorder(time, appointmentSessionDuration);
                                                    
                                                    // Current time indicator logic (simplified for demo)
                                                    // In a real app, you'd calculate this based on actual current time relative to the grid
                                                    const now = new Date();
                                                    const isToday = selectedDate.toDateString() === now.toDateString();
                                                    const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
                                                    const [slotHour, slotMinute] = time.split(':').map(Number);
                                                    const isCurrentSlot = isToday && slotHour === currentHour && currentMinute >= slotMinute && currentMinute < slotMinute + appointmentSessionDuration;
                                                    
                                                    // Calculate top position for red line within the slot
                                                    const minutesIntoSlot = currentMinute - slotMinute;
                                                    const percentIntoSlot = (minutesIntoSlot / appointmentSessionDuration) * 100;

                                                    return (
                                                        <div
                                                            key={time}
                                                            className={cn(
                                                                 "w-full transition-all duration-150 box-border relative pointer-events-auto",
                                                                 showBorder && "border-b border-gray-100 dark:border-gray-800", // More subtle grid lines
                                                                isAvailable
                                                                    ? "hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer group"
                                                                    : "bg-gray-50/30 dark:bg-gray-800/20 cursor-not-allowed" // Lighter unavailable background
                                                            )}
                                                            style={{ 
                                                                height: `${SLOT_HEIGHT}px`,
                                                                isolation: 'isolate' 
                                                            }}
                                                            onClick={() => isAvailable && handleBookAppointment(practitioner.id, time)}
                                                        >
                                                            {/* Current Time Indicator Line */}
                                                            {isCurrentSlot && (
                                                                <div 
                                                                    className="absolute w-full border-t-2 border-red-500 z-40 pointer-events-none flex items-center"
                                                                    style={{ top: `${percentIntoSlot}%` }}
                                                                >
                                                                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                                                                </div>
                                                            )}

                                                            {isAvailable && (
                                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none z-30 transition-opacity">
                                                                    <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400 drop-shadow-md" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* B2. Appointments Layer */}
                                            <div className="absolute inset-0 z-10 pointer-events-none w-full">
                                                {filteredAppointments[practitioner.id]?.map(apt => {
                                                    const { top, height } = calculatePosition(apt.start_time, apt.duration, appointmentSessionDuration);
                                                    const colors = apt.payment_status && apt.payment_status !== 'none' 
                                                        ? getAppointmentColorsByPaymentStatus(apt.payment_status, apt.mode, apt.type)
                                                        : getAppointmentColors(apt.mode, apt.type);
                                                    const isCancelled = apt.payment_status === 'cancelled' || apt.status === 'cancelled';
                                                    
                                                    // Status-based styling
                                                    const getStatusColor = (status: string) => {
                                                        switch (status) {
                                                            case 'confirmed':
                                                                return {
                                                                    border: 'border-l-emerald-500',
                                                                    bg: 'bg-white dark:bg-gray-800',
                                                                    statusBg: 'bg-emerald-100 dark:bg-emerald-900/50',
                                                                    statusText: 'text-emerald-700 dark:text-emerald-300',
                                                                    icon: <CheckCircle className="h-3.5 w-3.5" />
                                                                };
                                                            case 'completed':
                                                                return {
                                                                    border: 'border-l-blue-500',
                                                                    bg: 'bg-white dark:bg-gray-800',
                                                                    statusBg: 'bg-blue-100 dark:bg-blue-900/50',
                                                                    statusText: 'text-blue-700 dark:text-blue-300',
                                                                    icon: <CheckCircle className="h-3.5 w-3.5" />
                                                                };
                                                            case 'pending':
                                                                return {
                                                                    border: 'border-l-amber-500',
                                                                    bg: 'bg-white dark:bg-gray-800',
                                                                    statusBg: 'bg-amber-100 dark:bg-amber-900/50',
                                                                    statusText: 'text-amber-700 dark:text-amber-300',
                                                                    icon: <Clock className="h-3.5 w-3.5" />
                                                                };
                                                            case 'urgent':
                                                                return {
                                                                    border: 'border-l-red-500',
                                                                    bg: 'bg-white dark:bg-gray-800',
                                                                    statusBg: 'bg-red-100 dark:bg-red-900/50',
                                                                    statusText: 'text-red-700 dark:text-red-300',
                                                                    icon: <AlertCircle className="h-3.5 w-3.5" />
                                                                };
                                                            case 'cancelled':
                                                                return {
                                                                    border: 'border-l-gray-400',
                                                                    bg: 'bg-gray-50 dark:bg-gray-900',
                                                                    statusBg: 'bg-gray-100 dark:bg-gray-800',
                                                                    statusText: 'text-gray-600 dark:text-gray-400',
                                                                    icon: <XCircle className="h-3.5 w-3.5" />
                                                                };
                                                            default:
                                                                return {
                                                                    border: 'border-l-gray-400',
                                                                    bg: 'bg-white dark:bg-gray-900',
                                                                    statusBg: 'bg-gray-100 dark:bg-gray-800',
                                                                    statusText: 'text-gray-700 dark:text-gray-300',
                                                                    icon: <Clock className="h-3.5 w-3.5" />
                                                                };
                                                        }
                                                    };

                                                    const statusStyle = getStatusColor(apt.status);
                                                    
                                                    return (
                                                        <div
                                                            key={apt.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedAppointment(apt);
                                                                setIsAppointmentModalOpen(true);
                                                            }}
                                                            className={cn(
                                                                "absolute left-2 right-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer pointer-events-auto overflow-hidden transition-all hover:z-50 hover:shadow-xl hover:scale-[1.02]",
                                                                "border-l-4",
                                                                statusStyle.border,
                                                                statusStyle.bg,
                                                                isCancelled && "opacity-60"
                                                            )}
                                                            style={{
                                                                top: `${top + 3}px`,
                                                                height: `${height - 6}px`,
                                                            }}
                                                        >
                                                            {/* --- PROFESSIONAL CARD CONTENT --- */}
                                                            <div className={cn("p-3 h-full flex flex-col justify-between", isCancelled && "line-through")}>
                                                                {/* TOP SECTION */}
                                                                <div className="space-y-1">
                                                                    {/* Time Display - Prominent */}
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                                                            {formatTime(apt.start_time)}
                                                                        </div>
                                                                        {/* Location Badge */}
                                                                        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                                            <MapPin className="w-3 h-3" />
                                                                            {apt.location}
                                                                        </div>
                                                                    </div>

                                                                    {/* Patient Name - Bold and Clear */}
                                                                    <div className="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight truncate">
                                                                        {apt.patient}
                                                                    </div>

                                                                    {/* Service Type - Subtle */}
                                                                    {apt.title && (
                                                                        <div className="text-xs text-red-600 dark:text-red-400 font-medium truncate">
                                                                            {apt.title}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* BOTTOM SECTION - Status Badge */}
                                                                <div className="flex items-center justify-between mt-2">
                                                                    <div className={cn(
                                                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                                                        statusStyle.statusBg,
                                                                        statusStyle.statusText
                                                                    )}>
                                                                        {statusStyle.icon}
                                                                        <span>{apt.status}</span>
                                                                    </div>
                                                                    
                                                                    {/* Payment Status (if applicable) */}
                                                                    {apt.payment_status && apt.payment_status !== 'none' && (
                                                                        <div className="text-[10px] font-medium text-gray-500 capitalize">
                                                                            {apt.payment_status}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MODAL */}
            <Dialog open={isAppointmentModalOpen} onOpenChange={setIsAppointmentModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Appointment Details</DialogTitle>
                    </DialogHeader>
                    {selectedAppointment && (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-gray-500">Patient:</span> <div className="font-medium">{selectedAppointment.patient}</div></div>
                                <div><span className="text-gray-500">Service:</span> <div className="font-medium">{selectedAppointment.title}</div></div>
                                <div><span className="text-gray-500">Time:</span> <div className="font-medium">{selectedAppointment.start_time} - {selectedAppointment.end_time}</div></div>
                                <div><span className="text-gray-500">Duration:</span> <div className="font-medium">{selectedAppointment.duration} min</div></div>
                                <div className="col-span-2"><span className="text-gray-500">Location:</span> <div className="font-medium">{selectedAppointment.location}</div></div>
                                <div className="col-span-2 flex items-center gap-2">
                                    <span className="text-gray-500">Status:</span> 
                                    <Badge variant="outline" className="capitalize">{selectedAppointment.status}</Badge>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsAppointmentModalOpen(false)}>Close</Button>
                                <Button onClick={() => router.visit(`/appointments/${selectedAppointment.id}`)}>View Full</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

export default withAppLayout(CalendarIndexV2, {
    breadcrumbs: [{ title: 'Calendar', href: '/calendar' }]
});
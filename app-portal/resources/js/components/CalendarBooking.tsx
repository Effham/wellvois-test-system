import React, { useState, useEffect, forwardRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, Sunrise, Sun, Moon, AlertTriangle, Zap, Video, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
// Removed unused router import

interface CalendarBookingProps {
    selectedDateTime?: string;
    onDateTimeSelect: (dateTime: string) => void;
    practitionerId?: string; // Keep for backward compatibility
    practitionerIds?: number[]; // Add support for multiple practitioners
    practitionersCalendarStatus?: Record<number, boolean>; // Calendar integration status for each practitioner
    serviceId?: string;
    practitionerAvailability: Record<string, { start_time: string; end_time: string }[]>;
    loadingAvailability: boolean;
    appointmentSessionDuration: number;
    appointmentSettings?: {
        advanceBookingHours?: string;
        maxAdvanceBookingDays?: string;
        allowSameDayBooking?: boolean;
    };
    existingAppointments?: Array<{
        datetime: string;
        date: string;
        time: string;
        appointment_id?: string;
        status?: string;
        mode?: string;
        location_id?: number;
        duration?: number; // Duration in minutes stored with the appointment
    }>;
    showConflicts?: boolean; // Add prop to control whether conflicts should be checked
    publicPortal?: boolean; // If true, use public, unauthenticated endpoints
    onJoinWaitingList?: () => void; // Optional callback for joining waiting list
}

interface TimeSlot {
    time: string;
    available: boolean;
    period: 'morning' | 'afternoon' | 'evening';
}

interface CalendarConflictResult {
    has_conflict: boolean;
    is_connected: boolean;
    message: string;
    conflict_details?: {
        event_title: string;
        event_time: string;
    };
}

interface DayConflictResult {
    has_conflicts: boolean;
    is_connected: boolean;
    message: string;
    conflicts: Array<{
        id: string;
        title: string;
        start: string;
        end: string;
        start_time: string;
        end_time: string;
        duration: string;
        description: string;
        location: string;
        is_all_day: boolean;
    }>;
    conflict_count: number;
}

// Helper functions for event card styling
const getEventType = (title: string, description: string, isAllDay: boolean): string => {
    if (isAllDay) return 'all-day';

    const text = `${title} ${description}`.toLowerCase();
    if (text.includes('virtual') || text.includes('online') || text.includes('zoom') || text.includes('teams')) {
        return 'virtual';
    }
    if (text.includes('therapy') || text.includes('tor')) {
        return 'therapy';
    }
    if (text.includes('braap') || text.includes('assessment')) {
        return 'assessment';
    }
    return 'default';
};

const getEventColors = (eventType: string) => {
    const colorMap = {
        'virtual': {
            bg: 'bg-purple-50 dark:bg-purple-900/10',
            border: 'border-l-4 border-purple-400 dark:border-purple-500',
            text: 'text-purple-900 dark:text-purple-100',
            badge: 'bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700',
            icon: 'text-purple-600 dark:text-purple-400'
        },
        'therapy': {
            bg: 'bg-emerald-50 dark:bg-emerald-900/10',
            border: 'border-l-4 border-emerald-400 dark:border-emerald-500',
            text: 'text-emerald-900 dark:text-emerald-100',
            badge: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700',
            icon: 'text-emerald-600 dark:text-emerald-400'
        },
        'assessment': {
            bg: 'bg-blue-50 dark:bg-blue-900/10',
            border: 'border-l-4 border-blue-400 dark:border-blue-500',
            text: 'text-blue-900 dark:text-blue-100',
            badge: 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700',
            icon: 'text-blue-600 dark:text-blue-400'
        },
        'all-day': {
            bg: 'bg-amber-50 dark:bg-amber-900/10',
            border: 'border-l-4 border-amber-400 dark:border-amber-500',
            text: 'text-amber-900 dark:text-amber-100',
            badge: 'bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700',
            icon: 'text-amber-600 dark:text-amber-400'
        },
        'default': {
            bg: 'bg-indigo-50 dark:bg-indigo-900/10',
            border: 'border-l-4 border-indigo-400 dark:border-indigo-500',
            text: 'text-indigo-900 dark:text-indigo-100',
            badge: 'bg-indigo-100 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700',
            icon: 'text-indigo-600 dark:text-indigo-400'
        }
    };

    return colorMap[eventType] || colorMap.default;
};

const getBadgeLabel = (eventType: string): string => {
    const labelMap = {
        'virtual': 'VRT',
        'therapy': 'TOR',
        'assessment': 'BRAAP',
        'all-day': 'ALL DAY',
        'default': 'APT'
    };

    return labelMap[eventType] || 'APT';
};

const CalendarBooking = forwardRef<HTMLDivElement, CalendarBookingProps>(({ 
    selectedDateTime,
    onDateTimeSelect,
    practitionerId,
    practitionerIds, // Add support for multiple practitioners
    practitionersCalendarStatus = {}, // Calendar integration status for each practitioner
    serviceId,
    practitionerAvailability,
    loadingAvailability,
    appointmentSessionDuration,
    appointmentSettings,
    existingAppointments = [],
    showConflicts = true, // Default to true for backward compatibility
    publicPortal = false,
    onJoinWaitingList,
}, ref) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
    const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
    const [warningType, setWarningType] = useState<'warning' | 'error' | 'success' | null>(null);
    const [checkingConflict, setCheckingConflict] = useState<boolean>(false);
    const [dayConflicts, setDayConflicts] = useState<DayConflictResult['conflicts']>([]);
    const [checkingDayConflicts, setCheckingDayConflicts] = useState<boolean>(false);
    const [calendarConnectionStatus, setCalendarConnectionStatus] = useState<boolean | null>(null); // null = unknown, true = connected, false = not connected

    // Debug when existingAppointments prop changes
    useEffect(() => {
        console.log(`🔄 CALENDAR COMPONENT: existingAppointments prop changed:`, existingAppointments.length, existingAppointments);
        console.log(`⏰ Calendar Component Timestamp: ${new Date().toISOString()}`);
    }, [existingAppointments]);

    // Reset calendar connection status when showConflicts changes
    // This allows re-checking if user connects calendar and toggles the setting
    useEffect(() => {
        setCalendarConnectionStatus(null);
    }, [showConflicts]);

    // Check if any practitioner has calendar integration enabled
    const hasCalendarIntegration = useMemo(() => {
        if (!practitionersCalendarStatus || Object.keys(practitionersCalendarStatus).length === 0) {
            return false;
        }
        return Object.values(practitionersCalendarStatus).some(status => status === true);
    }, [practitionersCalendarStatus]);

    // Sync local state with selectedDateTime prop when component remounts or prop changes
    useEffect(() => {
        if (selectedDateTime && selectedDateTime.trim() !== '') {
            try {
                // Parse the selectedDateTime string (format: "YYYY-MM-DD HH:mm:ss")
                const [datePart, timePart] = selectedDateTime.split(' ');
                
                if (datePart && timePart) {
                    // Parse date components
                    const [year, month, day] = datePart.split('-').map(Number);
                    
                    // Create date object (month is 0-indexed in JavaScript)
                    const parsedDate = new Date(year, month - 1, day);
                    
                    // Set the local state to restore the selection
                    setSelectedDate(parsedDate);
                    setSelectedTimeSlot(timePart);
                    
                    // Also update currentDate to show the correct month/year
                    setCurrentDate(parsedDate);
                    
                    console.log('✅ Calendar: Restored selection from prop:', {
                        selectedDateTime,
                        parsedDate: parsedDate.toISOString(),
                        timePart,
                    });
                }
            } catch (error) {
                console.error('❌ Calendar: Failed to parse selectedDateTime:', error);
            }
        }
    }, [selectedDateTime]);

    // Generate time slots based on practitioner availability and appointment settings
    const getTimeSlotsForDate = (date: Date): TimeSlot[] => {
        const dayName = date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
        const dailyAvailability = practitionerAvailability[dayName] || [];
        const slots: TimeSlot[] = [];

        console.log(`🔄 CALENDAR COMPONENT: getTimeSlotsForDate called for ${dayName}`);
        console.log(`📅 Existing appointments received:`, existingAppointments.length, existingAppointments);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

        if (dailyAvailability.length === 0) {
            console.log(`No availability for ${dayName}`);
            return [];
        }

        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Calculate minimum booking time based on advance booking hours (only if same-day booking is enabled)
        let minBookingTime = now;
        if (appointmentSettings?.allowSameDayBooking === true && appointmentSettings?.advanceBookingHours) {
            const advanceHours = parseInt(appointmentSettings.advanceBookingHours);
            minBookingTime = new Date(now.getTime() + (advanceHours * 60 * 60 * 1000));
        }

        // Get existing appointments for this date
        // IMPORTANT: The backend already converts appointment dates to location timezone
        // We need to use the same date format for comparison
        const dateString = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format in browser timezone
        
        // Filter appointments for this date - backend data is already in location timezone
        const appointmentsForDate = existingAppointments.filter(apt => {
            // The backend provides apt.date already converted to location timezone
            // Try multiple comparison methods to handle timezone edge cases
            
            // Method 1: Direct comparison (should work if timezones match)
            if (apt.date === dateString) {
                return true;
            }
            
            // Method 2: Parse the backend datetime and compare dates
            if (apt.datetime) {
                try {
                    const backendDate = new Date(apt.datetime);
                    const backendDateString = backendDate.toLocaleDateString('en-CA');
                    if (backendDateString === dateString) {
                        console.log(`📅 TIMEZONE FIX: Matched appointment ${apt.appointment_id} using datetime parsing`);
                        return true;
                    }
                } catch (e) {
                    console.warn(`⚠️ Failed to parse backend datetime: ${apt.datetime}`, e);
                }
            }
            
            // Method 3: Try parsing apt.date as a date string and compare
            if (apt.date) {
                try {
                    const aptDate = new Date(apt.date + 'T00:00:00');
                    const aptDateString = aptDate.toLocaleDateString('en-CA');
                    if (aptDateString === dateString) {
                        console.log(`📅 TIMEZONE FIX: Matched appointment ${apt.appointment_id} using date string parsing`);
                        return true;
                    }
                } catch (e) {
                    console.warn(`⚠️ Failed to parse backend date: ${apt.date}`, e);
                }
            }
            
            return false;
        });
        
        console.log(`🗓️ Checking slots for date: ${dateString}`);
        console.log(`📋 All existing appointments (${existingAppointments.length}):`, existingAppointments.map(apt => ({
            id: apt.appointment_id,
            date: apt.date,
            time: apt.time,
            datetime: apt.datetime,
            status: apt.status,
            duration: apt.duration
        })));
        console.log(`📅 Appointments for this date (${dateString}) - Found ${appointmentsForDate.length}:`, appointmentsForDate.map(apt => ({
            id: apt.appointment_id,
            date: apt.date,
            time: apt.time,
            datetime: apt.datetime,
            status: apt.status,
            duration: apt.duration,
            timezone_converted: (apt as any).timezone_converted,
            original_utc: (apt as any).original_utc
        })));
        
        // Additional timezone debugging
        console.log(`🌍 Browser timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        console.log(`🕐 Current browser time: ${new Date().toISOString()}`);
        console.log(`📍 Selected date for slots: ${date.toISOString()}`);
        console.log(`🔍 TIMEZONE DEBUGGING - Date Comparison:`);
        console.log(`   📅 Frontend date string (browser TZ): ${dateString}`);
        console.log(`   📋 Backend appointment dates:`, appointmentsForDate.map(apt => ({
            backend_date: apt.date,
            backend_time: apt.time,
            backend_datetime: apt.datetime,
            matches_frontend_date: apt.date === dateString
        })));
        console.log(`   ⚠️  If no matches found, there's a timezone mismatch between frontend and backend!`);

        dailyAvailability.forEach(period => {
            const [startHour, startMinute] = period.start_time.split(':').map(Number);
            const [endHour, endMinute] = period.end_time.split(':').map(Number);

            const currentSlotTime = new Date(date);
            currentSlotTime.setHours(startHour, startMinute, 0, 0);

            const endPeriodTime = new Date(date);
            endPeriodTime.setHours(endHour, endMinute, 0, 0);

            while (currentSlotTime.getTime() + appointmentSessionDuration * 60 * 1000 <= endPeriodTime.getTime()) {
                const formattedTime = currentSlotTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                const hour = currentSlotTime.getHours();
                let periodLabel: 'morning' | 'afternoon' | 'evening';
                if (hour >= 5 && hour < 12) {
                    periodLabel = 'morning';
                } else if (hour >= 12 && hour < 17) {
                    periodLabel = 'afternoon';
                } else {
                    periodLabel = 'evening';
                }

                // Check if this slot meets the minimum advance booking time requirement
                let isSlotAvailable = true;
                
                // If same-day booking is disabled, bypass all restrictions
                if (appointmentSettings?.allowSameDayBooking === false) {
                    isSlotAvailable = true;
                } else if (appointmentSettings?.allowSameDayBooking === true) {
                    // Only apply restrictions if same-day booking is enabled
                    if (date.toDateString() === today.toDateString()) {
                        // For today, check advance booking hours if set
                        if (appointmentSettings?.advanceBookingHours) {
                            isSlotAvailable = currentSlotTime >= minBookingTime;
                        }
                    }
                    // For future dates, slots are available (date-level restrictions already handled)
                }

                // Check if this slot conflicts with existing appointments using slot blocking algorithm + overlap detection
                if (isSlotAvailable) {
                    for (const existingAppointment of appointmentsForDate) {
                        console.log(`🔍 Processing appointment ${existingAppointment.appointment_id} for slot ${formattedTime}:`, {
                            appointment_time: existingAppointment.time,
                            appointment_date: existingAppointment.date,
                            appointment_datetime: existingAppointment.datetime,
                            appointment_duration: existingAppointment.duration,
                            current_slot_time: formattedTime
                        });
                        
                        // Parse appointment time - handle potential format issues
                        let aptHour, aptMinute;
                        try {
                            if (!existingAppointment.time || typeof existingAppointment.time !== 'string') {
                                console.error(`❌ Invalid appointment time format:`, existingAppointment);
                                continue;
                            }
                            [aptHour, aptMinute] = existingAppointment.time.split(':').map(Number);
                            if (isNaN(aptHour) || isNaN(aptMinute)) {
                                console.error(`❌ Failed to parse appointment time:`, existingAppointment.time);
                                continue;
                            }
                        } catch (error) {
                            console.error(`❌ Error parsing appointment time:`, error, existingAppointment);
                            continue;
                        }
                        
                        // Create appointment start time in the same timezone context as our selected date
                        const aptStart = new Date(date);
                        aptStart.setHours(aptHour, aptMinute, 0, 0);
                        
                        console.log(`🔍 APPOINTMENT TIME DEBUGGING:`, {
                            selected_date: date.toISOString(),
                            selected_date_local: date.toString(),
                            appointment_time_string: existingAppointment.time,
                            parsed_hours: aptHour,
                            parsed_minutes: aptMinute,
                            appointment_start: aptStart.toISOString(),
                            appointment_start_local: aptStart.toString(),
                            current_slot_time: currentSlotTime.toISOString(),
                            current_slot_time_local: currentSlotTime.toString()
                        });

                        // Get the original duration when the appointment was created
                        const originalAppointmentDuration = existingAppointment.duration ?? appointmentSessionDuration;
                        const aptEnd = new Date(aptStart.getTime() + (originalAppointmentDuration * 60 * 1000));
                        
                        // Current slot time range
                        const currentSlotEnd = new Date(currentSlotTime.getTime() + (appointmentSessionDuration * 60 * 1000));
                        
                        // METHOD 1: Check for direct time overlap with appointment's actual stored duration
                        const hasOverlap = currentSlotTime < aptEnd && currentSlotEnd > aptStart;
                        
                        if (hasOverlap) {
                            isSlotAvailable = false;
                            console.log(`❌ Slot ${formattedTime} disabled - OVERLAP with appointment ${existingAppointment.appointment_id || 'unknown'} at ${existingAppointment.time}`);
                            console.log(`📋 Overlap detection:`, {
                                'new_slot_time': `${currentSlotTime.toISOString()} to ${currentSlotEnd.toISOString()}`,
                                'new_slot_duration': `${appointmentSessionDuration} minutes`,
                                'existing_appointment_time': `${aptStart.toISOString()} to ${aptEnd.toISOString()}`,
                                'existing_appointment_duration': `${originalAppointmentDuration} minutes`,
                                'overlap_detected': true,
                                'note': 'Direct time overlap with stored appointment duration',
                                'appointment_status': existingAppointment.status || 'unknown',
                                'appointment_mode': existingAppointment.mode || 'unknown'
                            });
                        } else {
                            // METHOD 2: If no overlap, also check slot blocking algorithm for consecutive blocking
                            const slotsToBlock = Math.ceil(originalAppointmentDuration / appointmentSessionDuration);
                            
                            // Check if current slot falls within the blocked slots
                            for (let slotIndex = 0; slotIndex < slotsToBlock; slotIndex++) {
                                const blockedSlotStart = new Date(aptStart.getTime() + (slotIndex * appointmentSessionDuration * 60 * 1000));
                                
                                // Check if current slot matches this blocked slot
                                if (currentSlotTime.getTime() === blockedSlotStart.getTime()) {
                                    isSlotAvailable = false;
                                    console.log(`❌ Slot ${formattedTime} disabled - SLOT BLOCKING ${slotIndex + 1}/${slotsToBlock} for appointment ${existingAppointment.appointment_id || 'unknown'} at ${existingAppointment.time}`);
                                    console.log(`📋 Slot blocking details:`, {
                                        'appointment_time': aptStart.toISOString(),
                                        'original_appointment_duration': `${originalAppointmentDuration} minutes`,
                                        'current_session_duration': `${appointmentSessionDuration} minutes`, 
                                        'slots_to_block': slotsToBlock,
                                        'blocked_slot_index': slotIndex + 1,
                                        'blocked_slot_time': blockedSlotStart.toISOString(),
                                        'current_slot_time': currentSlotTime.toISOString(),
                                        'note': 'Using slot blocking algorithm: ceil(original_duration / current_duration)',
                                        'appointment_status': existingAppointment.status || 'unknown',
                                        'appointment_mode': existingAppointment.mode || 'unknown'
                                    });
                                    break;
                                }
                            }
                        }
                        
                        if (!isSlotAvailable) {
                            break; // Exit loop if slot is already marked as unavailable
                        }
                    }
                }

                slots.push({
                    time: formattedTime,
                    available: isSlotAvailable,
                    period: periodLabel,
                });

                console.log(`✅ Slot ${formattedTime}: ${isSlotAvailable ? 'AVAILABLE' : 'BLOCKED'}`);

                currentSlotTime.setMinutes(currentSlotTime.getMinutes() + appointmentSessionDuration);
            }
        });

        // Remove duplicates and sort slots by time
        const uniqueSlots = Array.from(
            new Map(slots.map(slot => [slot.time, slot])).values()
        );
        
        uniqueSlots.sort((a, b) => {
            const [aHour, aMinute] = a.time.split(':').map(Number);
            const [bHour, bMinute] = b.time.split(':').map(Number);
            if (aHour !== bHour) {
                return aHour - bHour;
            }
            return aMinute - bMinute;
        });
        
     
        // Show detailed slot availability
        const availableSlots = uniqueSlots.filter(s => s.available);
        const unavailableSlots = uniqueSlots.filter(s => !s.available);
        console.log(`✅ Available slots (${availableSlots.length}):`, availableSlots.map(s => s.time));
        console.log(`❌ Unavailable slots (${unavailableSlots.length}):`, unavailableSlots.map(s => s.time));
        
        return uniqueSlots;
    };

    const timeSlots = selectedDate ? getTimeSlotsForDate(selectedDate) : [];

    // Calendar helper functions
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatMonthYear = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    };

    const isDateDisabled = (date: Date) => {
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check if date is in the past
        if (date < today) {
            return true;
        }
        
        // If same-day booking is disabled, bypass ALL advance booking restrictions
        if (appointmentSettings?.allowSameDayBooking === false) {
            return false; // Allow all dates (except past dates)
        }
        
        // Only apply restrictions if same-day booking is enabled
        if (appointmentSettings?.allowSameDayBooking === true) {
            // Check minimum advance booking hours
            if (appointmentSettings?.advanceBookingHours) {
                const advanceHours = parseInt(appointmentSettings.advanceBookingHours);
                const minBookingTime = new Date(now.getTime() + (advanceHours * 60 * 60 * 1000));
                
                // If the entire day is before the minimum booking time, disable it
                if (date < minBookingTime) {
                    return true;
                }
            }
            
            // Check maximum advance booking days
            if (appointmentSettings?.maxAdvanceBookingDays) {
                const maxDays = parseInt(appointmentSettings.maxAdvanceBookingDays);
                const maxBookingDate = new Date(today);
                maxBookingDate.setDate(maxBookingDate.getDate() + maxDays);
                
                if (date > maxBookingDate) {
                    return true;
                }
            }
        }
        
        return false;
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSameDate = (date1: Date, date2: Date | null) => {
        if (!date2) return false;
        return date1.toDateString() === date2.toDateString();
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (direction === 'prev') {
                newDate.setMonth(prev.getMonth() - 1);
            } else {
                newDate.setMonth(prev.getMonth() + 1);
            }
            return newDate;
        });
    };

    const handleDateSelect = async (day: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (isDateDisabled(date)) return;
        
        setSelectedDate(date);
        setSelectedTimeSlot(null); // Reset time slot when date changes
        setCalendarWarning(null); // Clear warning when date changes
        setWarningType(null);
        setDayConflicts([]); // Clear previous day conflicts
        
        // Check for day conflicts if practitionerId is provided, conflicts are enabled, calendar integration is available, and calendar is not known to be disconnected
        if (practitionerId && showConflicts && hasCalendarIntegration && calendarConnectionStatus !== false) {
            setCheckingDayConflicts(true);
            
            try {
                await checkDayConflicts(date);
            } catch (error) {
                console.error('Error checking day conflicts:', error);
                // Still allow date selection even if conflict check fails
            } finally {
                setCheckingDayConflicts(false);
            }
        } else if (!hasCalendarIntegration) {
            console.log('⏭️ Skipping day conflict check - no calendar integration available');
        } else if (calendarConnectionStatus === false) {
            console.log('⏭️ Skipping day conflict check - calendar not connected');
        }
    };

    const handleTimeSlotSelect = (time: string) => {
        if (!selectedDate) return;
        
        setSelectedTimeSlot(time);
        
        // Format the complete date-time string using LOCAL timezone (not UTC)
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateTimeString = `${year}-${month}-${day} ${time}`;
        
        console.log('📅 CALENDAR COMPONENT DATE DEBUGGING:');
        console.log('='.repeat(50));
        console.log('🗓️ Selected date object:', selectedDate);
        console.log('📆 Selected date string methods:', {
            'toDateString()': selectedDate.toDateString(),
            'toISOString()': selectedDate.toISOString(),
            'toLocaleDateString()': selectedDate.toLocaleDateString(),
            'getFullYear()': selectedDate.getFullYear(),
            'getMonth()': selectedDate.getMonth() + 1, // +1 because 0-based
            'getDate()': selectedDate.getDate()
        });
        console.log('🕐 Selected time slot:', time);
        console.log('📝 Formatted dateTimeString being sent to form:', dateTimeString);
        console.log('🚨 VERIFY: Does this match what you clicked on the calendar?');
        console.log('='.repeat(50));
        
        // Check for calendar conflicts only if calendar integration is available
        if (hasCalendarIntegration) {
            checkCalendarConflict(selectedDate, time);
        }
        
        onDateTimeSelect(dateTimeString);
    };

    const checkCalendarConflict = async (date: Date, time: string) => {
        // Don't check conflicts if showConflicts is false
        if (!showConflicts) {
            setCalendarWarning(null);
            setWarningType(null);
            return;
        }

        // Skip if no calendar integration is available
        if (!hasCalendarIntegration) {
            console.log('⏭️ Skipping calendar conflict check - no calendar integration available');
            return;
        }

        // Skip if we already know the calendar is not connected
        if (calendarConnectionStatus === false) {
            console.log('⏭️ Skipping calendar conflict check - calendar not connected');
            return;
        }

        // Determine which practitioners to check
        const practitionersToCheck = practitionerIds && practitionerIds.length > 0 
            ? practitionerIds 
            : practitionerId 
                ? [parseInt(practitionerId)] 
                : [];

        if (practitionersToCheck.length === 0) {
            // Don't show any warning if no practitioners selected
            setCalendarWarning(null);
            setWarningType(null);
            return;
        }

        setCheckingConflict(true);
        setCalendarWarning(null);
        
        try {
            // Create date time string in YYYY-MM-DD HH:mm:ss format
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateTimeForApi = `${year}-${month}-${day} ${time}:00`;
            
            console.log('🔍 CHECKING CALENDAR CONFLICTS:');
            console.log('📅 Date:', date.toDateString());
            console.log('🕐 Time:', time);
            console.log('👥 Practitioners:', practitionersToCheck);
            console.log('🌐 Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
            console.log('📊 API Format:', dateTimeForApi);
            
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            // Send appropriate practitioner data based on what we have
            const requestBody: any = {
                date_time: dateTimeForApi,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            if (practitionersToCheck.length > 1) {
                // Send array for multiple practitioners
                requestBody.practitioner_ids = practitionersToCheck;
            } else {
                // Send single practitioner for backward compatibility
                requestBody.practitioner_id = practitionersToCheck[0];
            }
            
            const response = await fetch(publicPortal ? '/public-portal/integrations/check-calendar-conflicts' : '/integrations/check-calendar-conflicts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(csrfToken && { 'X-CSRF-TOKEN': csrfToken }),
                },
                body: JSON.stringify(requestBody)
            });

            const contentType = response.headers.get('content-type');
            
            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = `Server error (${response.status})`;
                
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorData.error || errorMessage;
                    } catch (jsonError) {
                        console.error('Failed to parse error JSON:', jsonError);
                    }
                } else {
                    const errorText = await response.text();
                    if (errorText && !errorText.includes('<!DOCTYPE')) {
                        errorMessage = errorText;
                    }
                }
                
                throw new Error(errorMessage);
            }

            // Ensure we're getting JSON response
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            const result: CalendarConflictResult = await response.json();

            console.log('✅ CONFLICT CHECK RESPONSE:');
            console.log('📊 Result:', result);

            // Cache the calendar connection status
            setCalendarConnectionStatus(result.is_connected);

            // Only show warnings for actual conflicts, nothing else
            if (result.is_connected && result.has_conflict) {
                console.log('🚨 CONFLICT DETECTED!');
                console.log('📅 Conflicting event:', result.conflict_details);
                console.log('💡 User should choose a different time slot');
                setCalendarWarning(result.message || '❌ Conflict detected: An event is already scheduled at this time.');
                setWarningType('error');
            } else {
                // No conflicts or no calendar connected - show nothing
                console.log(result.is_connected ? '✅ No conflicts found' : '⚠️ No calendar connected');
                setCalendarWarning(null);
                setWarningType(null);
            }
            console.log('='.repeat(40));
        } catch (error) {
            console.error('Failed to check calendar conflicts:', error);
            // On error, assume calendar is not connected to prevent further unnecessary checks
            setCalendarConnectionStatus(false);
            // Don't show error warnings on appointment screen
            setCalendarWarning(null);
            setWarningType(null);
        } finally {
            setCheckingConflict(false);
        }
    };

    const checkDayConflicts = async (date: Date) => {
        // Don't check conflicts if showConflicts is false
        if (!showConflicts) {
            setDayConflicts([]);
            return;
        }

        // Skip if no calendar integration is available
        if (!hasCalendarIntegration) {
            console.log('⏭️ Skipping day conflict check - no calendar integration available');
            return;
        }

        // Skip if we already know the calendar is not connected
        if (calendarConnectionStatus === false) {
            console.log('⏭️ Skipping day conflict check - calendar not connected');
            return;
        }

        // Determine which practitioners to check for day conflicts
        const practitionersToCheck = practitionerIds && practitionerIds.length > 0 
            ? practitionerIds 
            : practitionerId 
                ? [parseInt(practitionerId)] 
                : [];

        if (practitionersToCheck.length === 0) {
            // Don't show any warning if no practitioners selected
            setCalendarWarning(null);
            setWarningType(null);
            return;
        }

        // Format date for API (YYYY-MM-DD)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateForApi = `${year}-${month}-${day}`;

        try {
            console.log('📅 STARTING DAY CONFLICTS CHECK');
            console.log('='.repeat(40));
            console.log('📆 SELECTED DATE DEBUGGING:', {
                'original_date_object': date,
                'date_toDateString': date.toDateString(),
                'date_toISOString': date.toISOString(),
                'formatted_for_api': dateForApi,
                'timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
            });
            console.log('🔍 Checking day conflicts for:', {
                practitioner_ids: practitionersToCheck,
                primary_practitioner_id: practitionersToCheck[0],
                date: dateForApi,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });
            console.log('🔍 Sending request to: /integrations/check-day-conflicts');
            
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            const response = await fetch(publicPortal ? '/public-portal/integrations/check-day-conflicts' : '/integrations/check-day-conflicts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(csrfToken && { 'X-CSRF-TOKEN': csrfToken }),
                },
                body: JSON.stringify({
                    practitioner_id: practitionersToCheck[0], // Use first practitioner for day conflicts
                    date: dateForApi,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                })
            });

            const contentType = response.headers.get('content-type');
            
            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = `Server error (${response.status})`;
                
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorData.error || errorMessage;
                    } catch (jsonError) {
                        console.error('Failed to parse error JSON:', jsonError);
                    }
                } else {
                    const errorText = await response.text();
                    if (errorText && !errorText.includes('<!DOCTYPE')) {
                        errorMessage = errorText;
                    }
                }
                
                throw new Error(errorMessage);
            }

            // Ensure we're getting JSON response
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            const result: DayConflictResult = await response.json();

            console.log('✅ DAY CONFLICTS CHECK RESPONSE:');
            console.log('📊 Result:', result);

            // Cache the calendar connection status
            setCalendarConnectionStatus(result.is_connected);

            // Only show day conflicts if there are actual conflicts, nothing else
            if (result.is_connected && result.has_conflicts && result.conflicts && result.conflicts.length > 0) {
                console.log('📅 DAY CONFLICTS FOUND!');
                console.log('📊 Total conflicts:', result.conflict_count);
                console.log('📋 Conflicts list:', result.conflicts);
                setCalendarWarning(`📅 Found ${result.conflict_count} calendar event(s) for this day.`);
                setWarningType('warning'); // Use warning type for day conflicts
                setDayConflicts(result.conflicts);
            } else {
                // No conflicts or no calendar connected - show nothing
                console.log(result.is_connected 
                    ? (result.has_conflicts ? '✅ No day conflicts' : '✅ No events for this day') 
                    : '⚠️ No calendar connected');
                setCalendarWarning(null);
                setWarningType(null);
                setDayConflicts([]);
            }
            console.log('='.repeat(40));
        } catch (error) {
            console.error('Failed to check day conflicts:', error);
            // On error, assume calendar is not connected to prevent further unnecessary checks
            setCalendarConnectionStatus(false);
            // Don't show error warnings on appointment screen
            setCalendarWarning(null);
            setWarningType(null);
            setDayConflicts([]);
        }
    };

    const hasAvailableSlots = (date: Date) => {
        const slots = getTimeSlotsForDate(date);
        return slots.some(slot => slot.available);
    };

    const renderCalendarDays = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(
                <div key={`empty-${i}`} className="h-12" />
            );
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const disabled = isDateDisabled(date);
            const today = isToday(date);
            const selected = isSameDate(date, selectedDate);
            const hasSlots = !disabled && hasAvailableSlots(date);

            days.push(
                <div key={day} className="h-12 flex flex-col items-center">
                    <motion.button
                        type="button"
                        onClick={() => handleDateSelect(day)}
                        disabled={disabled}
                        className={cn(
                            "h-10 w-10 rounded-lg text-sm font-medium transition-colors",
                            "hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20",
                            disabled && "text-gray-300 cursor-not-allowed hover:bg-transparent",
                            today && !selected && "bg-blue-50 text-blue-600 border border-blue-200",
                            selected && "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                        whileHover={!disabled ? { scale: 1.05 } : {}}
                        whileTap={!disabled ? { scale: 0.95 } : {}}
                    >
                        {day}
                    </motion.button>
                    {/* Availability dot */}
                    <div className="h-2 flex items-center justify-center">
                        {hasSlots && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-1.5 h-1.5 bg-green-500 rounded-full"
                            />
                        )}
                    </div>
                </div>
            );
        }

        return days;
    };

    const groupTimeSlotsByPeriod = () => {
        const grouped = {
            morning: timeSlots.filter(slot => slot.period === 'morning'),
            afternoon: timeSlots.filter(slot => slot.period === 'afternoon'),
            evening: timeSlots.filter(slot => slot.period === 'evening'),
        };
        return grouped;
    };

    const getPeriodLabel = (period: 'morning' | 'afternoon' | 'evening') => {
        switch (period) {
            case 'morning': return 'Morning';
            case 'afternoon': return 'Afternoon';
            case 'evening': return 'Evening';
            default: return '';
        }
    };

    const getPeriodIcon = (period: 'morning' | 'afternoon' | 'evening') => {
        switch (period) {
            case 'morning': return <Sunrise className="h-4 w-4 text-orange-500" />;
            case 'afternoon': return <Sun className="h-4 w-4 text-yellow-500" />;
            case 'evening': return <Moon className="h-4 w-4 text-indigo-500" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    return (
        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side - Calendar */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Select Date
                        </h3>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigateMonth('prev')}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <motion.div
                                key={formatMonthYear(currentDate)}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="min-w-[140px] text-center font-medium"
                            >
                                {formatMonthYear(currentDate)}
                            </motion.div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigateMonth('next')}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="space-y-2">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                                    {day}
                                </div>
                            ))}
                        </div>
                        
                        {/* Calendar days */}
                        <motion.div
                            key={`${currentDate.getMonth()}-${currentDate.getFullYear()}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="grid grid-cols-7 gap-1"
                        >
                            {renderCalendarDays()}
                        </motion.div>
                        
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span>Available slots</span>
                            </div>
                        </div>
                    </div>

                    {selectedDate && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20"
                        >
                            <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                <CheckCircle className="h-4 w-4" />
                                Selected: {formatDate(selectedDate)}
                            </div>
                            {checkingDayConflicts && (
                                <div className="flex items-center gap-2 text-xs text-blue-600 mt-1">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="inline-block"
                                    >
                                        <Clock className="h-3 w-3" />
                                    </motion.div>
                                    <span>Checking calendar events...</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </CardContent>
            </Card>

            {/* Right Side - Time Slots */}
            <AnimatePresence>
                {selectedDate ? (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="h-full">
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                    <Clock className="h-5 w-5 text-primary" />
                                    Available Time Slots
                                </h3>

                                <div className="space-y-6">
                                    {Object.entries(groupTimeSlotsByPeriod()).map(([period, slots]) => {
                                        if (slots.length === 0) return null;
                                        
                                        return (
                                            <motion.div
                                                key={period}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                                className="space-y-3"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {getPeriodIcon(period as any)}
                                                    <h4 className="font-medium text-gray-700">
                                                        {getPeriodLabel(period as any)}
                                                    </h4>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {slots.filter(s => s.available).length} available
                                                    </Badge>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    {slots.map((slot, idx) => (
                                                        <motion.button
                                                            key={`${slot.time}-${idx}`}
                                                            type="button"
                                                            onClick={() => slot.available && handleTimeSlotSelect(slot.time)}
                                                            disabled={!slot.available}
                                                            className={cn(
                                                                "px-3 py-2 text-sm rounded-lg border transition-all relative",
                                                                "focus:outline-none focus:ring-2 focus:ring-primary/20",
                                                                slot.available
                                                                    ? selectedTimeSlot === slot.time
                                                                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                                                                        : "bg-white border-gray-200 hover:border-primary hover:bg-primary/5"
                                                                    : "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                                                            )}
                                                            title={!slot.available ? "This time slot is already booked" : ""}
                                                            whileHover={slot.available ? { scale: 1.05 } : {}}
                                                            whileTap={slot.available ? { scale: 0.95 } : {}}
                                                        >
                                                            {slot.time}
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Success/Appointment Confirmation - Show first */}
                                {selectedTimeSlot && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-6"
                                    >
                                        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                                            <div className="text-green-800">
                                                <p className="font-semibold text-base mb-1">
                                                    Appointment Selected
                                                </p>
                                                <p className="text-sm">
                                                    {formatDate(selectedDate)} at {selectedTimeSlot}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Day Conflicts Section - Only show actual conflicts */}
                                {((calendarWarning && (warningType === 'error' || (warningType === 'warning' && dayConflicts.length > 0))) || checkingDayConflicts) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-4"
                                    >
                                        <div className={cn(
                                            "border rounded-lg p-4",
                                            warningType === 'success' && "border-green-200 bg-green-50",
                                            warningType === 'warning' && "border-yellow-200 bg-yellow-50",
                                            warningType === 'error' && "border-red-200 bg-red-50",
                                            checkingDayConflicts && "border-blue-200 bg-blue-50"
                                        )}>
                                            {checkingDayConflicts ? (
                                                <div className="text-blue-800">
                                                    <p className="font-semibold text-base mb-1">
                                                        Checking Calendar
                                                    </p>
                                                    <p className="text-sm">
                                                        Loading events for this day...
                                                    </p>
                                                </div>
                                            ) : calendarWarning && warningType === 'error' ? (
                                                <div className="text-red-800">
                                                    <p className="font-semibold text-base mb-1">
                                                        ❌ Scheduling Conflict
                                                    </p>
                                                    <p className="text-sm">
                                                        {calendarWarning}
                                                    </p>
                                                </div>
                                            ) : calendarWarning && warningType === 'warning' && dayConflicts.length > 0 ? (
                                                <div className="text-amber-800">
                                                    <p className="font-semibold text-base mb-3">
                                                        📅 Calendar Events for This Day ({dayConflicts.length})
                                                    </p>
                                                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                                        {dayConflicts.map((conflict, index) => {
                                                            const eventType = getEventType(
                                                                conflict.title || '',
                                                                conflict.description || '',
                                                                conflict.is_all_day
                                                            );
                                                            const colors = getEventColors(eventType);
                                                            const badgeLabel = getBadgeLabel(eventType);

                                                            return (
                                                                <motion.div
                                                                    key={conflict.id || index}
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    transition={{ duration: 0.2, delay: 0 }}
                                                                    className={cn(
                                                                        "rounded-lg border border-r-0 border-t-0 border-b-0 p-4",
                                                                        "shadow-sm hover:shadow-md transition-all duration-200",
                                                                        colors.bg,
                                                                        colors.border
                                                                    )}
                                                                >
                                                                    {/* Header Row - Badges */}
                                                                    <div className="flex items-center justify-between gap-2 mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge className={cn(
                                                                                "text-xs px-2 py-0.5 font-medium border",
                                                                                colors.badge,
                                                                                colors.text
                                                                            )}>
                                                                                {badgeLabel}
                                                                            </Badge>

                                                                            {eventType === 'virtual' && (
                                                                                <Video className={cn("h-3.5 w-3.5", colors.icon)} />
                                                                            )}

                                                                            {eventType === 'all-day' && (
                                                                                <Calendar className={cn("h-3.5 w-3.5", colors.icon)} />
                                                                            )}
                                                                        </div>

                                                                        <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
                                                                            {conflict.duration}
                                                                        </Badge>
                                                                    </div>

                                                                    {/* Title - Primary Info */}
                                                                    <h4 className={cn(
                                                                        "font-semibold text-base mb-2.5 break-words leading-snug",
                                                                        colors.text
                                                                    )}>
                                                                        {conflict.title || 'Untitled Event'}
                                                                    </h4>

                                                                    {/* Time Display */}
                                                                    {!conflict.is_all_day && (
                                                                        <div className={cn(
                                                                            "flex items-center gap-2 text-sm mb-2",
                                                                            colors.text,
                                                                            "opacity-90"
                                                                        )}>
                                                                            <Clock className="h-4 w-4 shrink-0" />
                                                                            <span className="font-medium">
                                                                                {conflict.start_time} - {conflict.end_time}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {/* All Day Indicator */}
                                                                    {conflict.is_all_day && (
                                                                        <div className={cn(
                                                                            "flex items-center gap-2 text-sm mb-2",
                                                                            colors.text,
                                                                            "opacity-90"
                                                                        )}>
                                                                            <Calendar className="h-4 w-4 shrink-0" />
                                                                            <span className="font-medium">All Day Event</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Location */}
                                                                    {conflict.location && (
                                                                        <div className={cn(
                                                                            "flex items-center gap-2 text-sm mb-2",
                                                                            colors.text,
                                                                            "opacity-80"
                                                                        )}>
                                                                            <MapPin className="h-4 w-4 shrink-0" />
                                                                            <span className="truncate">{conflict.location}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Description */}
                                                                    {conflict.description && (
                                                                        <p className={cn(
                                                                            "text-sm mt-3 pt-3 border-t leading-relaxed line-clamp-3",
                                                                            colors.text,
                                                                            "opacity-75 border-current/20"
                                                                        )}>
                                                                            {conflict.description}
                                                                        </p>
                                                                    )}
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                    <p className="text-sm mt-3 flex items-center gap-2">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        <span>
                                                            Review these calendar events when selecting your appointment time to avoid scheduling conflicts.
                                                        </span>
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                )}

                                {timeSlots.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No time slots available for this date.</p>
                                        <p className="text-sm">Please select a different date.</p>
                                        {publicPortal && onJoinWaitingList && (
                                            <Button
                                                type="button"
                                                onClick={onJoinWaitingList}
                                                className="mt-4"
                                                variant="outline"
                                            >
                                                Join Waiting List
                                            </Button>
                                        )}
                                    </div>
                                )}
                                
                                {timeSlots.length > 0 && timeSlots.every(slot => !slot.available) && (
                                    <div className="text-center py-8 text-gray-500">
                                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>All slots are currently booked for this date.</p>
                                        <p className="text-sm">Please select a different date.</p>
                                        {publicPortal && onJoinWaitingList && (
                                            <Button
                                                type="button"
                                                onClick={onJoinWaitingList}
                                                className="mt-4"
                                                variant="outline"
                                            >
                                                Join Waiting List
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (
                    <Card className="h-full">
                        <CardContent className="p-6 flex items-center justify-center h-full min-h-[300px]">
                            <div className="text-center text-gray-500">
                                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">Select a date</p>
                                <p className="text-sm">Choose a date from the calendar to see available time slots</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </AnimatePresence>
        </div>
    );
});

CalendarBooking.displayName = 'CalendarBooking';

export default CalendarBooking;
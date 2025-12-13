import { Head, usePage, router } from '@inertiajs/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatTime as formatTimeWithTenantSettings } from '@/utils/time-locale-helpers';
import { 
    Building2, 
    MapPin, 
    Clock, 
    Phone, 
    Mail, 
    CheckCircle, 
    AlertCircle,
    Calendar,
    ChevronRight,
    Edit,
    Plus,
    Save,
    X,
    Settings,
    RefreshCw,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TimeSlot {
    time: string;
    available: boolean;
    period: 'morning' | 'afternoon' | 'evening';
    day: string;
}

interface Practitioner {
    id: number;
    full_name: string;
    title?: string;
    email: string;
    phone_number?: string;
}

interface Service {
    id: number;
    name: string;
    category: string;
    description?: string;
    delivery_modes: string[];
    default_price: number;
    custom_price?: number;
    effective_price: number;
    currency: string;
    tenant_name?: string;
    tenant_id?: string;
}

interface Location {
    id: number;
    name: string;
    full_address: string;
    phone_number?: string;
    email_address?: string;
    timezone: string;
    is_active: boolean;
    availability: Record<string, Array<{ start_time: string; end_time: string }>>;
    operating_hours?: Record<string, Array<{ start_time: string; end_time: string }>>;
    tenant_name?: string;
    tenant_id?: string;
}

interface Clinic {
    tenant_id: string;
    tenant_name: string;
    tenant_domain?: string;
    locations_count: number;
    locations: Location[];
    error?: string;
}

interface MyDetailsProps {
    practitioner?: Practitioner;
    clinics: Clinic[];
    message?: string;
}

export default function Index() {
    const page = usePage();
    const { practitioner, clinics, message, organization_settings }: any = page.props;
    const { tenancy }: any = page.props;
    const { flash } = page.props as { flash?: { success?: string; error?: string } };
    
    // Force animations on each page visit by tracking navigation
    const [animationKey, setAnimationKey] = useState(0);
    
    useEffect(() => {
        // Trigger animations on component mount (page visit)
        setAnimationKey(prev => prev + 1);
    }, []);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);
    
    // Initialize with first clinic expanded
    const initialExpandedClinics = new Set<string>();
    if (clinics.length > 0) {
        initialExpandedClinics.add(clinics[0].tenant_id);
    }
    
    const [expandedClinics, setExpandedClinics] = useState<Set<string>>(initialExpandedClinics);
    const [editingAvailability, setEditingAvailability] = useState<{ clinicId: string; locationId: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const formatTime = (time: string) => {
        if (!time) return '';
        
        try {
            // Use the tenant-level time formatting utility
            return formatTimeWithTenantSettings(time) || time;
        } catch (error) {
            console.warn('Error formatting time with tenant settings:', time, error);
            
            // Fallback to original logic if tenant formatting fails
            let cleanTime = time;
            
            if (time.includes('T')) {
                const timePart = time.split('T')[1];
                if (timePart) {
                    cleanTime = timePart.split('.')[0];
                }
            }
            
            const timeParts = cleanTime.split(':');
            if (timeParts.length >= 2) {
                const hours = timeParts[0].padStart(2, '0');
                const minutes = timeParts[1].padStart(2, '0');
                cleanTime = `${hours}:${minutes}`;
            }
            
            const date = new Date(`2000-01-01T${cleanTime}:00`);
            
            if (isNaN(date.getTime())) {
                return cleanTime;
            }
            
            return date.toLocaleTimeString([], { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        }
    };

    const getStatusBadge = (isActive: boolean) => {
        return isActive ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
            </Badge>
        ) : (
            <Badge variant="secondary" className="bg-red-100 text-red-800">
                <AlertCircle className="w-3 h-3 mr-1" />
                Inactive
            </Badge>
        );
    };

    const toggleClinic = (clinicId: string) => {
        const newExpanded = new Set(expandedClinics);
        if (newExpanded.has(clinicId)) {
            newExpanded.delete(clinicId);
        } else {
            newExpanded.add(clinicId);
        }
        setExpandedClinics(newExpanded);
    };

    const updateAvailability = async (clinicId: string, locationId: number, data: {
        availability: Record<string, Array<{ start_time: string; end_time: string }>>;
    }) => {
        setIsSubmitting(true);
        try {
            // Check if we're in central context
            const isCentral = tenancy?.is_central;
            
            // Debug logging
            console.log('🔍 Availability Update Debug:', {
                tenancy,
                isCentral,
                clinicId,
                locationId
            });
            
            let url: string;
            let requestData: any;
            
            if (isCentral) {
                // Central context - use central route and include tenant_id
                url = `/central/my-details/locations/${locationId}/availability`;
                requestData = {
                    ...data,
                    tenant_id: clinicId
                };
                console.log('📡 Using CENTRAL route:', url, requestData);
            } else {
                // Tenant context - use tenant route
                url = `/my-details/locations/${locationId}/availability`;
                requestData = data;
                console.log('📡 Using TENANT route:', url, requestData);
            }
            
            await router.post(url, requestData, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingAvailability(null);
                },
            });
        } catch (error) {
            console.error('Error updating availability:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!practitioner) {
        return (
            <AppLayout>
                <Head title="My Details" />
                <div className="p-4">
                    <Card>
                        <CardContent className="text-center py-12">
                            <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Practitioner Profile</h3>
                            <p className="text-gray-500">{message || 'Unable to load practitioner information.'}</p>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Practice Management" />
            <div className="p-4 space-y-4 bg-gradient-to-br from-gray-50 to-white min-h-screen">
                
                {/* Header Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">Practice Management</h1>
                            <p className="text-gray-600 text-sm">
                                {practitioner.title && `${practitioner.title} `}{practitioner.full_name} • 
                                Manage your services, pricing, and availability across all clinics
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => router.visit('/my-details', { preserveScroll: true })}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh Data
                        </Button>
                    </div>
                </div>

                {/* Current Tenant Context Indicator */}
                {editingAvailability && tenancy?.company_name && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                                Currently editing in: <span className="font-bold">{tenancy.company_name}</span>
                            </span>
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                Tenant: {tenancy.id}
                            </Badge>
                        </div>
                        <p className="text-xs text-blue-700 mt-1">
                            Changes will be saved to this clinic only
                        </p>
                    </div>
                )}

                {/* Clinics Management View */}
                <div className="space-y-4">
                    {clinics.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                            <div className="text-center">
                                <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Clinic Associations Found</h3>
                                <p className="text-gray-500">You are not currently associated with any clinics.</p>
                            </div>
                        </div>
                    ) : (
                        clinics.map((clinic: Clinic, index: number) => {
                            const isExpanded = expandedClinics.has(clinic.tenant_id);
                            
                            return (
                                <motion.div 
                                    key={`${clinic.tenant_id}-${animationKey}`}
                                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.1 }}
                                >
                                    {/* Collapsible Clinic Header */}
                                    <div 
                                        className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleClinic(clinic.tenant_id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-primary rounded-lg shadow-sm">
                                                    <Building2 className="w-5 h-5 text-primary-foreground" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-semibold text-gray-900">{clinic.tenant_name}</h2>
                                                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                                                        <span className="flex items-center">
                                                            <MapPin className="w-3 h-3 mr-1" />
                                                            {clinic.locations_count} location{clinic.locations_count !== 1 ? 's' : ''}
                                                        </span>
                                                        {clinic.tenant_domain && (
                                                            <span className="text-primary font-medium">{clinic.tenant_domain}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                                {clinic.error && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        Error
                                                    </Badge>
                                                )}
                                                <motion.div
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <Button variant="ghost" size="sm">
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </motion.div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Expandable Content with Animation */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ 
                                                    duration: 0.3,
                                                    ease: "easeInOut"
                                                }}
                                                style={{ overflow: "hidden" }}
                                            >
                                                <div className="p-6 space-y-6">
                                                    {clinic.error ? (
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.1 }}
                                                            className="flex items-center p-3 bg-red-50 rounded-lg border border-red-200"
                                                        >
                                                            <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
                                                            <span className="text-red-800 text-sm">{clinic.error}</span>
                                                        </motion.div>
                                                    ) : (
                                                        <>
                                                            {/* Available Days Management */}
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.1 }}
                                                            >
                                                                <AvailableDaysSection 
                                                                    clinic={clinic} 
                                                                    practitioner={practitioner}
                                                                    tenancy={tenancy}
                                                                />
                                                            </motion.div>

                                                            {/* Locations & Availability Management */}
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.2 }}
                                                            >
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                                                    <Calendar className="w-4 h-4 mr-2 text-primary" />
                                                                    Availability Management
                                                                </h3>
                                                                
                                                                {clinic.locations.length === 0 ? (
                                                                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                                                                        <MapPin className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                                                        <p className="text-sm">No location assignments found for this clinic.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-4">
                                                                        {clinic.locations.map((location: Location, locationIndex: number) => (
                                                                            <motion.div
                                                                                key={`${location.id}-${animationKey}`}
                                                                                initial={{ opacity: 0, x: -20 }}
                                                                                animate={{ opacity: 1, x: 0 }}
                                                                                transition={{ 
                                                                                    delay: locationIndex * 0.1,
                                                                                    duration: 0.3
                                                                                }}
                                                                            >
                                                                                <LocationCard
                                                                                    location={location}
                                                                                    clinicId={clinic.tenant_id}
                                                                                    isEditing={editingAvailability?.clinicId === clinic.tenant_id && editingAvailability?.locationId === location.id}
                                                                                    onEdit={() => setEditingAvailability({ clinicId: clinic.tenant_id, locationId: location.id })}
                                                                                    onSave={(data) => updateAvailability(clinic.tenant_id, location.id, data)}
                                                                                    onCancel={() => setEditingAvailability(null)}
                                                                                    isSubmitting={isSubmitting}
                                                                                    daysOfWeek={daysOfWeek}
                                                                                    formatTime={formatTime}
                                                                                    getStatusBadge={getStatusBadge}
                                                                                    organizationSettings={organization_settings || {
                                                                                        appointment_session_duration: 30,
                                                                                        appointment_advance_booking_hours: 2,
                                                                                        appointment_allow_same_day_booking: true,
                                                                                        appointment_max_advance_booking_days: 60
                                                                                    }}
                                                                                />
                                                                            </motion.div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </motion.div>
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

// Location Card Component with Fixed Slot State Management
interface LocationCardProps {
    location: Location;
    clinicId: string;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (data: { availability: Record<string, Array<{ start_time: string; end_time: string }>> }) => void;
    onCancel: () => void;
    isSubmitting: boolean;
    daysOfWeek: string[];
    formatTime: (time: string) => string;
    getStatusBadge: (isActive: boolean) => React.JSX.Element;
    organizationSettings: {
        appointment_session_duration: number;
        appointment_advance_booking_hours: number;
        appointment_allow_same_day_booking: boolean;
        appointment_max_advance_booking_days: number;
        appointment_buffer_time_between_appointments?: number;
        appointment_allow_back_to_back_appointments?: boolean;
    };
}

function LocationCard({ location, clinicId, isEditing, onEdit, onSave, onCancel, isSubmitting, daysOfWeek, formatTime, getStatusBadge, organizationSettings }: LocationCardProps) {
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [availableSlots, setAvailableSlots] = useState<Record<string, string[]>>({});
    const [generatedSlots, setGeneratedSlots] = useState<Record<string, string[]>>({});
    
    // Convert disabled slots to state for proper re-rendering
    const [disabledSlots, setDisabledSlots] = useState<Record<string, string[]>>({});
    
    // Track location ID and session duration to detect changes
    const prevLocationIdRef = useRef(location.id);
    const prevSessionDurationRef = useRef(organizationSettings?.appointment_session_duration || 30);
    
    // Helper function to generate slots for a specific day
    const generateSlotsForDay = (dayName: string, dailyAvailability: any[], appointmentSessionDuration: number): TimeSlot[] => {
        const slots: TimeSlot[] = [];
        
        dailyAvailability.forEach(period => {
            const [startHour, startMinute] = period.start_time.split(':').map(Number);
            const [endHour, endMinute] = period.end_time.split(':').map(Number);

            let currentSlotMinutes = startHour * 60 + startMinute;
            const endPeriodMinutes = endHour * 60 + endMinute;

            while (currentSlotMinutes < endPeriodMinutes) {
                const hour = Math.floor(currentSlotMinutes / 60);
                const minute = currentSlotMinutes % 60;
                
                const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                
                let periodLabel: 'morning' | 'afternoon' | 'evening';
                if (hour >= 5 && hour < 12) {
                    periodLabel = 'morning';
                } else if (hour >= 12 && hour < 17) {
                    periodLabel = 'afternoon';
                } else {
                    periodLabel = 'evening';
                }

                slots.push({
                    time: formattedTime,
                    available: true,
                    period: periodLabel,
                    day: dayName
                });

                currentSlotMinutes += appointmentSessionDuration;
            }
        });
        
        return slots;
    };

    // Initialize disabled slots from server data
    const initializeFromServerData = (allGeneratedSlots: Record<string, string[]>) => {
        console.log('=== INITIALIZING DISABLED SLOTS FROM SERVER DATA ===');
        console.log('New generated slots to process:', allGeneratedSlots);
        
        const serverDisabledSlots: Record<string, string[]> = {};
        const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const appointmentSessionDuration = organizationSettings?.appointment_session_duration || 30;
        
        daysOfWeek.forEach(dayName => {
            const allDaySlots = allGeneratedSlots[dayName] || [];
            const serverAvailability = (location.availability?.[dayName] || []) as Array<{ start_time: string; end_time: string }>;
            
            if (allDaySlots.length === 0) {
                serverDisabledSlots[dayName] = [];
                return;
            }
            
            // Build set of enabled slots from server availability
            const enabledSlotTimes = new Set<string>();
            
            serverAvailability.forEach(period => {
                const [startHour, startMinute] = period.start_time.split(':').map(Number);
                const [endHour, endMinute] = period.end_time.split(':').map(Number);
                
                let currentSlotMinutes = startHour * 60 + startMinute;
                const endPeriodMinutes = endHour * 60 + endMinute;
                
                while (currentSlotMinutes < endPeriodMinutes) {
                    const hour = Math.floor(currentSlotMinutes / 60);
                    const minute = currentSlotMinutes % 60;
                    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    
                    enabledSlotTimes.add(formattedTime);
                    currentSlotMinutes += appointmentSessionDuration;
                }
            });
            
            // Find disabled slots
            const disabledSlots = allDaySlots.filter(slot => !enabledSlotTimes.has(slot));
            serverDisabledSlots[dayName] = disabledSlots;
        });
        
        console.log('Calculated disabled slots from server data:', serverDisabledSlots);
        return serverDisabledSlots;
    };

    // Calculate available slots from generated slots minus disabled slots
    const calculateAvailableSlots = (generated: Record<string, string[]>, disabled: Record<string, string[]>) => {
        const available: Record<string, string[]> = {};
        
        Object.entries(generated).forEach(([day, allSlots]) => {
            const dayDisabled = disabled[day] || [];
            available[day] = allSlots.filter(slot => !dayDisabled.includes(slot));
        });
        
        return available;
    };

    // Main effect for slot generation and management
    useEffect(() => {
        console.log('=== MAIN SLOT EFFECT ===');
        console.log('Location ID:', location.id, 'Previous:', prevLocationIdRef.current);
        
        const appointmentSessionDuration = parseInt(String(organizationSettings?.appointment_session_duration)) || 30;
        
        // Generate all possible slots
        const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const weeklySlots: Record<string, TimeSlot[]> = {};

        daysOfWeek.forEach(dayName => {
            const dailyAvailability = (location.availability?.[dayName] || []) as Array<{ start_time: string; end_time: string }>;
            weeklySlots[dayName] = generateSlotsForDay(dayName, dailyAvailability, appointmentSessionDuration);
        });
        
        // Convert to string arrays
        const allGeneratedSlots: Record<string, string[]> = {};
        Object.entries(weeklySlots).forEach(([day, timeSlots]) => {
            allGeneratedSlots[day] = timeSlots.map(slot => slot.time);
        });

        setGeneratedSlots(allGeneratedSlots);
        
        // Initialize disabled slots if location changed, session duration changed, or first load
        const locationChanged = prevLocationIdRef.current !== location.id;
        const sessionDurationChanged = prevSessionDurationRef.current !== appointmentSessionDuration;
        const firstLoad = Object.keys(disabledSlots).length === 0;
        
        if (locationChanged || sessionDurationChanged || firstLoad) {
            const changeType = locationChanged ? 'Location' : sessionDurationChanged ? 'Session duration' : 'First load';
            console.log(`${changeType} changed - reinitializing disabled slots`);
            console.log(`Session duration: ${prevSessionDurationRef.current} → ${appointmentSessionDuration}`);
            
            const initialDisabledSlots = initializeFromServerData(allGeneratedSlots);
            setDisabledSlots(initialDisabledSlots);
            
            // Update refs to current values
            prevLocationIdRef.current = location.id;
            prevSessionDurationRef.current = appointmentSessionDuration;
        }
        
        // Always recalculate available slots
        const calculatedAvailable = calculateAvailableSlots(allGeneratedSlots, disabledSlots);
        setAvailableSlots(calculatedAvailable);
        
        console.log('=== SLOT GENERATION COMPLETE ===');
        console.log('Session duration:', appointmentSessionDuration, 'minutes');
        console.log('Generated slots:', allGeneratedSlots);
        console.log('Disabled slots:', disabledSlots);
        console.log('Available slots:', calculatedAvailable);
        console.log('==========================================');
        
    }, [location.availability, location.id, organizationSettings?.appointment_session_duration]);

    // FIXED: Toggle individual slot with proper state updates
    const toggleSlot = (day: string, slot: string) => {
        console.log(`Toggling slot ${slot} for ${day}`);
        
        const currentAvailable = availableSlots[day] || [];
        const isCurrentlyEnabled = currentAvailable.includes(slot);
        
        const dayDisabled = disabledSlots[day] || [];
        
        const newDisabledSlots = { ...disabledSlots };
        
        if (isCurrentlyEnabled) {
            // Disable slot - add to disabled list
            newDisabledSlots[day] = [...dayDisabled, slot];
        } else {
            // Enable slot - remove from disabled list
            newDisabledSlots[day] = dayDisabled.filter(s => s !== slot);
        }
        
        // Update disabled slots state
        setDisabledSlots(newDisabledSlots);
        
        // Recalculate available slots
        const newAvailable = calculateAvailableSlots(generatedSlots, newDisabledSlots);
        setAvailableSlots(newAvailable);
        
        console.log('Updated disabled slots:', newDisabledSlots);
        console.log('Updated available slots:', newAvailable);
    };

    // FIXED: Toggle all slots with proper state updates
    const toggleAllSlots = (day: string) => {
        const allDaySlots = generatedSlots[day] || [];
        const currentDaySlots = availableSlots[day] || [];
        const allSelected = allDaySlots.length > 0 && allDaySlots.length === currentDaySlots.length;
        
        const newDisabledSlots = { ...disabledSlots };
        
        if (allSelected) {
            // Disable all slots
            newDisabledSlots[day] = [...allDaySlots];
        } else {
            // Enable all slots
            newDisabledSlots[day] = [];
        }
        
        // Update disabled slots state
        setDisabledSlots(newDisabledSlots);
        
        // Recalculate available slots
        const newAvailable = calculateAvailableSlots(generatedSlots, newDisabledSlots);
        setAvailableSlots(newAvailable);
    };

    // Save handler
    const handleSave = () => {
        console.log('=== SAVING AVAILABILITY ===');
        console.log('Current available slots:', availableSlots);
        console.log('Current disabled slots:', disabledSlots);
        
        const newAvailability: Record<string, Array<{ start_time: string; end_time: string }>> = {};
        const appointmentSessionDuration = organizationSettings?.appointment_session_duration || 30;
        
        // Process both available slots (enabled) and disabled days
        Object.keys(generatedSlots).forEach((day) => {
            const daySlots = availableSlots[day] || [];
            const dayGeneratedSlots = generatedSlots[day] || [];

            if (daySlots.length > 0) {
                // Day has enabled slots - group consecutive slots into periods
                const sortedSlots = daySlots.sort();
                const periods: Array<{ start_time: string; end_time: string }> = [];

                let currentStart = sortedSlots[0];
                let currentEnd = sortedSlots[0];

                for (let i = 1; i < sortedSlots.length; i++) {
                    const prevTime = new Date(`2000-01-01T${currentEnd}:00`);
                    const currTime = new Date(`2000-01-01T${sortedSlots[i]}:00`);

                    // Check if slots are consecutive
                    if (currTime.getTime() - prevTime.getTime() === appointmentSessionDuration * 60 * 1000) {
                        currentEnd = sortedSlots[i];
                    } else {
                        // Add current period and start new one
                        const endTime = new Date(`2000-01-01T${currentEnd}:00`);
                        endTime.setMinutes(endTime.getMinutes() + appointmentSessionDuration);
                        periods.push({
                            start_time: currentStart,
                            end_time: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                        });
                        currentStart = sortedSlots[i];
                        currentEnd = sortedSlots[i];
                    }
                }

                // Add the last period
                const endTime = new Date(`2000-01-01T${currentEnd}:00`);
                endTime.setMinutes(endTime.getMinutes() + appointmentSessionDuration);
                periods.push({
                    start_time: currentStart,
                    end_time: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                });

                newAvailability[day] = periods;
            } else if (dayGeneratedSlots.length > 0) {
                // Day has generated slots but practitioner disabled all of them
                // Send empty array to explicitly mark day as configured but disabled
                newAvailability[day] = [];
            }
        });
        
        console.log('Converted availability for server:', newAvailability);
        onSave({ availability: newAvailability });
    };

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h4 className="font-medium text-gray-900">{location.name}</h4>
                    <p className="text-sm text-gray-600">{location.full_address}</p>
                </div>
                <div className="flex items-center space-x-2">
                    {getStatusBadge(location.is_active)}
                    {!isEditing && (
                        <Button variant="ghost" size="sm" onClick={onEdit}>
                            <Edit className="w-3 h-3" />
                        </Button>
                    )}
                </div>
            </div>
            
            {isEditing ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-gray-700">Manage Available Slots for Public Portal</h5>
                        <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
                                <X className="w-3 h-3" />
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
                                <Save className="w-3 h-3 mr-1" />
                                {isSubmitting ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                    
                    <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
                        <strong>Instructions:</strong> Select which time slots patients can book for each day. Your selections will persist after saving.
                    </div>
                    
                  
                  
                    
                    {/* Session Duration Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                        <div className="flex items-center gap-2 text-sm text-blue-800">
                            <Clock className="w-4 h-4" />
                            <span><strong>Session Duration:</strong> {organizationSettings?.appointment_session_duration || 30} minutes</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                            Slots are generated automatically. Your slot selections are preserved across saves.
                        </p>
                    </div>

                    {/* Day Selection */}
                    <div className="space-y-3">
                        <h6 className="text-sm font-medium text-gray-700">Select Day to Manage Slots:</h6>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                            {Object.keys(generatedSlots).map(day => {
                                const daySlots = generatedSlots[day] || [];
                                const availableDaySlots = availableSlots[day] || [];
                                const isSelected = selectedDay === day;
                                
                                return (
                                    <Button
                                        key={day}
                                        variant={isSelected ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                                        className="flex flex-col h-auto py-2"
                                    >
                                        <span className="text-xs font-medium">{day.slice(0, 3)}</span>
                                        <span className="text-xs opacity-75">
                                            {availableDaySlots.length}/{daySlots.length} slots
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Slot Selection for Selected Day */}
                    {selectedDay && (
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <h6 className="text-sm font-medium text-gray-700">
                                    Available Slots for {selectedDay}
                                </h6>
                                <div className="flex space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleAllSlots(selectedDay)}
                                    >
                                        {(generatedSlots[selectedDay] || []).length > 0 && (availableSlots[selectedDay] || []).length === (generatedSlots[selectedDay] || []).length 
                                            ? 'Deselect All' 
                                            : 'Select All'
                                        }
                                    </Button>
                                </div>
                            </div>
                            
                            {(generatedSlots[selectedDay] || []).length === 0 ? (
                                <div className="text-center text-gray-500 text-sm py-4">
                                    No slots generated for {selectedDay}
                                </div>
                            ) : (
                                <>
                                    {/* Available Slots Section */}
                                    <div className="space-y-2">
                                        <h6 className="text-xs font-medium text-gray-700 uppercase tracking-wide">Available Slots</h6>
                                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                                            {(availableSlots[selectedDay] || []).length === 0 ? (
                                                <div className="col-span-full text-center text-gray-400 text-xs py-2">
                                                    No available slots for {selectedDay}
                                                </div>
                                            ) : (
                                                (availableSlots[selectedDay] || []).map(slot => (
                                                    <Button
                                                        key={slot}
                                                        variant="default"
                                                        size="sm"
                                                        onClick={() => toggleSlot(selectedDay, slot)}
                                                        className="text-xs h-8 transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90 border-primary shadow-sm"
                                                        title="Click to disable this slot"
                                                    >
                                                        {formatTime(slot)}
                                                        <span className="ml-1 text-xs opacity-75">✓</span>
                                                    </Button>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* FIXED: Always show disabled slots section for better UX */}
                                    <div className="space-y-2 border-t pt-3">
                                        <h6 className="text-xs font-medium text-gray-700 uppercase tracking-wide">Disabled Slots</h6>
                                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                                            {(disabledSlots[selectedDay] || []).length === 0 ? (
                                                <div className="col-span-full text-center text-gray-400 text-xs py-2">
                                                    No disabled slots for {selectedDay}
                                                </div>
                                            ) : (
                                                (disabledSlots[selectedDay] || []).map(slot => (
                                                    <Button
                                                        key={slot}
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => toggleSlot(selectedDay, slot)}
                                                        className="text-xs h-8 transition-all duration-200 border-2 border-dashed border-gray-300 text-gray-600 bg-gray-50 hover:border-primary hover:text-primary hover:bg-primary/5 hover:shadow-sm"
                                                        title="Click to enable this slot"
                                                    >
                                                        {formatTime(slot)}
                                                        <span className="ml-1 text-xs opacity-75">✗</span>
                                                    </Button>
                                                ))
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 bg-red-50 border border-red-200 rounded p-2">
                                            <strong>Disabled:</strong> {(disabledSlots[selectedDay] || []).length === 0 
                                                ? 'All slots are currently available for booking.' 
                                                : `These ${(disabledSlots[selectedDay] || []).length} slot(s) are hidden from patients. Click any slot above to re-enable it.`
                                            }
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {(generatedSlots[selectedDay] || []).length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs text-gray-600 bg-green-50 border border-green-200 rounded p-2">
                                        <strong>Selected:</strong> {(availableSlots[selectedDay] || []).length} out of {(generatedSlots[selectedDay] || []).length} slots will be available for patients to book on {selectedDay}.
                                    </div>
                                    
                                    <div className="flex items-center justify-center gap-6 text-xs text-gray-500 py-2 border-t">
                                        <div className="flex items-center gap-1">
                                            <div className="w-4 h-4 bg-primary rounded border border-primary shadow-sm flex items-center justify-center">
                                                <span className="text-white text-xs">✓</span>
                                            </div>
                                            <span>Available for booking</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-4 h-4 bg-gray-50 rounded border-2 border-dashed border-gray-300"></div>
                                            <span>Disabled (click to enable)</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                // Display mode - show current availability
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-1">
                        <h5 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">Contact</h5>
                        <div className="space-y-1 text-xs">
                            {location.phone_number && (
                                <div className="flex items-center text-gray-600">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {location.phone_number}
                                </div>
                            )}
                            {location.email_address && (
                                <div className="flex items-center text-gray-600">
                                    <Mail className="w-3 h-3 mr-1" />
                                    {location.email_address}
                                </div>
                            )}
                            <div className="flex items-center text-gray-600">
                                <Clock className="w-3 h-3 mr-1" />
                                {location.timezone}
                            </div>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-4">
                        <h5 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">Weekly Schedule</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                            {daysOfWeek.map((day: string) => {
                                const daySlots = location.availability[day] || [];
                                return (
                                    <div key={day} className="bg-white rounded-md p-2 border border-gray-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium text-gray-700 text-xs">{day.slice(0, 3)}</span>
                                            <Badge variant={daySlots.length > 0 ? "default" : "secondary"} className="text-xs px-1 py-0">
                                                {daySlots.length}
                                            </Badge>
                                        </div>
                                        <div className="space-y-1">
                                            {daySlots.length > 0 ? (
                                                daySlots.slice(0, 2).map((slot: any, idx: number) => (
                                                    <div key={idx} className="text-xs text-gray-600 bg-gray-50 rounded px-1 py-0.5">
                                                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Off</span>
                                            )}
                                            {daySlots.length > 2 && (
                                                <div className="text-xs text-primary font-medium">
                                                    +{daySlots.length - 2} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
// Available Days Section Component
interface AvailableDaysSectionProps {
    clinic: Clinic;
    practitioner: Practitioner;
    tenancy?: any;
}

const DAYS_OF_WEEK = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
];

function AvailableDaysSection({ clinic, practitioner, tenancy }: AvailableDaysSectionProps) {
    const [availableDays, setAvailableDays] = useState<string[]>([]);
    const [defaultDaysFromAvailability, setDefaultDaysFromAvailability] = useState<string[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load current settings when component mounts
    useEffect(() => {
        const loadAvailableDays = async () => {
            try {
                // Check if we're in central context
                const isCentral = tenancy?.is_central;
                const routeName = isCentral 
                    ? 'central.my-details.available-days.get' 
                    : 'my-details.available-days.get';
                
                const response = await fetch(route(routeName), {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setAvailableDays(data.available_days || []);
                    setDefaultDaysFromAvailability(data.default_days_from_availability || []);
                }
            } catch (error) {
                console.error('Error loading available days:', error);
            }
        };

        loadAvailableDays();
    }, []);

    const toggleAvailableDay = (day: string) => {
        if (availableDays.includes(day)) {
            setAvailableDays(availableDays.filter(d => d !== day));
        } else {
            setAvailableDays([...availableDays, day]);
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            // Check if we're in central context
            const isCentral = tenancy?.is_central;
            const routeName = isCentral 
                ? 'central.my-details.available-days.update' 
                : 'my-details.available-days.update';
            
            await router.post(route(routeName), {
                available_days: availableDays,
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsEditing(false);
                },
            });
        } catch (error) {
            console.error('Error updating available days:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                Available Days at {clinic.tenant_name}
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                        Set which days you're available to work at this clinic. This affects appointment booking in the public portal.
                    </p>
                    {!isEditing && (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                        </Button>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {DAYS_OF_WEEK.map((day) => (
                                <div key={day.value} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`${clinic.tenant_id}-${day.value}`}
                                        checked={availableDays.includes(day.value)}
                                        onChange={() => toggleAvailableDay(day.value)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <Label
                                        htmlFor={`${clinic.tenant_id}-${day.value}`}
                                        className={`text-sm font-medium cursor-pointer ${
                                            availableDays.includes(day.value) 
                                                ? 'text-blue-600' 
                                                : 'text-gray-700'
                                        }`}
                                    >
                                        {day.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        
                        {availableDays.length === 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center space-x-2">
                                    <AlertCircle className="h-4 w-4 text-blue-500" />
                                    <div className="text-sm text-blue-700">
                                        <p><strong>Default:</strong> No specific days selected</p>
                                        {defaultDaysFromAvailability.length > 0 ? (
                                            <p className="mt-1">
                                                Using days from your practitioner availability: {defaultDaysFromAvailability.map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label).join(', ')}
                                            </p>
                                        ) : (
                                            <p className="mt-1">Available all days (no practitioner availability set)</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {availableDays.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center space-x-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <p className="text-sm text-green-700">
                                        <strong>Selected:</strong> Available on {availableDays.map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label).join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
                                <Save className="w-3 h-3 mr-1" />
                                {isSubmitting ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                            {DAYS_OF_WEEK.map((day) => {
                                let isAvailable = false;
                                
                                if (availableDays.length > 0) {
                                    // Specific days are set
                                    isAvailable = availableDays.includes(day.value);
                                } else if (defaultDaysFromAvailability.length > 0) {
                                    // Use days from practitioner availability
                                    isAvailable = defaultDaysFromAvailability.includes(day.value);
                                } else {
                                    // No restrictions, available all days
                                    isAvailable = true;
                                }
                                
                                return (
                                    <div key={day.value} className={`text-center p-2 rounded border ${
                                        isAvailable 
                                            ? 'bg-green-100 border-green-300 text-green-800' 
                                            : 'bg-gray-100 border-gray-300 text-gray-500'
                                    }`}>
                                        <div className="text-xs font-medium">{day.label.slice(0, 3)}</div>
                                        <div className="text-xs">
                                            {isAvailable ? '✓' : '✗'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {availableDays.length === 0 && (
                            <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                                {defaultDaysFromAvailability.length > 0 ? (
                                    <span>
                                        <strong>Using default from practitioner availability:</strong> {defaultDaysFromAvailability.map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label).join(', ')}
                                    </span>
                                ) : (
                                    <span><strong>Default:</strong> Available all days (no specific restrictions)</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
import CalendarBooking from '@/components/CalendarBooking';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { withAppLayout } from '@/utils/layout';
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Info, Search, Users, X, Settings, Clock, AlertTriangle, Calendar, AlertCircle } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useEnhancedZodValidation } from '@/hooks/useEnhancedZodValidation';
import { appointmentSchema } from '@/lib/validations';
import { PhoneInput } from '@/components/phone-input';
import { usePatientSearch } from '@/hooks/usePatientSearch';

interface Service {
    id: number;
    name: string;
    service_type: string;
    category: string;
    delivery_modes: string[];
    default_duration_minutes: number;
}

interface Practitioner {
    id: number;
    name: string;
    label: string;
}

interface Location {
    id: number;
    name: string;
    label: string;
    address_line_1: string;
    city: string;
    country: string;
}

interface PractitionerAvailability {
    start_time: string;
    end_time: string;
}

interface SlotDivision {
    practitionerId: number;
    practitionerName: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isEntireSlot: boolean; // Flag to indicate if practitioner is there for entire slot
}

interface CalendarConflict {
    practitionerId: number;
    practitionerName: string;
    conflictingEvents: {
        title: string;
        startTime: string;
        endTime: string;
    }[];
}

interface Props {
    serviceTypes: string[];
    allServices: Service[];
    allPractitioners: Practitioner[];
    practitionerServiceRelations: Record<number, number[]>;
    practitionersCalendarStatus: Record<number, boolean>;
    locations: Location[];
    currentTab: string;
    appointmentSessionDuration: number;
    appointmentSettings: {
        advanceBookingHours: string;
        maxAdvanceBookingDays: string;
        allowSameDayBooking: boolean;
    };
    formData?: {
        // Client Information  
        health_number?: string;
        first_name?: string;
        middle_name?: string;
        last_name?: string;
        preferred_name?: string;
        date_of_birth?: string;
        gender?: string;
        gender_pronouns?: string;
        phone_number?: string;
        email_address?: string;
        emergency_contact_name?: string;
        emergency_contact_phone?: string;
        contact_person?: string;
        booking_source?: string;
        preferred_language?: string;
        client_type?: string;
        admin_override?: string;
        
        // Appointment Details
        service_type: string;
        service_name: string;
        service_id: string;
        practitioner_ids: number[];  // Changed back to support multiple practitioners
        primary_practitioner_id?: string;  // Primary practitioner
        location_id: string;
        mode: string;
        date_time_preference: string;
        
        
        // Advanced Appointment Settings
        advanced_appointment_settings: boolean;  // Restored advanced mode
        slot_divisions: string;  // JSON string of SlotDivision[]
    };
    errors?: Record<string, string[]>;
    flash?: {
        success?: string;
        error?: string;
    };
}

function CreateAppointment({
    serviceTypes,
    allServices,
    allPractitioners,
    practitionerServiceRelations,
    practitionersCalendarStatus,
    locations,
    currentTab,
    formData,
    errors = {},
    flash,
    appointmentSessionDuration,
    appointmentSettings,
}: Props) {
    const [activeTab, setActiveTab] = useState(currentTab || 'client-info');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const { validate, validateFieldOnBlur, clearFieldError: clearFieldErrorTyped, getFieldError: getZodFieldError } = useEnhancedZodValidation(appointmentSchema);

    // Cast clearFieldError to any to avoid TypeScript issues
    const clearFieldError = clearFieldErrorTyped as any;

    // Patient search for auto-fill functionality
    const {
        searching,
        foundPatient,
        multipleMatches,
        searchMethod,
        hasConflict,
        conflictingPatient,
        clearFoundPatient,
        searchByHealthNumber,
        searchByEmail,
        searchByName,
        selectFromMultiple
    } = usePatientSearch();

    // Tab to field mapping for validation
    const tabFieldMapping = {
        'client-info': [
            'health_number', 'first_name', 'middle_name', 'last_name', 'preferred_name',
            'date_of_birth', 'gender', 'gender_pronouns', 'phone_number', 'email_address',
            'emergency_contact_name', 'emergency_contact_phone', 'contact_person',
            'booking_source', 'preferred_language', 'client_type', 'admin_override'
        ],
        'appointment-details': [
            'service_type', 'service_name', 'service_id', 'practitioner_ids',
            'location_id', 'mode', 'date_time_preference', 'advanced_appointment_settings',
            'slot_divisions'
        ]
    };

    // Helper to get error message for a field (combines zod and backend errors)
    const getFieldError = (fieldName: string): string | undefined => {
        return getZodFieldError(fieldName) || (errors)[fieldName]?.[0];
    };

    // Helper function to capitalize names automatically
    const capitalizeName = (value: string): string => {
        if (!value.trim()) return value;
        return value.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // Helper function to handle field changes with automatic capitalization for name fields
    const handleFieldChange = (fieldName: string, value: string) => {
        let processedValue = value;

        // Apply automatic capitalization for name fields
        if (['first_name', 'last_name', 'preferred_name', 'middle_name'].includes(fieldName)) {
            // Remove numbers and special characters except spaces, hyphens, and apostrophes
            processedValue = value.replace(/[^A-Za-z\s\-\']/g, '');
            processedValue = capitalizeName(processedValue);
        }

        setData(fieldName, processedValue);

        // Clear field error when user starts typing
        if (getFieldError(fieldName)) {
            clearFieldError(fieldName);
        }

        // Trigger patient search by name when both first_name and last_name are filled
        if (fieldName === 'first_name' || fieldName === 'last_name') {
            const firstName = fieldName === 'first_name' ? processedValue : data.first_name;
            const lastName = fieldName === 'last_name' ? processedValue : data.last_name;

            if (firstName && lastName) {
                searchByName(firstName, lastName);
            }
        }
    };

    // Helper function to handle onBlur validation
    const handleFieldBlur = (fieldName: string, value: string) => {
        validateFieldOnBlur(fieldName, value);
    };

    // State for multiple matches selection
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

    // Handle auto-fill from found patient
    const handleAutoFill = () => {
        if (!foundPatient) return;

        // Auto-fill all basic info fields
        setData('health_number', foundPatient.health_number || '');
        setData('first_name', foundPatient.first_name || '');
        setData('middle_name', foundPatient.middle_name || '');
        setData('last_name', foundPatient.last_name || '');
        setData('preferred_name', foundPatient.preferred_name || '');
        setData('date_of_birth', foundPatient.date_of_birth || '');
        setData('gender', foundPatient.gender || '');
        setData('gender_pronouns', foundPatient.gender_pronouns || '');
        setData('phone_number', foundPatient.phone_number || '');
        setData('email_address', foundPatient.email || '');
        setData('emergency_contact_name', foundPatient.emergency_contact_name || '');
        setData('emergency_contact_phone', foundPatient.emergency_contact_phone || '');
        setData('contact_person', foundPatient.contact_person || '');
        setData('preferred_language', foundPatient.preferred_language || '');
        setData('client_type', foundPatient.client_type || '');

        // Clear the found patient alert
        clearFoundPatient();
        setSelectedPatientId(null);

        // Show success toast
        toast.success('Patient information loaded successfully');
    };

    // Handle selection from multiple matches
    const handleSelectPatient = async () => {
        if (!selectedPatientId) return;

        await selectFromMultiple(selectedPatientId);
        setSelectedPatientId(null);
    };


    // Success state for appointment creation
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // New states for advanced appointment settings
    const [selectedPractitioners, setSelectedPractitioners] = useState<Practitioner[]>([]);
    const [showSlotDivisionModal, setShowSlotDivisionModal] = useState(false);
    const [selectedSlotForDivision, setSelectedSlotForDivision] = useState<{date: string, time: string} | null>(null);
    const [slotDivisions, setSlotDivisions] = useState<SlotDivision[]>([]);
    
    // Calendar conflict state
    const [calendarConflicts, setCalendarConflicts] = useState<CalendarConflict[]>([]);
    const [showConflictWarning, setShowConflictWarning] = useState(false);
    const [checkingConflicts, setCheckingConflicts] = useState(false);
    const [calendarConnectionStatus, setCalendarConnectionStatus] = useState<boolean | null>(null); // null = unknown, true = connected, false = disconnected

    // Sync activeTab with prop changes
    useEffect(() => {
        if (currentTab) {
            setActiveTab(currentTab);
        }
    }, [currentTab]);

    // Reset form to first step on page load if no data exists
    useEffect(() => {
        if (!formData || Object.keys(formData).length === 0) {
            setActiveTab('client-info');
        }
    }, []);

    // Local state for filtered data (client-side filtering)
    const [filteredServices, setFilteredServices] = useState<Service[]>([]);
    const [filteredPractitioners, setFilteredPractitioners] = useState<Practitioner[]>([]);
    const [filteredModeOptions, setFilteredModeOptions] = useState<{ value: string; label: string }[]>([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [loadingPractitioners, setLoadingPractitioners] = useState(false);
    const [practitionerAvailability, setPractitionerAvailability] = useState<Record<string, { start_time: string; end_time: string }[]>>({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Navigation loading states
    const [navigatingToAppointmentDetails, setNavigatingToAppointmentDetails] = useState(false);
    const [navigatingToPrevious, setNavigatingToPrevious] = useState(false);

    // Initialize form with server data - removed explicit typing to avoid constraint issues
    const { data, setData: setDataTyped, post, processing, clearErrors: clearErrorsTyped, setError  } = useForm({
        // Client Information
        health_number: formData?.health_number || '',
        first_name: formData?.first_name || '',
        middle_name: formData?.middle_name || '',
        last_name: formData?.last_name || '',
        preferred_name: formData?.preferred_name || '',
        date_of_birth: formData?.date_of_birth || '',
        gender: formData?.gender || '',
        gender_pronouns: formData?.gender_pronouns || '',
        phone_number: formData?.phone_number || '',
        email_address: formData?.email_address || '',
        emergency_contact_name: formData?.emergency_contact_name || '',
        emergency_contact_phone: formData?.emergency_contact_phone || '',
        contact_person: formData?.contact_person || '',
        booking_source: formData?.booking_source || 'Public Portal',
        preferred_language: formData?.preferred_language || '',
        client_type: formData?.client_type || '',
        admin_override: formData?.admin_override || '',
        
        // Appointment Details
        service_type: formData?.service_type || '',
        service_name: formData?.service_name || '',
        service_id: formData?.service_id || '',
        practitioner_ids: formData?.practitioner_ids || [],
        primary_practitioner_id: formData?.primary_practitioner_id || '', // Primary practitioner
        location_id: formData?.location_id || '',
        mode: formData?.mode || '',
        date_time_preference: formData?.date_time_preference || '',
        
        
        // Advanced Appointment Settings
        advanced_appointment_settings: formData?.advanced_appointment_settings ?? false,
        slot_divisions: JSON.stringify(formData?.slot_divisions || []),
    } as any);

    // Cast setData to any to avoid TypeScript issues
    const setData = setDataTyped as any;
    const clearErrors = clearErrorsTyped as any;


    // Initialize selectedPractitioners based on form data on component mount
    useEffect(() => {
        if (data.practitioner_ids && data.practitioner_ids.length > 0 && allPractitioners && allPractitioners.length > 0) {
            const practitioners = allPractitioners.filter(p => data.practitioner_ids.includes(p.id));
            setSelectedPractitioners(practitioners);
        }
    }, [data.practitioner_ids, allPractitioners]);


    // Add practitioner to selection
    const addPractitioner = (practitionerId: string) => {
        const practitioner = filteredPractitioners.find(p => p.id.toString() === practitionerId);
        if (practitioner && !data.practitioner_ids.includes(practitioner.id)) {
            const newPractitionerIds = [...data.practitioner_ids, practitioner.id];
            const newSelectedPractitioners = [...selectedPractitioners, practitioner];
            
            setData('practitioner_ids', newPractitionerIds);
            setSelectedPractitioners(newSelectedPractitioners);
            
            // Auto-select as primary if it's the only practitioner
            if (newPractitionerIds.length === 1) {
                setData('primary_practitioner_id', practitioner.id);
            }
            
            // Clear date time preference and conflicts when practitioners change
            setData('date_time_preference', '');
            setCalendarConflicts([]);
            setShowConflictWarning(false);
            
            // Clear validation errors when user makes a selection
            if (getFieldError('practitioner_ids')) {
                clearFieldError('practitioner_ids');
            }
            if (getFieldError('primary_practitioner_id')) {
                clearFieldError('primary_practitioner_id');
            }
            
            console.log('[Practitioner] Added:', { 
                name: practitioner.label, 
                id: practitioner.id, 
                newPractitionerIds, 
                total: newPractitionerIds.length 
            });
        }
    };

    // Remove practitioner from selection
    const removePractitioner = (practitionerId: number) => {
        const newPractitionerIds = data.practitioner_ids.filter((id: number) => id !== practitionerId);
        const newSelectedPractitioners = selectedPractitioners.filter(p => p.id !== practitionerId);
        
        console.log('[Practitioner] Removing:', { practitionerId, newPractitionerIds, remaining: newPractitionerIds.length });
        setData('practitioner_ids', newPractitionerIds);
        setSelectedPractitioners(newSelectedPractitioners);
        
        // If removed practitioner was the primary, clear or set new primary
        if (data.primary_practitioner_id === practitionerId) {
            if (newPractitionerIds.length === 1) {
                // Auto-select the remaining practitioner as primary
                setData('primary_practitioner_id', newPractitionerIds[0]);
            } else {
                // Clear primary practitioner
                setData('primary_practitioner_id', '');
            }
        }
        
        // Clear date time preference and conflicts when practitioners change
        setData('date_time_preference', '');
        setCalendarConflicts([]);
        setShowConflictWarning(false);
        
        // Clear validation errors when user removes a practitioner
        if (getFieldError('practitioner_ids')) {
            clearFieldError('practitioner_ids');
        }
        if (getFieldError('primary_practitioner_id')) {
            clearFieldError('primary_practitioner_id');
        }
        
        console.log('🎯 Removed practitioner:', practitionerId, 'Total practitioners:', newPractitionerIds.length);
    };

    // Handle slot division modal
    const handleSlotClick = (date: string, time: string) => {
        if (data.advanced_appointment_settings && selectedPractitioners.length > 1) {
            setSelectedSlotForDivision({ date, time });
            
            // Initialize slot divisions for all practitioners with default duration
            const slotStartTime = time;
            const [slotHours, slotMinutes] = slotStartTime.split(':').map(Number);
            const slotEndMinutes = slotHours * 60 + slotMinutes + appointmentSessionDuration;
            const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
            
            const initialDivisions: SlotDivision[] = selectedPractitioners.map(practitioner => ({
                practitionerId: practitioner.id,
                practitionerName: practitioner.label,
                startTime: slotStartTime,
                endTime: slotEndTime,
                durationMinutes: appointmentSessionDuration, // Set default duration equal to slot duration
                isEntireSlot: true
            }));
            
            setSlotDivisions(initialDivisions);
            setShowSlotDivisionModal(true);
        } else {
            // Normal slot selection for standard booking
            const dateTime = `${date} ${time}`;
            setData('date_time_preference', dateTime);
        }
    };

    // Check for Google Calendar conflicts
    const checkCalendarConflicts = async (dateTime: string) => {
        if (!data.practitioner_ids.length || !dateTime) return;
        
        // Skip if we already know the calendar is not connected
        if (calendarConnectionStatus === false) {
            console.log('⏭️ Skipping calendar conflict check - calendar not connected');
            return;
        }
        
        setCheckingConflicts(true);
        setCalendarConflicts([]);
        setShowConflictWarning(false);
        
        try {
            const response = await axios.post('/api/check-calendar-conflicts', {
                practitioner_ids: data.practitioner_ids,
                datetime: dateTime,
                duration_minutes: appointmentSessionDuration
            });
            
            // Cache the calendar connection status
            setCalendarConnectionStatus(response.data.is_connected);
            
            // Only show conflicts if Google Calendar is properly configured and there are actual conflicts
            if (response.data.is_connected && response.data.conflicts && response.data.conflicts.length > 0) {
                setCalendarConflicts(response.data.conflicts);
                setShowConflictWarning(true);
            }
            // If Google Calendar is not configured or conflicts are disabled, don't show any warning
        } catch (error) {
            console.error('Error checking calendar conflicts:', error);
            // On error, assume calendar is not connected to prevent further unnecessary checks
            setCalendarConnectionStatus(false);
        } finally {
            setCheckingConflicts(false);
        }
    };


    // State for existing appointments
    const [existingAppointments, setExistingAppointments] = useState<Array<{datetime: string; date: string; time: string; appointment_id?: string; status?: string; mode?: string; location_id?: number; duration?: number}>>([]);

    // Fetch practitioner availability when practitioner_ids, location_id, or mode changes
    useEffect(() => {
        const fetchPractitionerAvailability = async () => {
            const { practitioner_ids, location_id, mode } = data;

            console.log('[Availability] Dependencies changed:', {
                practitioner_ids,
                location_id,
                mode,
                hasPractitioners: practitioner_ids?.length > 0,
                hasLocation: location_id,
                condition: practitioner_ids.length > 0 && (mode === 'virtual' || (mode === 'in-person' && location_id))
            });

            if (practitioner_ids.length > 0 && (mode === 'virtual' || (mode === 'in-person' && location_id))) {
                console.log('[Availability] Fetching availability...');
                setLoadingAvailability(true);
                try {
                    const response = await fetch(route('appointments.practitionerAvailability'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                        },
                        body: JSON.stringify({
                            practitioner_ids: practitioner_ids, // Send array of practitioner IDs
                            location_id: mode === 'in-person' ? location_id : null,
                            mode,
                        }),
                    });

                    const responseData = await response.json();

                    console.log('[Availability] Response received:', { 
                        ok: response.ok, 
                        status: response.status,
                        hasAvailability: !!responseData.availability,
                        availabilityKeys: responseData.availability ? Object.keys(responseData.availability) : []
                    });

                    if (response.ok && responseData.availability) {
                        setPractitionerAvailability(responseData.availability);
                        setExistingAppointments(responseData.existingAppointments || []);
                        console.log('[Availability] Success! Fetched practitioner availability:', responseData.availability);
                        console.log('[Availability] Existing appointments:', responseData.existingAppointments);
                    } else {
                        console.log('[Availability] Failed:', responseData.error || 'No availability data');
                        setPractitionerAvailability({});
                        setExistingAppointments([]);
                        toast.error(responseData.error || 'Failed to fetch practitioner availability');
                    }
                } catch (error) {
                    console.error('[Availability] Error fetching:', error);
                    setPractitionerAvailability({});
                    setExistingAppointments([]);
                    toast.error('Failed to fetch practitioner availability');
                } finally {
                    setLoadingAvailability(false);
                }
            } else {
                console.log('[Availability] Conditions not met, clearing availability');
                setPractitionerAvailability({});
                setExistingAppointments([]);
            }
        };

        fetchPractitionerAvailability();
    }, [data.practitioner_ids, data.location_id, data.mode]);

    // Initialize filtered data based on current form state
    useEffect(() => {
        if (data.service_type && allServices && allServices.length > 0) {
            const services = allServices.filter((service) => service.category === data.service_type);
            setFilteredServices(services);

            // If service_name is also set, update mode options
            if (data.service_name) {
                const selectedService = services.find((s) => s.name === data.service_name);
                if (selectedService) {
                    const allModeOptions = [
                        { value: 'in-person', label: 'In-person' },
                        { value: 'virtual', label: 'Virtual' },
                        { value: 'hybrid', label: 'Hybrid' },
                    ];

                    const availableModes = allModeOptions.filter((mode) => selectedService.delivery_modes.includes(mode.value));
                    setFilteredModeOptions(availableModes);
                }
            }
        }

        if (data.service_id && allPractitioners && allPractitioners.length > 0) {
            const serviceId = parseInt(data.service_id);
            const practitioners = allPractitioners.filter((practitioner) => {
                const serviceIds = practitionerServiceRelations[practitioner.id] || [];
                return serviceIds.includes(serviceId);
            });
            setFilteredPractitioners(practitioners);
        }
    }, [data.service_type, data.service_id, data.service_name, allServices, allPractitioners, practitionerServiceRelations]);

    // Check if client info tab is complete (synchronous - for tab navigation)
  // Check if client info tab is complete (synchronous - for tab navigation)
    const isClientInfoComplete = () => {
        const requiredFields = [
            'first_name',
            'last_name',
            'phone_number',
            'email_address',
            'gender_pronouns',
            'client_type',
            'date_of_birth',
            'emergency_contact_phone',
        ];

        // Check if all required fields have values
        const allFieldsFilled = requiredFields.every((field) => {
            const value = data[field as keyof typeof data];
            return value && String(value).trim() !== '';
        });

        if (!allFieldsFilled) return false;

        // Validate client info fields through Zod schema
        const clientInfoFields = tabFieldMapping['client-info'];
        const clientInfoData = Object.fromEntries(
            clientInfoFields.map(field => [field, data[field as keyof typeof data]])
        );

        // Use Zod validation to check if fields are valid
        const validationResult = appointmentSchema.pick(
            Object.fromEntries(clientInfoFields.map(f => [f, true]))
        ).safeParse(clientInfoData);

        // Also check for any existing validation errors from backend or Zod
        const hasValidationErrors = clientInfoFields.some(field => getFieldError(field));

        return validationResult.success && !hasValidationErrors;
    };

    // Validate client info tab
    const validateClientInfo = async () => {
        let isValid = true;

        // Check required fields
        if (!isClientInfoComplete()) {
            isValid = false;
        }

        return { isValid };
    };

    // Validate appointment details tab
    const validateAppointmentDetails = () => {
        // Check practitioner_ids separately (it's an array)
        const hasPractitioners = Array.isArray(data.practitioner_ids) && data.practitioner_ids.length > 0;
        
        // Check primary practitioner is selected
        const hasPrimaryPractitioner = data.primary_practitioner_id && String(data.primary_practitioner_id).trim() !== '';

        // Check other required string fields
        const requiredStringFields = [
            'service_type',
            'service_name',
            'service_id',
            'mode',
            'date_time_preference',
            'booking_source',
            'admin_override',
        ];

        const stringFieldsValid = requiredStringFields.every((field) => {
            const value = data[field as keyof typeof data];
            return value && String(value).trim() !== '';
        });

        // Check location requirement based on mode
        const locationValid = data.mode === 'virtual' || data.mode === 'hybrid'
            ? true // Location not required for virtual/hybrid
            : data.location_id && String(data.location_id).trim() !== ''; // Location required for in-person

        return hasPractitioners && hasPrimaryPractitioner && stringFieldsValid && locationValid;
    };

    // Check which tabs are accessible based on completion
    const clientInfoComplete = isClientInfoComplete() && !getFieldError('health_number');
    const isAppointmentDetailsComplete = validateAppointmentDetails();

    // Determine if a tab is accessible
    const isTabAccessible = (tabValue: string) => {
        switch (tabValue) {
            case 'client-info':
                return true; // Always accessible
            case 'appointment-details':
                return clientInfoComplete; // Only if client info is complete AND no health card errors
            default:
                return false;
        }
    };

    // Navigate to a specific tab using router.post to store form data in session
    const navigateToTab = (targetTab: string, setLoadingState?: (loading: boolean) => void) => {
        if (setLoadingState) {
            setLoadingState(true);
        }

        router.post(
            route('appointments.create.store'),
            {
                tab: targetTab,
                // Include all current form data
                ...data,
            },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    console.log(`Navigated to tab: ${targetTab}`);
                    if (setLoadingState) {
                        setLoadingState(false);
                    }
                },
                onError: (errors) => {
                    console.error('Navigation error:', errors);
                    if (setLoadingState) {
                        setLoadingState(false);
                    }
                },
            },
        );
    };

    // Handle service type selection (client-side filtering)
    const handleServiceTypeChange = (serviceType: string) => {
        setData('service_type', serviceType);
        setData('service_name', ''); // Reset dependent fields
        setData('service_id', '');
        setData('practitioner_ids', []);
        setData('mode', ''); // Reset mode when service type changes
        setData('location_id', ''); // Reset location when service type changes
        setData('date_time_preference', ''); // Reset date and time preference
        setFilteredPractitioners([]); // Clear practitioners
        setFilteredModeOptions([]); // Clear mode options

        // Clear validation errors when user makes a selection
        if (getFieldError('service_type')) {
            clearFieldError('service_type');
        }

        // Trigger validation immediately after selection
        setTimeout(() => {
            validateFieldOnBlur('service_type', serviceType);
        }, 0);

        if (serviceType) {
            setLoadingServices(true);

            // Simulate brief loading for UX (client-side filtering is instant)
            setTimeout(() => {
                const services = allServices && allServices.length > 0 ? allServices.filter((service) => service.category === serviceType) : [];
                setFilteredServices(services);
                setLoadingServices(false);
                console.log('Services filtered for type:', serviceType);
            }, 100); // Very brief loading simulation
        } else {
            setFilteredServices([]);
        }
    };

    // Handle service type validation on blur
    const handleServiceTypeBlur = (value: string) => {
        console.log('VALIDATING')
        validateFieldOnBlur('service_type', value);
    };

    // Handle service name selection (client-side filtering)
    const handleServiceNameChange = (serviceName: string) => {
        const selectedService = filteredServices.find((s) => s.name === serviceName);

        setData('service_name', serviceName);
        setData('service_id', selectedService?.id.toString() || '');
        setData('practitioner_ids', []); // Reset practitioner
        setData('mode', ''); // Reset mode when service changes
        setData('location_id', ''); // Reset location when service changes
        setData('date_time_preference', ''); // Reset date and time preference

        // Clear validation errors when user makes a selection
        if (getFieldError('service_name')) {
            clearFieldError('service_name');
        }
        if (getFieldError('service_id')) {
            clearFieldError('service_id');
        }

        // Trigger validation immediately after selection
        setTimeout(() => {
            validateFieldOnBlur('service_name', serviceName);
            if (selectedService) {
                validateFieldOnBlur('service_id', selectedService.id.toString());
            }
        }, 0);

        if (selectedService) {
            setLoadingPractitioners(true);

            // Update mode options based on service delivery modes
            const allModeOptions = [
                { value: 'in-person', label: 'In-person' },
                { value: 'virtual', label: 'Virtual' },
                { value: 'hybrid', label: 'Hybrid' },
            ];

            const availableModes = allModeOptions.filter((mode) => selectedService.delivery_modes.includes(mode.value));
            setFilteredModeOptions(availableModes);

            // Simulate brief loading for UX (client-side filtering is instant)
            setTimeout(() => {
                const serviceId = selectedService.id;
                const practitioners = allPractitioners && allPractitioners.length > 0 ? allPractitioners.filter((practitioner) => {
                    const serviceIds = practitionerServiceRelations[practitioner.id] || [];
                    return serviceIds.includes(serviceId);
                }) : [];
                setFilteredPractitioners(practitioners);
                setLoadingPractitioners(false);
                console.log('Practitioners filtered for service:', serviceId);
                console.log('Mode options filtered for service:', availableModes);
            }, 100); // Very brief loading simulation
        } else {
            setFilteredPractitioners([]);
            setFilteredModeOptions([]);
        }
    };

    // Handle service name validation on blur
    const handleServiceNameBlur = (value: string) => {
        validateFieldOnBlur('service_name', value);
    };

    // Handle mode validation on blur
    const handleModeBlur = (value: string) => {
        validateFieldOnBlur('mode', value);
    };

    // Handle location validation on blur
    const handleLocationBlur = (value: string) => {
        validateFieldOnBlur('location_id', value);
    };

    // Handle primary practitioner validation on blur
    const handlePrimaryPractitionerBlur = (value: string) => {
        validateFieldOnBlur('primary_practitioner_id', value);
    };

    // Handle booking source validation on blur
    const handleBookingSourceBlur = (value: string) => {
        validateFieldOnBlur('booking_source', value);
    };

    // Handle admin override validation on blur
    const handleAdminOverrideBlur = (value: string) => {
        validateFieldOnBlur('admin_override', value);
    };

    // Handle next button for client info tab
    const handleClientInfoNext = async () => {
        const { isValid } = await validateClientInfo();

        if (!isValid) {
            toast.error('Please fill in all required fields before proceeding.');
            return;
        }
        navigateToTab('appointment-details', setNavigatingToAppointmentDetails);
    };

    // Handle save button for appointment details tab
    const handleAppointmentDetailsSave = async () => {
        if (!validateAppointmentDetails()) {
            toast.error('Please fill in all required appointment details before proceeding.');
            return;
        }
        
        // Submit the form directly
        await handleSubmit(new Event('submit') as any);
    };

    // Handle previous button navigation
    const handlePrevious = (targetTab: string) => {
        navigateToTab(targetTab, setNavigatingToPrevious);
    };

    // Reset form to initial state
    const resetForm = () => {
        // Reset form data
        setDataTyped({
            // Client Information
            health_number: '',
            first_name: '',
            middle_name: '',
            last_name: '',
            preferred_name: '',
            date_of_birth: '',
            gender: '',
            gender_pronouns: '',
            phone_number: '',
            email_address: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
            contact_person: '',
            booking_source: 'Public Portal',
            preferred_language: '',
            client_type: '',
            admin_override: '',

            // Appointment Details
            service_type: '',
            service_name: '',
            service_id: '',
            practitioner_ids: [],
            primary_practitioner_id: '',
            location_id: '',
            mode: '',
            date_time_preference: '',


            // Advanced Appointment Settings
            advanced_appointment_settings: false,
            slot_divisions: '[]',
        });

        // Reset filtered data
        setFilteredServices([]);
        setFilteredPractitioners([]);
        setFilteredModeOptions([]);

        // Navigate back to first tab
        setActiveTab('client-info');
    };

    // Handle final form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Skip Zod validation - it fails on partial data and optional fields
        // Rely on validateClientInfo() and validateAppointmentDetails() checks
        // Backend will perform final validation
        console.log('[Appointment Form] Submitting form - backend will validate');

        setValidationErrors({});

        // Final validation - must be comprehensive
        const { isValid: clientInfoValid } = await validateClientInfo();
        if (!clientInfoValid) {
            toast.error('Please complete the Client Info tab.');
            navigateToTab('client-info');
            return;
        }

        if (!validateAppointmentDetails()) {
            toast.error('Please complete the Appointment Details tab.');
            navigateToTab('appointment-details');
            return;
        }

        // Submit the form with success callback
     post(route('appointments.store'), {
            onSuccess: (page) => {
                console.log('🎉 APPOINTMENT SUCCESSFULLY CREATED!');
                // Server will handle redirect to appointments.index
            },
            onError: (errors) => {
                console.error('❌ APPOINTMENT CREATION FAILED:', errors);
                console.log('🔍 Check the form data and validation errors above');
            }
        });
    };

    // Handle tab click attempts - allow navigation to accessible tabs
    const handleTabChange = (value: string) => {
        // Skip Zod validation during tab navigation
        // The schema expects ALL required fields, but we're only validating one tab at a time
        // This causes false validation failures. Rely on tab-specific validation functions instead.
        console.log('[Appointment Form] Allowing tab navigation without Zod validation');

        // Check if the tab is accessible
        if (isTabAccessible(value)) {
            // Allow navigation to accessible tabs
            navigateToTab(value);
        } else {
            // Show appropriate message for inaccessible tabs
            if (value === 'appointment-details' && !clientInfoComplete) {
                if (getFieldError('health_number')) {
                    toast.error('Health card already exists');
                } else {
                toast.error('Please complete the Client Info tab first.');
            }
        }
    }
};

    // Get tooltip message for disabled next button
    const getNextButtonTooltip = (tabType: 'client-info' | 'appointment-details') => {
        if (tabType === 'client-info') {
            const missingFields = [];
            if (!data.first_name?.trim()) missingFields.push('First Name');
            if (!data.last_name?.trim()) missingFields.push('Last Name');
            if (!data.phone_number?.trim()) missingFields.push('Phone Number');
            if (!data.email_address?.trim()) missingFields.push('Email Address');
            if (!data.gender_pronouns?.trim()) missingFields.push('Gender/Pronouns');
            if (!data.client_type?.trim()) missingFields.push('Client Type');
            if (!data.date_of_birth?.trim()) missingFields.push('Date of Birth');
            if (!data.emergency_contact_phone?.trim()) missingFields.push('Emergency Contact Phone');

            if (missingFields.length > 0) {
                return `Please fill in: ${missingFields.join(', ')}`;
            }
        } else if (tabType === 'appointment-details') {
            const missingFields = [];
            if (!data.service_type?.trim()) missingFields.push('Service Type');
            if (!data.service_name?.trim()) missingFields.push('Service Name');
            if (!data.service_id?.trim()) missingFields.push('Service');
            if (!data.practitioner_ids?.length) missingFields.push('Practitioner');
            
            // Only require location for in-person mode
            if (data.mode === 'in-person' && !data.location_id?.trim()) {
                missingFields.push('Location (required for in-person appointments)');
            }
            
            if (!data.mode?.trim()) missingFields.push('Mode');
            if (!data.date_time_preference?.trim()) missingFields.push('Date & Time');
            if (!data.booking_source?.trim()) missingFields.push('Booking Source');
            if (!data.admin_override?.trim()) missingFields.push('Admin Override');

            if (missingFields.length > 0) {
                return `Please fill in: ${missingFields.join(', ')}`;
            }
        }
        return '';
    };

    const clientTypeOptions = [
        { value: 'individual', label: 'Individual' },
        { value: 'couple', label: 'Couple' },
        { value: 'family', label: 'Family' },
        { value: 'group', label: 'Group' },
    ];

    const bookingSourceOptions = [
        { value: 'phone', label: 'Phone' },
        { value: 'email', label: 'Email' },
        { value: 'walk-in', label: 'Walk-in' },
        { value: 'internal-referral', label: 'Internal Referral' },
        { value: 'online-booking', label: 'Online Booking' },
    ];

    const adminOverrideOptions = [
        { value: 'no-override', label: 'Standard booking hours' },
        { value: 'allows-outside-hours', label: 'Allows booking outside usual hours' },
        { value: 'emergency-booking', label: 'Emergency booking' },
    ];

    // Check if there are validation errors - show as toast instead of error block
    useEffect(() => {
        if (errors) {
            const errorMessages = Object.entries(errors).flatMap(([field, fieldErrors]) => fieldErrors);

            if (errorMessages.length > 0) {
                toast.error(errorMessages[0]); // Show first error as toast
            }
        }
    }, [errors]);

    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            setSuccessMessage(flash.success);
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 10000);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Calendar ref for scrolling
    const calendarRef = useRef<HTMLDivElement>(null);

    return (
        <>
            <Head title="New Appointment" />

            <TooltipProvider>
                <div className="px-4 py-6">
                    <div className="w-full">
                        <div className="min-h-[600px] w-full rounded-lg bg-white p-6">
                            {/* Header */}
                            <div className="mb-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-900">Appointment Booking</h1>
                                        <p className="mt-2 text-sm text-gray-600">
                                            Complete each step to create a new appointment. You can navigate between completed steps freely.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Success Message */}
                            {showSuccessMessage && (
                                <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-green-800">{successMessage}</p>
                                            {/* <p className="text-xs text-green-600 mt-1">
                                            Form will be reset automatically in a moment...
                                        </p> */}
                                            <div className="mt-3">
                                                {/* <button
                                                type="button"
                                                onClick={() => {
                                                    setShowSuccessMessage(false);
                                                    resetForm();
                                                }}
                                                className="text-sm bg-green-700 text-white px-3 py-1 rounded-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
                                            >
                                                Create Another Appointment
                                            </button> */}
                                            </div>
                                        </div>
                                        <div className="ml-auto pl-3">
                                            <div className="-mx-1.5 -my-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSuccessMessage(false)}
                                                    className="inline-flex rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50 focus:outline-none"
                                                >
                                                    <span className="sr-only">Dismiss</span>
                                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tabs */}
                            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col">
                                <TabsList className="mb-6">
                                    <TabsTrigger
                                        value="client-info"
                                        className={`relative cursor-pointer ${
                                            clientInfoComplete
                                                ? 'text-green-700 data-[state=active]:bg-green-50'
                                                : activeTab === 'client-info'
                                                  ? 'text-blue-700'
                                                  : 'text-gray-500'
                                        }`}
                                    >
                                        Client Info
                                        {clientInfoComplete && <span className="ml-2 text-green-600">✓</span>}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="appointment-details"
                                        disabled={!isTabAccessible('appointment-details')}
                                        className={`relative ${
                                            !isTabAccessible('appointment-details')
                                                ? 'cursor-not-allowed text-gray-400 opacity-50'
                                                : isAppointmentDetailsComplete
                                                  ? 'cursor-pointer text-green-700 data-[state=active]:bg-green-50'
                                                  : activeTab === 'appointment-details'
                                                    ? 'cursor-pointer text-blue-700'
                                                    : 'cursor-pointer text-gray-500'
                                        }`}
                                    >
                                        Appointment Details
                                        {isAppointmentDetailsComplete && <span className="ml-2 text-green-600">✓</span>}
                                    </TabsTrigger>
                                </TabsList>

                                {/* Client Info Tab */}
                                <TabsContent value="client-info" className="space-y-6">
                                    <div className="space-y-6">
                                            {/* Health Number Row */}
                                            <div className="relative">
                                                <Label htmlFor="health_number">
                                                    Health Card Number <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="health_number"
                                                    value={data.health_number}
                                                    onChange={(e) => {
                                                        const value = e.target.value.toUpperCase();
                                                        setData('health_number', value);
                                                        clearErrors('health_number');
                                                        if (getFieldError('health_number')) {
                                                            clearFieldError('health_number');
                                                        }
                                                        // Trigger patient search for auto-fill
                                                        searchByHealthNumber(value);
                                                    }}
                                                    onBlur={(e) => handleFieldBlur('health_number', e.target.value)}
                                                    placeholder="e.g., 1234-567-890 (Ontario OHIP)"
                                                    className="placeholder:text-gray-400"
                                                    maxLength={30}
                                                />
                                                {getFieldError('health_number') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('health_number')}
                                                    </div>
                                                )}
                                                {searching && (
                                                    <div className="mt-2 text-sm text-gray-600">
                                                        Searching for existing patient...
                                                    </div>
                                                )}
                                                {foundPatient && !hasConflict && (
                                                    <Alert className="mt-3 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                                                        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                        <AlertDescription>
                                                            <div className="flex flex-col gap-3">
                                                                <div>
                                                                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                                                                        Patient Already Exists
                                                                    </p>
                                                                    <div className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                                                                        <p className="font-medium">
                                                                            {foundPatient.first_name} {foundPatient.last_name}
                                                                        </p>
                                                                        {foundPatient.email && (
                                                                            <p className="text-blue-700 dark:text-blue-300">
                                                                                Email: {foundPatient.email}
                                                                            </p>
                                                                        )}
                                                                        {foundPatient.date_of_birth && (
                                                                            <p className="text-blue-700 dark:text-blue-300">
                                                                                DOB: {foundPatient.date_of_birth}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        onClick={handleAutoFill}
                                                                        className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                                                                    >
                                                                        Load Patient Data
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={clearFoundPatient}
                                                                        className="text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
                                                                    >
                                                                        Dismiss
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                                {multipleMatches.length > 0 && !hasConflict && (
                                                    <Alert className="mt-3 border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
                                                        <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                        <AlertDescription>
                                                            <div className="flex flex-col gap-3">
                                                                <div>
                                                                    <p className="font-semibold text-purple-900 dark:text-purple-100">
                                                                        {multipleMatches.length} Patients Found
                                                                    </p>
                                                                    <p className="mt-1 text-sm text-purple-800 dark:text-purple-200">
                                                                        Select the patient you want to use:
                                                                    </p>
                                                                </div>
                                                                <div className="max-h-60 space-y-2 overflow-y-auto">
                                                                    {multipleMatches.map((patient) => (
                                                                        <div
                                                                            key={patient.id}
                                                                            onClick={() => setSelectedPatientId(patient.id)}
                                                                            className={`cursor-pointer rounded-md border p-3 transition-colors ${
                                                                                selectedPatientId === patient.id
                                                                                    ? 'border-purple-600 bg-purple-100 dark:border-purple-400 dark:bg-purple-900'
                                                                                    : 'border-purple-200 bg-white hover:border-purple-400 dark:border-purple-700 dark:bg-purple-950 dark:hover:border-purple-500'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-start justify-between">
                                                                                <div className="flex-1">
                                                                                    <p className="font-medium text-purple-900 dark:text-purple-100">
                                                                                        {patient.first_name} {patient.last_name}
                                                                                    </p>
                                                                                    <div className="mt-1 space-y-0.5 text-sm text-purple-700 dark:text-purple-300">
                                                                                        <p>Health Card: {patient.health_number}</p>
                                                                                        {patient.email && <p>Email: {patient.email}</p>}
                                                                                        {patient.date_of_birth && <p>DOB: {patient.date_of_birth}</p>}
                                                                                    </div>
                                                                                </div>
                                                                                {selectedPatientId === patient.id && (
                                                                                    <div className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 dark:bg-purple-400">
                                                                                        <div className="h-2 w-2 rounded-full bg-white dark:bg-purple-900"></div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        onClick={handleSelectPatient}
                                                                        disabled={!selectedPatientId}
                                                                        className="bg-purple-600 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-purple-700 dark:hover:bg-purple-600"
                                                                    >
                                                                        Select Patient
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => {
                                                                            clearFoundPatient();
                                                                            setSelectedPatientId(null);
                                                                        }}
                                                                        className="text-purple-700 hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-900"
                                                                    >
                                                                        Dismiss
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                                {hasConflict && conflictingPatient && (
                                                    <Alert className="mt-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                                                        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                                        <AlertDescription>
                                                            <div className="flex flex-col gap-3">
                                                                <div>
                                                                    <p className="font-semibold text-orange-900 dark:text-orange-100">
                                                                        Conflicting Patient Information
                                                                    </p>
                                                                    <p className="mt-1 text-sm text-orange-800 dark:text-orange-200">
                                                                        Different patients found. Please verify which one you want to use:
                                                                    </p>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {foundPatient && (
                                                                        <div
                                                                            onClick={() => handleAutoFill()}
                                                                            className="cursor-pointer rounded-md border border-orange-300 bg-white p-3 hover:border-orange-500 dark:border-orange-700 dark:bg-orange-950 dark:hover:border-orange-500"
                                                                        >
                                                                            <div className="flex items-start justify-between">
                                                                                <div className="flex-1">
                                                                                    <p className="text-xs font-medium uppercase text-orange-600 dark:text-orange-400">
                                                                                        Found by {searchMethod?.replace('_', ' ')}
                                                                                    </p>
                                                                                    <p className="mt-1 font-medium text-orange-900 dark:text-orange-100">
                                                                                        {foundPatient.first_name} {foundPatient.last_name}
                                                                                    </p>
                                                                                    <div className="mt-1 space-y-0.5 text-sm text-orange-700 dark:text-orange-300">
                                                                                        <p>Health Card: {foundPatient.health_number}</p>
                                                                                        {foundPatient.email && <p>Email: {foundPatient.email}</p>}
                                                                                        {foundPatient.date_of_birth && <p>DOB: {foundPatient.date_of_birth}</p>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="rounded-md border border-orange-300 bg-white p-3 dark:border-orange-700 dark:bg-orange-950">
                                                                        <p className="text-xs font-medium uppercase text-orange-600 dark:text-orange-400">
                                                                            Conflicting match
                                                                        </p>
                                                                        <p className="mt-1 font-medium text-orange-900 dark:text-orange-100">
                                                                            {conflictingPatient.first_name} {conflictingPatient.last_name}
                                                                        </p>
                                                                        <div className="mt-1 space-y-0.5 text-sm text-orange-700 dark:text-orange-300">
                                                                            <p>Health Card: {conflictingPatient.health_number}</p>
                                                                            {conflictingPatient.email && <p>Email: {conflictingPatient.email}</p>}
                                                                            {conflictingPatient.date_of_birth && <p>DOB: {conflictingPatient.date_of_birth}</p>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={clearFoundPatient}
                                                                        className="text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900"
                                                                    >
                                                                        Dismiss
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>

                                            {/* First Name, Last Name, and Preferred Name Row */}
                                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                                {/* First Name */}
                                                <div>
                                                    <Label htmlFor="first_name">
                                                        First Name <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="first_name"
                                                        value={data.first_name}
                                                        onChange={(e) => handleFieldChange('first_name', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('first_name', e.target.value)}
                                                        placeholder="Enter First Name"
                                                        className="placeholder:text-gray-400"
                                                        maxLength={50}
                                                    />
                                                    {getFieldError('first_name') && (
                                                        <div className="mt-1 text-sm text-red-600">
                                                            {getFieldError('first_name')}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Last Name */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="last_name">
                                                        Last Name <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="last_name"
                                                        value={data.last_name}
                                                        onChange={(e) => handleFieldChange('last_name', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('last_name', e.target.value)}
                                                        placeholder="Enter Last Name"
                                                        className="placeholder:text-gray-400"
                                                        maxLength={50}
                                                    />
                                                    {getFieldError('last_name') && (
                                                        <div className="mt-1 text-sm text-red-600">
                                                            {getFieldError('last_name')}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Preferred Name */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="preferred_name">
                                                        Preferred Name <span className="text-gray-500">(optional)</span>
                                                    </Label>
                                                    <Input
                                                        id="preferred_name"
                                                        value={data.preferred_name}
                                                        onChange={(e) => handleFieldChange('preferred_name', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('preferred_name', e.target.value)}
                                                        placeholder="e.g., Jess"
                                                        className="placeholder:text-gray-400"
                                                        maxLength={50}
                                                    />
                                                    {getFieldError('preferred_name') && (
                                                        <div className="mt-1 text-sm text-red-600">
                                                            {getFieldError('preferred_name')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        {/* Phone Number, Email Address, and Gender/Pronouns Row */}
                                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                            {/* Phone Number */}
                                            <div className="space-y-2">
                                                <Label htmlFor="phone_number">
                                                    Phone Number <span className="text-red-500">*</span>
                                                </Label>
                                                <PhoneInput
                                                        id="phone_number"
                                                        name="phone_number"
                                                        placeholder="Enter Phone Number"
                                                        value={data.phone_number || ""}
                                                        onChange={(val:any) => {
                                                            setData("phone_number", (val as string) || "");
                                                            if (getFieldError("phone_number")) {
                                                            clearFieldError("phone_number");
                                                            }
                                                        }}
                                                        onBlur={() => handleFieldBlur("phone_number", data.phone_number || "")}
                                                        defaultCountry="CA" // 🇨🇦 Ontario, Canada
                                                        international
                                                        countryCallingCodeEditable={false}
                                                        className={`w-full placeholder:text-gray-400 ${
                                                            errors.phone_number
                                                            ? "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500"
                                                            : ""
                                                        }`}
                                                        maxLength={20}
                                                    />
                                                {/* <Input
                                                    id="phone_number"
                                                    value={data.phone_number}
                                                    onChange={(e) => {
                                                        setData('phone_number', e.target.value);
                                                        if (getFieldError('phone_number')) {
                                                            clearFieldError('phone_number');
                                                        }
                                                    }}
                                                    onBlur={(e) => handleFieldBlur('phone_number', e.target.value)}
                                                    placeholder="Enter Phone Number"
                                                    className="placeholder:text-gray-400"
                                                    maxLength={20}
                                                /> */}
                                                {getFieldError('phone_number') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('phone_number')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Email Address */}
                                            <div className="space-y-2">
                                                <Label htmlFor="email_address">
                                                    Email Address <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="email_address"
                                                    type="email"
                                                    value={data.email_address}
                                                    onChange={(e) => {
                                                        const value = e.target.value.toLowerCase();
                                                        setData('email_address', value);
                                                        if (getFieldError('email_address')) {
                                                            clearFieldError('email_address');
                                                        }
                                                        // Trigger patient search by email
                                                        searchByEmail(value);
                                                    }}
                                                    onBlur={(e) => handleFieldBlur('email_address', e.target.value)}
                                                    placeholder="Enter Email Address"
                                                    className="placeholder:text-gray-400"
                                                    maxLength={255}
                                                />
                                                {getFieldError('email_address') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('email_address')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Gender/Pronouns */}
                                            <div className="space-y-2">
                                                <Label htmlFor="gender_pronouns">
                                                    Gender/Pronouns <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="gender_pronouns"
                                                    value={data.gender_pronouns}
                                                    onChange={(e) => {
                                                        setData('gender_pronouns', e.target.value);
                                                        if (getFieldError('gender_pronouns')) {
                                                            clearFieldError('gender_pronouns');
                                                        }
                                                    }}
                                                    onBlur={(e) => handleFieldBlur('gender_pronouns', e.target.value)}
                                                    placeholder="e.g., she/her, he/him"
                                                    className="placeholder:text-gray-400"
                                                    maxLength={50}
                                                />
                                                {getFieldError('gender_pronouns') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('gender_pronouns')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Date of Birth, Client Type, Emergency Contact Phone Row */}
                                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                            {/* Date of Birth */}
                                            <div className="space-y-2">
                                                <Label htmlFor="date_of_birth">
                                                    Date of Birth <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="date_of_birth"
                                                    type="date"
                                                    value={data.date_of_birth}
                                                    onChange={(e) => setData('date_of_birth', e.target.value)}
                                                    className="placeholder:text-gray-400"
                                                    max={new Date(Date.now()).toISOString().split('T')[0]} // one day before today

                                                />
                                                {getFieldError('date_of_birth') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('date_of_birth')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Client Type */}
                                            <div className="space-y-2">
                                                <Label htmlFor="client_type">
                                                    Client Type <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={data.client_type}
                                                    onValueChange={(value) => setData('client_type', value)}
                                                >
                                                    <SelectTrigger className="placeholder:text-gray-400">
                                                        <SelectValue placeholder="Select client type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="individual">Individual</SelectItem>
                                                        <SelectItem value="couple">Couple</SelectItem>
                                                        <SelectItem value="family">Family</SelectItem>
                                                        <SelectItem value="group">Group</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {getFieldError('client_type') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('client_type')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Emergency Contact Phone */}
                                            <div className="space-y-2">
                                                <Label htmlFor="emergency_contact_phone">
                                                    Emergency Contact Phone <span className="text-red-500">*</span>
                                                </Label>
                                               <PhoneInput
                                                        id="emergency_contact_phone"
                                                        name="emergency_contact_phone"
                                                        placeholder="Enter Emergency Contact Phone"
                                                        value={data.emergency_contact_phone || ""}
                                                        onChange={(val) => {
                                                            setData("emergency_contact_phone", (val as string) || "");
                                                            if (getFieldError("emergency_contact_phone")) {
                                                            clearFieldError("emergency_contact_phone");
                                                            }
                                                        }}
                                                        onBlur={() =>
                                                            handleFieldBlur("emergency_contact_phone", data.emergency_contact_phone || "")
                                                        }
                                                        defaultCountry="CA" // 🇨🇦 Ontario, Canada
                                                        international
                                                        countryCallingCodeEditable={false}
                                                        className={`w-full placeholder:text-gray-400 ${
                                                            errors.emergency_contact_phone
                                                            ? "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500"
                                                            : ""
                                                        }`}
                                                        maxLength={20}
                                                    />
                                                {getFieldError('emergency_contact_phone') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('emergency_contact_phone')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-end gap-4 border-t border-gray-100 pt-6">
                                        {!clientInfoComplete ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div>
                                                        <Button
                                                            type="button"
                                                            onClick={handleClientInfoNext}
                                                            disabled={true}
                                                            size="save"
                                                            className="flex items-center gap-2"
                                                        >
                                                            Next
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{getNextButtonTooltip('client-info')}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <Button
                                                type="button"
                                                onClick={handleClientInfoNext}
                                                disabled={navigatingToAppointmentDetails}
                                                size="save"
                                                className="flex items-center gap-2"
                                            >
                                                {navigatingToAppointmentDetails ? 'Loading...' : 'Next'}
                                                {!navigatingToAppointmentDetails && <ArrowRight className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Appointment Details Tab */}
                                <TabsContent value="appointment-details" className="space-y-6">
                                    <div className="space-y-4">
                                        {/* Row 1: Service Type, Service Name, Mode */}
                                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                            {/* Service Type */}
                                            <div className="space-y-2">
                                                <Label htmlFor="service_type">
                                                    Service Type <span className="text-red-500">*</span>
                                                </Label>
                                                <Select value={data.service_type} onValueChange={handleServiceTypeChange}>
                                                    <SelectTrigger 
                                                        className="placeholder:text-gray-400"
                                                        onBlur={() =>{
                                                            console.log('VALIDATINGG ON BVLUD')
                                                            handleServiceTypeBlur(data.service_type)}}
                                                                  onMouseDown={() =>{
                                                            console.log('onMouseDOwn')
                                                            handleServiceTypeBlur(data.service_type)}}
                                                    >
                                                        <SelectValue placeholder="Select Service Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {serviceTypes?.map((type) => (
                                                            <SelectItem key={type} value={type}>
                                                                {type}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {getFieldError('service_type') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('service_type')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Service Name */}
                                            <div className="space-y-2">
                                                <Label htmlFor="service_name">
                                                    Service <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={data.service_name}
                                                    onValueChange={handleServiceNameChange}
                                                    disabled={loadingServices || filteredServices.length === 0}
                                                >
                                                    <SelectTrigger 
                                                        className="placeholder:text-gray-400"
                                                        onBlur={() => handleServiceNameBlur(data.service_name)}
                                                    >
                                                        <SelectValue
                                                            placeholder={
                                                                loadingServices
                                                                    ? 'Loading services...'
                                                                    : filteredServices.length === 0
                                                                      ? 'Select service type first'
                                                                      : 'Select Service'
                                                            }
                                                        />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {filteredServices.map((service) => (
                                                            <SelectItem key={service.id} value={service.name}>
                                                                {service.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {getFieldError('service_name') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('service_name')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mode */}
                                            <div className="space-y-2">
                                                <Label htmlFor="mode">
                                                    Mode <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={data.mode}
                                                    onValueChange={(value) => {
                                                        setData('mode', value);
                                                        setSelectedPractitioners([]); // Clear practitioner selection visually
                                                        // Clear location and practitioner when mode changes
                                                        setDataTyped((prev: any) => ({
                                                            ...prev,
                                                            mode: value,
                                                            location_id: '',
                                                            practitioner_ids: [],
                                                        }));

                                                        // Clear validation errors when user makes a selection
                                                        if (getFieldError('mode')) {
                                                            clearFieldError('mode');
                                                        }
                                                        if (getFieldError('location_id')) {
                                                            clearFieldError('location_id');
                                                        }
                                                        
                                                        // Trigger validation immediately after selection
                                                        setTimeout(() => {
                                                            validateFieldOnBlur('mode', value);
                                                        }, 0);
                                                        
                                                        // Scroll to calendar after a brief delay to allow rendering
                                                        setTimeout(() => {
                                                            if (calendarRef.current && data.practitioner_ids.length > 0) {
                                                                calendarRef.current.scrollIntoView({
                                                                    behavior: 'smooth',
                                                                    block: 'center',
                                                                });
                                                            }
                                                        }, 100);
                                                    }}
                                                    disabled={filteredModeOptions.length === 0}
                                                >
                                                    <SelectTrigger 
                                                        className="placeholder:text-gray-400"
                                                        onBlur={() => handleModeBlur(data.mode)}
                                                    >
                                                        <SelectValue
                                                            placeholder={filteredModeOptions.length === 0 ? 'Select service first' : 'Select mode'}
                                                        />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {filteredModeOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {getFieldError('mode') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('mode')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 2: Location, Practitioner */}
                                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                            {/* Location - Always visible but conditionally disabled */}
                                            <div className="space-y-2">
                                                <Label htmlFor="location_id">
                                                    Location {data.mode === 'in-person' && <span className="text-red-500">*</span>}
                                                    {data.mode === 'virtual' && <span className="text-gray-500">(optional)</span>}
                                                    {data.mode === 'hybrid' && <span className="text-gray-500">(optional)</span>}
                                                </Label>
                                                {data.mode === 'virtual' || data.mode === 'hybrid' || !data.mode ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div>
                                                                <Select
                                                                    value={data.location_id}
                                                                    onValueChange={(value) => {
                                                                        setDataTyped((prev: any) => ({
                                                                            ...prev,
                                                                            location_id: value,
                                                                            practitioner_ids: [],
                                                                            date_time_preference: '',
                                                                        }));
                                                                        
                                                                        // Clear validation errors when user makes a selection
                                                                        if (getFieldError('location_id')) {
                                                                            clearFieldError('location_id');
                                                                        }
                                                                        
                                                                        // Trigger validation immediately after selection
                                                                        setTimeout(() => {
                                                                            validateFieldOnBlur('location_id', value);
                                                                        }, 0);
                                                                    }}
                                                                    disabled={data.mode !== 'in-person'}
                                                                >
                                                                    <SelectTrigger
                                                                        className={`placeholder:text-gray-400 ${data.mode !== 'in-person' ? 'cursor-not-allowed opacity-50' : ''}`}
                                                                        onBlur={() => handleLocationBlur(data.location_id)}
                                                                    >
                                                                        <SelectValue
                                                                            placeholder={
                                                                                data.mode === 'virtual'
                                                                                    ? 'Not required for virtual appointments'
                                                                                    : data.mode === 'hybrid'
                                                                                      ? 'Not required for hybrid appointments'
                                                                                      : !data.mode
                                                                                        ? 'Select mode first'
                                                                                        : 'Select Location'
                                                                            }
                                                                        />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {locations?.map((location) => (
                                                                            <SelectItem key={location.id} value={location.id.toString()}>
                                                                                {location.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {data.mode === 'virtual' && <p>Location is not required for virtual appointments</p>}
                                                            {data.mode === 'hybrid' && <p>Location is not required for hybrid appointments</p>}
                                                            {!data.mode && <p>Please select a mode first</p>}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <Select
                                                        value={data.location_id}
                                                        onValueChange={(value) => {
                                                            setDataTyped((prev: any) => ({
                                                                ...prev,
                                                                location_id: value,
                                                                practitioner_ids: [],
                                                                date_time_preference: '',
                                                            }));
                                                            
                                                            // Clear validation errors when user makes a selection
                                                            if (getFieldError('location_id')) {
                                                                clearFieldError('location_id');
                                                            }
                                                            
                                                            // Trigger validation immediately after selection
                                                            setTimeout(() => {
                                                                validateFieldOnBlur('location_id', value);
                                                            }, 0);
                                                        }}
                                                        disabled={data.mode !== 'in-person'}
                                                    >
                                                        <SelectTrigger 
                                                            className="placeholder:text-gray-400"
                                                            onBlur={() => handleLocationBlur(data.location_id)}
                                                        >
                                                            <SelectValue placeholder="Select Location" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {locations.map((location) => (
                                                                <SelectItem key={location.id} value={location.id.toString()}>
                                                                    {location.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>

                                                                        {/* Practitioner - Multi-select with badges */}
                            <div className="space-y-2">
                                <Label htmlFor="practitioner_ids">
                                    Practitioner(s) <span className="text-red-500">*</span>
                                </Label>
                                
                                <Select
                                    value=""
                                    onValueChange={addPractitioner}
                                    disabled={!data.mode || loadingPractitioners || filteredPractitioners.length === 0 || (data.mode === 'in-person' && !data.location_id)}
                                >
                                    <SelectTrigger className="placeholder:text-gray-400">
                                        <SelectValue
                                            placeholder={
                                                !data.mode
                                                    ? 'Select mode first'
                                                    : loadingPractitioners
                                                        ? 'Loading practitioners...'
                                                        : filteredPractitioners.length === 0
                                                            ? 'No practitioners available for selected service'
                                                            : data.mode === 'in-person' && !data.location_id
                                                            ? 'Select location first for in-person appointments'
                                                            : 'Add practitioner'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredPractitioners
                                            .filter(practitioner => !data.practitioner_ids.includes(practitioner.id))
                                            .map((practitioner) => (
                                                <SelectItem key={practitioner.id} value={practitioner.id.toString()}>
                                                    {practitioner.label}
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>

                                {/* Selected Practitioners Badges */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedPractitioners.map((practitioner) => (
                                        <Badge key={practitioner.id} variant="secondary" className="flex items-center gap-1">
                                            {practitioner.label}
                                            <button
                                                type="button"
                                                onClick={() => removePractitioner(practitioner.id)}
                                                className="ml-1 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                                
                                {getFieldError('practitioner_ids') && (
                                    <div className="mt-1 text-sm text-red-600">
                                        {getFieldError('practitioner_ids')}
                                    </div>
                                )}
                            </div>

                            {/* Primary Practitioner - Required dropdown */}
                            {selectedPractitioners.length > 0 && (
                                <div className="space-y-2">
                                    <Label htmlFor="primary_practitioner_id">
                                        Primary Practitioner <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={data.primary_practitioner_id?.toString() || ''}
                                        onValueChange={(value) => {
                                            setData('primary_practitioner_id', parseInt(value));
                                            
                                            // Clear validation errors when user makes a selection
                                            if (getFieldError('primary_practitioner_id')) {
                                                clearFieldError('primary_practitioner_id');
                                            }
                                            
                                            // Trigger validation immediately after selection
                                            setTimeout(() => {
                                                validateFieldOnBlur('primary_practitioner_id', value);
                                            }, 0);
                                        }}
                                    >
                                        <SelectTrigger 
                                            className="placeholder:text-gray-400"
                                            onBlur={() => handlePrimaryPractitionerBlur(data.primary_practitioner_id?.toString() || '')}
                                        >
                                            <SelectValue placeholder="Select primary practitioner" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedPractitioners.map((practitioner) => (
                                                <SelectItem key={practitioner.id} value={practitioner.id.toString()}>
                                                    {practitioner.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {getFieldError('primary_practitioner_id') && (
                                        <div className="mt-1 text-sm text-red-600">
                                            {getFieldError('primary_practitioner_id')}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-500">
                                        The primary practitioner is the main provider responsible for this appointment
                                    </p>
                                </div>
                            )}

                            {/* Advanced Appointment Settings - Separate Section */}
                            {selectedPractitioners.length > 1 && (
                                <div className="border-t border-gray-200 pt-6 mt-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Switch 
                                            checked={data.advanced_appointment_settings}
                                            onCheckedChange={(checked) => setData('advanced_appointment_settings', checked)}
                                        />
                                        <div className="flex items-center gap-2">
                                            <Label className="text-base font-medium">Advanced Appointment Settings</Label>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-4 w-4 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Enable to assign different time segments to multiple practitioners within a single appointment slot</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    
                                    {data.advanced_appointment_settings && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="flex items-start">
                                                <Info className="mt-0.5 mr-2 h-4 w-4 text-blue-500" />
                                                <div className="text-sm text-blue-700">
                                                    <strong>Advanced Mode Enabled:</strong> When you select a time slot, you'll be able to divide it between the selected practitioners. 
                                                    Each practitioner can be assigned different time segments within the selected appointment slot.
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                                            </div>

                                                                {/* Calendar Booking Interface */}
                        {data.practitioner_ids.length > 0 && data.mode && (
                            <div className="mt-8 space-y-6">
                                <div>
                                    <Label className="text-base font-medium">
                                        Date & Time <span className="text-red-500">*</span>
                                    </Label>
                                    {getFieldError('date_time_preference') && (
                                        <div className="mt-1 text-sm text-red-600">
                                            {getFieldError('date_time_preference')}
                                        </div>
                                    )}
                                </div>
                                {data.advanced_appointment_settings && selectedPractitioners.length > 1 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                        <div className="flex items-start">
                                            <Info className="mt-0.5 mr-2 h-4 w-4 text-amber-500" />
                                            <div className="text-sm text-amber-700">
                                                <strong>Advanced Mode:</strong> Click on a time slot to divide it between multiple practitioners. 
                                                Each practitioner can be assigned different time segments within the selected slot.
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Google Calendar Conflict Warning */}
                                {showConflictWarning && calendarConflicts.length > 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                        <div className="flex items-start space-x-3">
                                            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <h3 className="font-medium text-yellow-800 mb-2">
                                                    Google Calendar Conflicts Detected
                                                </h3>
                                                <div className="space-y-2">
                                                    {calendarConflicts.map((conflict, index) => (
                                                        <div key={index} className="bg-yellow-100 rounded-md p-3">
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <Calendar className="h-4 w-4 text-yellow-600" />
                                                                <span className="font-medium text-yellow-800">
                                                                    {conflict.practitionerName}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {conflict.conflictingEvents.map((event, eventIndex) => (
                                                                    <div key={eventIndex} className="text-sm text-yellow-700">
                                                                        <span className="font-medium">{event.title}</span>
                                                                        <span className="ml-2 text-yellow-600">
                                                                            {event.startTime} - {event.endTime}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-3 text-sm text-yellow-700">
                                                    <strong>Warning:</strong> The selected practitioners have conflicting events 
                                                    in their Google Calendar during this time. Please choose a different time 
                                                    or verify with the practitioners before proceeding.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Checking conflicts indicator */}
                                {checkingConflicts && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                            <span className="text-sm text-blue-700">
                                                Checking Google Calendar conflicts for selected practitioners...
                                            </span>
                                        </div>
                                    </div>
                                )}
                                
                                <CalendarBooking
                                    ref={calendarRef}
                                    selectedDateTime={data.date_time_preference}
                                    onDateTimeSelect={(dateTime) => {
                                        if (data.advanced_appointment_settings && selectedPractitioners.length > 1) {
                                            // Extract date and time for advanced mode
                                            const [date, time] = dateTime.split(' ');
                                            handleSlotClick(date, time);
                                        } else {
                                            // Standard slot selection
                                            setData('date_time_preference', dateTime);
                                        }
                                    }}
                                    practitionerId={data.practitioner_ids[0]?.toString() || ''} // Use first practitioner for availability checking
                                    practitionerIds={data.practitioner_ids} // Send all practitioner IDs for conflict checking
                                    practitionersCalendarStatus={practitionersCalendarStatus} // Pass calendar integration status
                                    serviceId={data.service_id}
                                    practitionerAvailability={practitionerAvailability}
                                    loadingAvailability={loadingAvailability}
                                    appointmentSessionDuration={appointmentSessionDuration}
                                    appointmentSettings={appointmentSettings}
                                    existingAppointments={existingAppointments}
                                    showConflicts={true} // Always show conflicts
                                />
                            </div>
                        )}

                                        {/* Additional Options */}
                                        <div className="grid grid-cols-1 gap-6 border-t pt-6 lg:grid-cols-2">
                                            {/* Booking Source */}
                                            <div className="space-y-2">
                                                <Label htmlFor="booking_source">
                                                    Booking Source <span className="text-red-500">*</span>
                                                </Label>
                                                <Select value={data.booking_source}                                                 onValueChange={(value) => {
                                                    setData('booking_source', value);
                                                    
                                                    // Clear validation errors when user makes a selection
                                                    if (getFieldError('booking_source')) {
                                                        clearFieldError('booking_source');
                                                    }
                                                    
                                                    // Trigger validation immediately after selection
                                                    setTimeout(() => {
                                                        validateFieldOnBlur('booking_source', value);
                                                    }, 0);
                                                }}>
                                                    <SelectTrigger 
                                                        className="placeholder:text-gray-400"
                                                        onBlur={() => handleBookingSourceBlur(data.booking_source)}
                                                    >
                                                        <SelectValue placeholder="Phone / Email / Walk-in" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {bookingSourceOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {getFieldError('booking_source') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('booking_source')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Admin Override */}
                                            <div className="space-y-2">
                                                <Label htmlFor="admin_override">
                                                    Admin Override <span className="text-red-500">*</span>
                                                </Label>
                                                <Select value={data.admin_override}                                                 onValueChange={(value) => {
                                                    setData('admin_override', value);
                                                    
                                                    // Clear validation errors when user makes a selection
                                                    if (getFieldError('admin_override')) {
                                                        clearFieldError('admin_override');
                                                    }
                                                    
                                                    // Trigger validation immediately after selection
                                                    setTimeout(() => {
                                                        validateFieldOnBlur('admin_override', value);
                                                    }, 0);
                                                }}>
                                                    <SelectTrigger 
                                                        className="placeholder:text-gray-400"
                                                        onBlur={() => handleAdminOverrideBlur(data.admin_override)}
                                                    >
                                                        <SelectValue placeholder="Standard booking hours" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {adminOverrideOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {getFieldError('admin_override') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('admin_override')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Contact Person */}
                                            <div className="space-y-2">
                                                <Label htmlFor="contact_person">
                                                    Contact Person <span className="text-gray-500">(leave blank if same as client)</span>
                                                </Label>
                                                <Input
                                                    id="contact_person"
                                                    value={data.contact_person}
                                                    onChange={(e) => {
                                                        setData('contact_person', e.target.value);
                                                        if (getFieldError('contact_person')) {
                                                            clearFieldError('contact_person');
                                                        }
                                                    }}
                                                    onBlur={(e) => handleFieldBlur('contact_person', e.target.value)}
                                                    placeholder="Enter Contact Person Name"
                                                    className="placeholder:text-gray-400"
                                                    maxLength={100}
                                                />
                                                {getFieldError('contact_person') && (
                                                    <div className="mt-1 text-sm text-red-600">
                                                        {getFieldError('contact_person')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>


                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-6">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handlePrevious('client-info')}
                                            disabled={navigatingToPrevious}
                                            className="flex items-center gap-2"
                                        >
                                            {!navigatingToPrevious && <ArrowLeft className="h-4 w-4" />}
                                            {navigatingToPrevious ? 'Loading...' : 'Previous'}
                                        </Button>

                                        {!isAppointmentDetailsComplete ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div>
                                                        <Button
                                                            type="button"
                                                            onClick={handleAppointmentDetailsSave}
                                                            disabled={true}
                                                            size="save"
                                                            className="flex items-center gap-2"
                                                        >
                                                            Save
                                                        </Button>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{getNextButtonTooltip('appointment-details')}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <Button
                                                type="button"
                                                onClick={handleAppointmentDetailsSave}
                                                disabled={processing}
                                                size="save"
                                                className="flex items-center gap-2"
                                            >
                                                {processing ? 'Saving...' : 'Save'}
                                            </Button>
                                        )}
                                    </div>
                                </TabsContent>

                            </Tabs>
                        </div>
                    </div>
                </div>


                {/* Slot Division Modal */}
                {showSlotDivisionModal && selectedSlotForDivision && (
                    <Dialog open={showSlotDivisionModal} onOpenChange={setShowSlotDivisionModal}>
                        <DialogContent className={`max-h-[90vh] overflow-y-auto ${
                            selectedPractitioners.length === 1 ? 'max-w-md' :
                            selectedPractitioners.length === 2 ? 'max-w-3xl' :
                            selectedPractitioners.length === 3 ? 'max-w-5xl' :
                            selectedPractitioners.length === 4 ? 'max-w-6xl' :
                            selectedPractitioners.length === 5 ? 'max-w-7xl' :
                            'max-w-[95vw] overflow-x-auto'
                        }`}>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-blue-600" />
                                    Schedule Overlapping Appointments
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start">
                                        <Info className="mt-0.5 mr-2 h-4 w-4 text-blue-500" />
                                        <div className="text-sm text-blue-700">
                                            <strong>Selected Slot:</strong> {selectedSlotForDivision.date} at {selectedSlotForDivision.time}
                                            <br />
                                            <strong>Total Duration:</strong> {appointmentSessionDuration} minutes
                                            <br />
                                            <em>Set overlapping time segments for each practitioner. Each can attend for their specified duration.</em>
                                        </div>
                                    </div>
                                </div>

                                                                                {/* Practitioners Grid Layout */}
                                <div className={`grid gap-4 ${
                                    selectedPractitioners.length === 1 ? 'grid-cols-1' :
                                    selectedPractitioners.length === 2 ? 'grid-cols-2' :
                                    selectedPractitioners.length === 3 ? 'grid-cols-3' :
                                    selectedPractitioners.length === 4 ? 'grid-cols-4' :
                                    selectedPractitioners.length === 5 ? 'grid-cols-5' :
                                    'grid-cols-6'
                                }`}>
                                    {selectedPractitioners.map((practitioner, index) => {
                                        const currentDivision = slotDivisions.find(sd => sd.practitionerId === practitioner.id);
                                        
                                        // Calculate slot start and end times
                                        const slotStartTime = selectedSlotForDivision.time;
                                        const [slotHours, slotMinutes] = slotStartTime.split(':').map(Number);
                                        const slotEndMinutes = slotHours * 60 + slotMinutes + appointmentSessionDuration;
                                        const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
                                        
                                        return (
                                            <div key={practitioner.id} className="border rounded-lg p-3 space-y-3 bg-white min-h-fit">
                                                {/* Practitioner Header */}
                                                <div className="text-center">
                                                    <h4 className="font-medium text-gray-900 mb-1">{practitioner.label}</h4>
                                                    <Badge variant="outline" className="text-xs">
                                                        Practitioner {index + 1}
                                                    </Badge>
                                                </div>
                                                
                                                {/* Time Selection Options */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-medium text-gray-700">Time Assignment</Label>
                                                    <div className="flex items-center justify-center space-x-3 bg-gray-50 rounded-lg p-2">
                                                        <span className="text-xs text-gray-600 font-medium">Custom</span>
                                                        <Switch
                                                            checked={currentDivision?.isEntireSlot !== false}
                                                            onCheckedChange={(checked) => {
                                                                const updatedDivisions = slotDivisions.map(sd => 
                                                                    sd.practitionerId === practitioner.id 
                                                                        ? { 
                                                                            ...sd, 
                                                                            startTime: slotStartTime,
                                                                            endTime: slotEndTime,
                                                                            durationMinutes: appointmentSessionDuration,
                                                                            isEntireSlot: checked
                                                                        }
                                                                        : sd
                                                                );
                                                                
                                                                if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                                                    updatedDivisions.push({
                                                                        practitionerId: practitioner.id,
                                                                        practitionerName: practitioner.label,
                                                                        startTime: slotStartTime,
                                                                        endTime: slotEndTime,
                                                                        durationMinutes: appointmentSessionDuration,
                                                                        isEntireSlot: checked
                                                                    });
                                                                }
                                                                setSlotDivisions(updatedDivisions);
                                                            }}
                                                        />
                                                        <span className="text-xs text-gray-600 font-medium">Entire</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Time Controls */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`start_time_${practitioner.id}`} className="text-xs font-medium">
                                                            Start
                                                        </Label>
                                                        <Input
                                                            id={`start_time_${practitioner.id}`}
                                                            type="time"
                                                            min={slotStartTime}
                                                            max={slotEndTime}
                                                            value={currentDivision?.startTime || slotStartTime}
                                                            onChange={(e) => {
                                                                const newStartTime = e.target.value;
                                                                
                                                                // Validate start time is within slot bounds
                                                                if (newStartTime < slotStartTime || newStartTime > slotEndTime) {
                                                                    return; // Don't update if out of bounds
                                                                }
                                                                
                                                                // Auto-adjust end time if it becomes invalid
                                                                let newEndTime = currentDivision?.endTime || slotEndTime;
                                                                if (newEndTime <= newStartTime || newEndTime > slotEndTime) {
                                                                    newEndTime = slotEndTime;
                                                                }
                                                                
                                                                // Calculate duration
                                                                const [startHours, startMinutes] = newStartTime.split(':').map(Number);
                                                                const [endHours, endMinutes] = newEndTime.split(':').map(Number);
                                                                const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
                                                                
                                                                const updatedDivisions = slotDivisions.map(sd => 
                                                                    sd.practitionerId === practitioner.id 
                                                                        ? { ...sd, startTime: newStartTime, endTime: newEndTime, durationMinutes: duration, isEntireSlot: false }
                                                                        : sd
                                                                );
                                                                if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                                                    updatedDivisions.push({
                                                                        practitionerId: practitioner.id,
                                                                        practitionerName: practitioner.label,
                                                                        startTime: newStartTime,
                                                                        endTime: newEndTime,
                                                                        durationMinutes: duration,
                                                                        isEntireSlot: false
                                                                    });
                                                                }
                                                                setSlotDivisions(updatedDivisions);
                                                            }}
                                                            className={`text-sm h-8 ${
                                                                currentDivision?.startTime && 
                                                                (currentDivision.startTime < slotStartTime || currentDivision.startTime > slotEndTime)
                                                                    ? 'border-red-500 focus:border-red-500' 
                                                                    : ''
                                                            }`}
                                                            disabled={currentDivision?.isEntireSlot}
                                                        />
                                                        {currentDivision?.startTime && 
                                                         (currentDivision.startTime < slotStartTime || currentDivision.startTime > slotEndTime) && (
                                                            <p className="text-xs text-red-500">Must be between {slotStartTime} - {slotEndTime}</p>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`end_time_${practitioner.id}`} className="text-xs font-medium">
                                                            End
                                                        </Label>
                                                        <Input
                                                            id={`end_time_${practitioner.id}`}
                                                            type="time"
                                                            min={currentDivision?.startTime || slotStartTime}
                                                            max={slotEndTime}
                                                            value={currentDivision?.endTime || slotEndTime}
                                                            onChange={(e) => {
                                                                const newEndTime = e.target.value;
                                                                const startTimeValue = currentDivision?.startTime || slotStartTime;
                                                                
                                                                // Validate end time is within slot bounds and after start time
                                                                if (newEndTime > slotEndTime || newEndTime <= startTimeValue) {
                                                                    return; // Don't update if invalid
                                                                }
                                                                
                                                                // Calculate duration
                                                                const [startHours, startMinutes] = startTimeValue.split(':').map(Number);
                                                                const [endHours, endMinutes] = newEndTime.split(':').map(Number);
                                                                const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
                                                                
                                                                const updatedDivisions = slotDivisions.map(sd => 
                                                                    sd.practitionerId === practitioner.id 
                                                                        ? { ...sd, endTime: newEndTime, durationMinutes: duration, isEntireSlot: false }
                                                                        : sd
                                                                );
                                                                if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                                                    updatedDivisions.push({
                                                                        practitionerId: practitioner.id,
                                                                        practitionerName: practitioner.label,
                                                                        startTime: startTimeValue,
                                                                        endTime: newEndTime,
                                                                        durationMinutes: duration,
                                                                        isEntireSlot: false
                                                                    });
                                                                }
                                                                setSlotDivisions(updatedDivisions);
                                                            }}
                                                            className={`text-sm h-8 ${
                                                                currentDivision?.endTime && 
                                                                (currentDivision.endTime > slotEndTime || currentDivision.endTime <= (currentDivision.startTime || slotStartTime))
                                                                    ? 'border-red-500 focus:border-red-500' 
                                                                    : ''
                                                            }`}
                                                            disabled={currentDivision?.isEntireSlot}
                                                        />
                                                        {currentDivision?.endTime && 
                                                         (currentDivision.endTime > slotEndTime || currentDivision.endTime <= (currentDivision.startTime || slotStartTime)) && (
                                                            <p className="text-xs text-red-500">
                                                                Must be after start time and before {slotEndTime}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-1">
                                                    <Label htmlFor={`duration_${practitioner.id}`} className="text-xs font-medium">
                                                        Duration (minutes)
                                                    </Label>
                                                    <Input
                                                        id={`duration_${practitioner.id}`}
                                                        type="number"
                                                        min="5"
                                                        max={appointmentSessionDuration}
                                                        step="5"
                                                        value={currentDivision?.durationMinutes || ''}
                                                        onChange={(e) => {
                                                            const duration = parseInt(e.target.value) || 0;
                                                            const startTimeValue = currentDivision?.startTime || slotStartTime;
                                                            
                                                            // Calculate end time
                                                            const [hours, minutes] = startTimeValue.split(':').map(Number);
                                                            const totalMinutes = hours * 60 + minutes + duration;
                                                            const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
                                                            
                                                            // Validate that end time doesn't exceed slot boundary
                                                            if (endTime > slotEndTime) {
                                                                return; // Don't update if it would exceed slot end time
                                                            }
                                                            
                                                            const updatedDivisions = slotDivisions.map(sd => 
                                                                sd.practitionerId === practitioner.id 
                                                                    ? { ...sd, durationMinutes: duration, endTime, isEntireSlot: false }
                                                                    : sd
                                                            );
                                                            
                                                            if (!slotDivisions.find(sd => sd.practitionerId === practitioner.id)) {
                                                                updatedDivisions.push({
                                                                    practitionerId: practitioner.id,
                                                                    practitionerName: practitioner.label,
                                                                    startTime: startTimeValue,
                                                                    endTime,
                                                                    durationMinutes: duration,
                                                                    isEntireSlot: false
                                                                });
                                                            }
                                                            setSlotDivisions(updatedDivisions);
                                                        }}
                                                        placeholder="30"
                                                        className={`text-sm h-8 ${
                                                            currentDivision?.durationMinutes && 
                                                            (() => {
                                                                const startTimeValue = currentDivision?.startTime || slotStartTime;
                                                                const [hours, minutes] = startTimeValue.split(':').map(Number);
                                                                const totalMinutes = hours * 60 + minutes + currentDivision.durationMinutes;
                                                                const calculatedEndTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
                                                                return calculatedEndTime > slotEndTime;
                                                            })()
                                                                ? 'border-red-500 focus:border-red-500' 
                                                                : ''
                                                        }`}
                                                        disabled={currentDivision?.isEntireSlot}
                                                    />
                                                    {currentDivision?.durationMinutes && 
                                                     (() => {
                                                         const startTimeValue = currentDivision?.startTime || slotStartTime;
                                                         const [hours, minutes] = startTimeValue.split(':').map(Number);
                                                         const totalMinutes = hours * 60 + minutes + currentDivision.durationMinutes;
                                                         const calculatedEndTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
                                                         return calculatedEndTime > slotEndTime;
                                                     })() && (
                                                        <p className="text-xs text-red-500">
                                                            Duration would exceed slot end time ({slotEndTime})
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                {/* Current Assignment Display */}
                                                {currentDivision && (
                                                    <div className="bg-gray-50 rounded p-2 text-xs">
                                                        <div className="text-center">
                                                            <div className="font-medium">
                                                                {currentDivision.startTime} - {currentDivision.endTime}
                                                            </div>
                                                            <div className="text-gray-600">
                                                                {currentDivision.durationMinutes} minutes
                                                                {currentDivision.isEntireSlot && ' (Full Slot)'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Schedule Summary */}
                                {slotDivisions.length > 0 && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div className="flex items-start">
                                            <Clock className="mt-0.5 mr-2 h-4 w-4 text-green-500" />
                                            <div className="text-sm text-green-700 flex-1">
                                                <strong>Schedule Overview:</strong>
                                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {slotDivisions.map((division) => (
                                                        <div key={division.practitionerId} className="flex justify-between bg-white rounded px-2 py-1">
                                                            <span className="font-medium">{division.practitionerName}:</span>
                                                            <span>
                                                                {division.startTime} - {division.endTime} ({division.durationMinutes}m)
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Status Summary */}
                                <div className="border-t pt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-gray-700">Practitioners Assigned:</span>
                                        <span className="font-bold text-blue-600">
                                            {slotDivisions.length} of {selectedPractitioners.length}
                                        </span>
                                    </div>
                                    {slotDivisions.length < selectedPractitioners.length && (
                                        <p className="text-amber-600 text-sm mt-1">
                                            ⚠️ Please assign time slots to all selected practitioners.
                                        </p>
                                    )}
                                    {slotDivisions.some(sd => sd.durationMinutes === 0) && (
                                        <p className="text-red-600 text-sm mt-1">
                                            ⚠️ All practitioners must have a duration greater than 0 minutes.
                                        </p>
                                    )}
                                    {slotDivisions.some(sd => {
                                        const slotStartTime = selectedSlotForDivision.time;
                                        const [slotHours, slotMinutes] = slotStartTime.split(':').map(Number);
                                        const slotEndMinutes = slotHours * 60 + slotMinutes + appointmentSessionDuration;
                                        const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
                                        return sd.startTime < slotStartTime || sd.endTime > slotEndTime || sd.startTime >= sd.endTime;
                                    }) && (
                                        <p className="text-red-600 text-sm mt-1">
                                            ⚠️ All practitioner times must be within the slot boundaries ({selectedSlotForDivision.time} - {(() => {
                                                const slotStartTime = selectedSlotForDivision.time;
                                                const [slotHours, slotMinutes] = slotStartTime.split(':').map(Number);
                                                const slotEndMinutes = slotHours * 60 + slotMinutes + appointmentSessionDuration;
                                                return `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
                                            })()}).
                                        </p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="secondary" onClick={() => {
                                    setShowSlotDivisionModal(false);
                                    setSlotDivisions([]);
                                }}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        // Calculate slot boundaries
                                        const slotStartTime = selectedSlotForDivision.time;
                                        const [slotHours, slotMinutes] = slotStartTime.split(':').map(Number);
                                        const slotEndMinutes = slotHours * 60 + slotMinutes + appointmentSessionDuration;
                                        const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
                                        
                                        // Validate that all practitioners have valid time assignments
                                        const allPractitionersAssigned = slotDivisions.length === selectedPractitioners.length;
                                        const allHaveValidDuration = slotDivisions.every(sd => sd.durationMinutes > 0);
                                        const allWithinSlotBounds = slotDivisions.every(sd => {
                                            return sd.startTime >= slotStartTime && 
                                                   sd.endTime <= slotEndTime && 
                                                   sd.startTime < sd.endTime;
                                        });
                                        
                                        if (allPractitionersAssigned && allHaveValidDuration && allWithinSlotBounds) {
                                            const dateTime = `${selectedSlotForDivision.date} ${selectedSlotForDivision.time}`;
                                            setData('date_time_preference', dateTime);
                                            setData('slot_divisions', JSON.stringify(slotDivisions));
                                            setShowSlotDivisionModal(false);
                                            toast.success('Overlapping appointment schedule saved successfully!');
                                        } else {
                                            if (!allPractitionersAssigned) {
                                                toast.error('Please assign time slots to all selected practitioners.');
                                            } else if (!allHaveValidDuration) {
                                                toast.error('Please ensure all practitioners have a valid duration (greater than 0 minutes).');
                                            } else if (!allWithinSlotBounds) {
                                                toast.error(`All practitioner times must be within the slot boundaries (${slotStartTime} - ${slotEndTime}).`);
                                            }
                                        }
                                    }}
                                    disabled={
                                        slotDivisions.length !== selectedPractitioners.length ||
                                        slotDivisions.some(sd => sd.durationMinutes === 0) ||
                                        slotDivisions.some(sd => {
                                            const slotStartTime = selectedSlotForDivision.time;
                                            const [slotHours, slotMinutes] = slotStartTime.split(':').map(Number);
                                            const slotEndMinutes = slotHours * 60 + slotMinutes + appointmentSessionDuration;
                                            const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
                                            return sd.startTime < slotStartTime || sd.endTime > slotEndTime || sd.startTime >= sd.endTime;
                                        })
                                    }
                                >
                                    Save Overlapping Schedule
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}

                <Toaster position="top-right" />
            </TooltipProvider>
        </>
    );
}

export default withAppLayout(CreateAppointment, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'New Appointment' }
    ]
});
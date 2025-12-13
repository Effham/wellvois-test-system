import React, { useState, useEffect, useRef, useMemo } from 'react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import CalendarBooking from '@/components/CalendarBooking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import {
    Calendar,
    Clock,
    ArrowRight,
    UserPlus,
    LogIn,
    Mail,
    Eye,
    EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useZodValidation } from '@/hooks/useZodValidation';
import { publicPortalLoginSchema, publicPortalRequestToJoinSchema, publicPortalWaitingListSchema } from '@/lib/validations';

interface Service {
    id: number;
    name: string;
    category: string;
    default_price: number;
    currency: string;
    delivery_modes: string[];
}

interface Practitioner {
    id: number;
    name: string;
    value: number;
    label: string;
}

interface Location {
    id: number;
    value: number;
    label: string;
    address: string;
    name: string;
    street_address: string;
    city: string;
    phone_number?: string;
}

interface Props {
    tenant: {
        id: string;
        company_name: string;
    };
    services: Record<string, Service[]>;
    serviceTypes: string[];
    allServices: Service[];
    allPractitioners: Practitioner[];
    practitionerServiceRelations: Record<number, number[]>;
    locations: Location[];
    appointmentSessionDuration: number;
    appointmentSettings: {
        advanceBookingHours: string;
        maxAdvanceBookingDays: string;
        allowSameDayBooking: boolean;
    };
    appearanceSettings?: {
        appearance_theme_color?: string;
        appearance_logo_path?: string;
        appearance_font_family?: string;
    };
    websiteSettings?: {
        navigation?: {
            items?: Array<{
                id: string;
                label: string;
                enabled: boolean;
                customLabel?: string;
                order: number;
            }>;
        };
        appearance?: any;
    };
}

interface AppointmentData {
    service_type: string;
    service_name: string;
    service_id: string;
    practitioner_id: string;
    location_id: string;
    mode: string;
    date_time_preference: string;
}

export default function BookAppointment({
    tenant,
    services,
    serviceTypes,
    allServices,
    allPractitioners,
    practitionerServiceRelations,
    locations,
    appointmentSessionDuration,
    appointmentSettings,
    appearanceSettings,
    websiteSettings
}: Props) {
    const [appointmentData, setAppointmentData] = useState<AppointmentData>({
        service_type: '',
        service_name: '',
        service_id: '',
        practitioner_id: '',
        location_id: '',
        mode: '',
        date_time_preference: '',
    });

    // Local state for filtered data (client-side filtering)
    const [filteredServices, setFilteredServices] = useState<Service[]>([]);
    const [filteredPractitioners, setFilteredPractitioners] = useState<Practitioner[]>([]);
    const [filteredModeOptions, setFilteredModeOptions] = useState<{ value: string; label: string }[]>([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [loadingPractitioners, setLoadingPractitioners] = useState(false);
    const [practitionerAvailability, setPractitionerAvailability] = useState<Record<string, { start_time: string; end_time: string }[]>>({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [existingAppointments, setExistingAppointments] = useState<Array<{datetime: string; date: string; time: string; appointment_id?: string; status?: string; mode?: string; location_id?: number; duration?: number}>>([]);
    const [processing, setProcessing] = useState(false);
    
    // Track the last fetched parameters to prevent unnecessary API calls
    const [lastFetchParams, setLastFetchParams] = useState<{
        practitioner_ids: number[];
        location_id: string;
        mode: string;
    }>({ practitioner_ids: [], location_id: '', mode: '' });
    
    // Modal states
    const [showUserChoiceModal, setShowUserChoiceModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showSessionConflictModal, setShowSessionConflictModal] = useState(false);
    const [sessionConflictMessage, setSessionConflictMessage] = useState('');
    const [showWaitingListModal, setShowWaitingListModal] = useState(false);
    const [waitingListDay, setWaitingListDay] = useState('');
    const [waitingListTime, setWaitingListTime] = useState('');
    const [waitingListProcessing, setWaitingListProcessing] = useState(false);
    const [selectedWaitingListPrefs, setSelectedWaitingListPrefs] = useState<{day: string, time: string} | null>(null);
    const [waitingListValidationErrors, setWaitingListValidationErrors] = useState<Record<string, string>>({});
    const { validate: validateWaitingList } = useZodValidation(publicPortalWaitingListSchema);
    const [showRequestToJoinModal, setShowRequestToJoinModal] = useState(false);
    const [requestToJoinData, setRequestToJoinData] = useState({
        name: '',
        email: '',
        healthCardNumber: ''
    });
    const [requestToJoinProcessing, setRequestToJoinProcessing] = useState(false);
    const [requestToJoinValidationErrors, setRequestToJoinValidationErrors] = useState<Record<string, string>>({});
    const { validate: validateRequestToJoin } = useZodValidation(publicPortalRequestToJoinSchema);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [loginProcessing, setLoginProcessing] = useState(false);
    const [loginValidationErrors, setLoginValidationErrors] = useState<Record<string, string>>({});
    const { validate: validateLogin } = useZodValidation(publicPortalLoginSchema);
    const [email, setEmail] = useState('');

    // Ref for calendar booking component
    const calendarRef = useRef<HTMLDivElement>(null);

    // Only track visits on page load (no automatic toasts)
    useEffect(() => {
        // Just create the localStorage visit tracking for current domain
        const currentDomain = window.location.host;
        const timestamp = Date.now();
        const visitKey = `wellovis_visit_${currentDomain}`;
        
        localStorage.setItem(visitKey, JSON.stringify({
            domain: currentDomain,
            timestamp: timestamp
        }));
        
        console.log('📍 Logged visit to:', currentDomain);
    }, []); // Run once on mount

    const formatPrice = (price: number, currency: string) => {
        if (!price || isNaN(price) || price <= 0) return 'Contact for pricing';
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
        });
        return formatter.format(price);
    };

    // Initialize filtered data based on current form state
    useEffect(() => {
        if (appointmentData.service_type) {
            const services = allServices.filter((service) => service.category === appointmentData.service_type);
            setFilteredServices(services);

            // If service_name is also set, update mode options
            if (appointmentData.service_name) {
                const selectedService = services.find((s) => s.name === appointmentData.service_name);
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

        if (appointmentData.service_id) {
            const serviceId = parseInt(appointmentData.service_id);
            const practitioners = allPractitioners.filter((practitioner) => {
                const serviceIds = practitionerServiceRelations[practitioner.id] || [];
                return serviceIds.includes(serviceId);
            });
            setFilteredPractitioners(practitioners);
        }
    }, [appointmentData.service_type, appointmentData.service_id, appointmentData.service_name, allServices, allPractitioners, practitionerServiceRelations]);

    // Memoize existingAppointments to prevent unnecessary re-renders
    const memoizedExistingAppointments = useMemo(() => {
        console.log(`🔍 PUBLIC PORTAL: existingAppointments memoization check:`, existingAppointments.length, existingAppointments);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        return existingAppointments;
    }, [JSON.stringify(existingAppointments)]);

    // Debug existing appointments changes
    useEffect(() => {
        console.log(`🔍 PUBLIC PORTAL: memoizedExistingAppointments changed:`, memoizedExistingAppointments.length, memoizedExistingAppointments);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    }, [memoizedExistingAppointments]);

    // Fetch practitioner availability when practitioner_id, location_id, or mode changes
    useEffect(() => {
        const fetchPractitionerAvailability = async () => {
            const { practitioner_id, location_id, mode } = appointmentData;

            // Use single practitioner (public portal only allows one practitioner selection)
            const practitionersToCheck = practitioner_id ? [parseInt(practitioner_id)] : [];

            // Check if parameters have actually changed to prevent unnecessary API calls
            const currentParams = {
                practitioner_ids: practitionersToCheck.sort(),
                location_id: location_id || '',
                mode: mode || ''
            };
            
            const paramsChanged = (
                JSON.stringify(currentParams.practitioner_ids) !== JSON.stringify(lastFetchParams.practitioner_ids.sort()) ||
                currentParams.location_id !== lastFetchParams.location_id ||
                currentParams.mode !== lastFetchParams.mode
            );

            // Only fetch availability if mode is selected and parameters have changed
            // Practitioner is optional, so we can fetch availability even without a specific practitioner
            if (mode && (mode === 'virtual' || mode === 'hybrid' || (mode === 'in-person' && location_id)) && paramsChanged) {
                setLoadingAvailability(true);
                // Don't clear existing appointments immediately - keep them until we get new data
                try {
                    const response = await fetch(route('public-portal.practitioner-availability'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                        },
                        body: JSON.stringify({
                            practitioner_id: practitionersToCheck.length === 1 ? practitionersToCheck[0] : undefined,
                            practitioner_ids: practitionersToCheck.length > 1 ? practitionersToCheck : undefined,
                            service_id: appointmentData.service_id,
                            location_id: mode === 'in-person' ? location_id : null,
                            mode,
                        }),
                    });

                    const responseData = await response.json();

                    if (response.ok && responseData.availability) {
                        setPractitionerAvailability(responseData.availability);
                        setExistingAppointments(responseData.existingAppointments || []);
                        // Update last fetch params to prevent unnecessary re-fetching
                        setLastFetchParams(currentParams);
                    } else {
                        // Only clear on error after API call completes
                        setPractitionerAvailability({});
                        setExistingAppointments([]);
                        toast.error(responseData.error || 'Failed to fetch practitioner availability');
                    }
                } catch (error) {
                    console.error('Error fetching practitioner availability:', error);
                    // Only clear on error after API call completes
                    setPractitionerAvailability({});
                    setExistingAppointments([]);
                    toast.error('Failed to fetch practitioner availability');
                } finally {
                    setLoadingAvailability(false);
                }
            } else if (mode && (mode === 'virtual' || mode === 'hybrid' || (mode === 'in-person' && location_id)) && !paramsChanged) {
                // Parameters haven't changed, no need to fetch - keep existing data
                console.log('📋 Skipping API call - parameters unchanged:', currentParams);
            } else {
                // Only clear when conditions are not met (no mode selected, etc.)
                setPractitionerAvailability({});
                setExistingAppointments([]);
                setLastFetchParams({ practitioner_ids: [], location_id: '', mode: '' });
            }
        };

        fetchPractitionerAvailability();
    }, [appointmentData.practitioner_id, appointmentData.location_id, appointmentData.mode]);

    // Handle service type selection (client-side filtering)
    const handleServiceTypeChange = (serviceType: string) => {
        setAppointmentData(prev => ({
            ...prev,
            service_type: serviceType,
            service_name: '', // Reset dependent fields
            service_id: '',
            practitioner_id: '',
            mode: '', // Reset mode when service type changes
            location_id: '', // Reset location when service type changes
            date_time_preference: '', // Reset date and time preference
        }));
        setFilteredPractitioners([]); // Clear practitioners
        setFilteredModeOptions([]); // Clear mode options

        if (serviceType) {
            setLoadingServices(true);

            // Simulate brief loading for UX (client-side filtering is instant)
            setTimeout(() => {
                const services = allServices.filter((service) => service.category === serviceType);
                setFilteredServices(services);
                setLoadingServices(false);
            }, 100); // Very brief loading simulation
        } else {
            setFilteredServices([]);
        }
    };
    
    // Handle service name selection (client-side filtering)
    const handleServiceNameChange = (serviceName: string) => {
        const selectedService = filteredServices.find((s) => s.name === serviceName);

        setAppointmentData(prev => ({
            ...prev,
            service_name: serviceName,
            service_id: selectedService?.id.toString() || '',
            practitioner_id: '', // Reset practitioner
            mode: '', // Reset mode when service changes
            location_id: '', // Reset location when service changes
            date_time_preference: '', // Reset date and time preference
        }));

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
                const practitioners = allPractitioners.filter((practitioner) => {
                    const serviceIds = practitionerServiceRelations[practitioner.id] || [];
                    return serviceIds.includes(serviceId);
                });
                setFilteredPractitioners(practitioners);
                setLoadingPractitioners(false);
            }, 100); // Very brief loading simulation
        } else {
            setFilteredPractitioners([]);
            setFilteredModeOptions([]);
        }
    };

    // Reset all forms and states
    const resetAllForms = () => {
        setAppointmentData({
            service_type: '',
            service_name: '',
            service_id: '',
            practitioner_id: '',
            location_id: '',
            mode: '',
            date_time_preference: '',
        });

        // Clear localStorage
        localStorage.removeItem('appointment_booking_data');
        
        // Reset filtered data
        setFilteredServices([]);
        setFilteredPractitioners([]);
        setFilteredModeOptions([]);
        setPractitionerAvailability({});
        setExistingAppointments([]);
    };





    // Clear all booking data on every page load to ensure fresh start
    useEffect(() => {
        // Clear booking session data on every page load/reload
        localStorage.removeItem('public_portal_booking');
    }, []);

    // Handle opening waiting list modal
    const handleJoinWaitingList = () => {
        setShowWaitingListModal(true);
    };

    // Handle waiting list submission - store preferences instead of API call
    const handleWaitingListSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Zod validation
        const result = validateWaitingList({ day: waitingListDay, time: waitingListTime });
        if (!result.success) {
            setWaitingListValidationErrors(result.errors);
            toast.error('Please select both day and time preference.');
            return;
        }

        setWaitingListValidationErrors({});
        // Store the selected preferences
        setSelectedWaitingListPrefs({
            day: waitingListDay,
            time: waitingListTime
        });

        // Close modal and clear form
        setShowWaitingListModal(false);
        setWaitingListDay('');
        setWaitingListTime('');

        toast.success('Preferences saved! Please continue to registration to join the waiting list.');
    };

    // Handle request to join submission
    const handleRequestToJoinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Zod validation
        const result = validateRequestToJoin(requestToJoinData);
        if (!result.success) {
            setRequestToJoinValidationErrors(result.errors);
            toast.error('Please fill in all fields correctly.');
            return;
        }

        setRequestToJoinValidationErrors({});
        setRequestToJoinProcessing(true);

        try {
            const response = await fetch(route('public-portal.request-to-join'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name: requestToJoinData.name,
                    email: requestToJoinData.email,
                    health_card_number: requestToJoinData.healthCardNumber,
                    tenant_id: tenant.id, // Add tenant ID
                }),
            });

            const responseData = await response.json();

            if (response.ok && responseData.success) {
                toast.success(responseData.message || 'Request sent successfully! The clinic will contact you soon.');
                setShowRequestToJoinModal(false);
                setShowSessionConflictModal(false);
                setRequestToJoinData({ name: '', email: '', healthCardNumber: '' });
            } else {
                toast.error(responseData.message || 'Failed to send request. Please try again.');
            }
        } catch (error) {
            console.error('Error sending request to join:', error);
            toast.error('Failed to send request. Please try again.');
        } finally {
            setRequestToJoinProcessing(false);
        }
    };


    const checkPatientExists = async (email: string) => {
        try {
            const response = await fetch(route('public-portal.check-patient-exists'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    tenant_id: tenant.id,
                }),
                credentials: 'include',
            });

            const responseData = await response.json();

            if (response.ok) {
                return {
                    exists: responseData.exists,
                    patient_id: responseData.patient_id,
                    error: null,
                    success: true,
                };
            } else {
                return {
                    exists: false,
                    patient_id: null,
                    error: responseData.error || 'Failed to check patient existence',
                    success: false,
                };
            }
        } catch (error) {
            console.error('Error checking patient existence:', error);
            return {
                exists: false,
                patient_id: null,
                error: 'Network error while checking patient existence',
                success: false,
            };
        }
    };


// In BookAppointment.tsx or the component handling the login

const handleLoginSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();

    // Zod validation
    const result = validateLogin({ email: loginEmail, password: loginPassword });
    if (!result.success) {
        setLoginValidationErrors(result.errors);
        toast.error('Please fix the validation errors.');
        return;
    }

    setLoginValidationErrors({});
    setLoginProcessing(true);

    try {
        const response = await fetch(route('public-portal.login-and-book'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                email: loginEmail.trim(),
                password: loginPassword.trim(),
                tenant_id: tenant.id,
                service_type: appointmentData.service_type,
                service_name: appointmentData.service_name,
                service_id: appointmentData.service_id,
                location_id: appointmentData.location_id || null,
                mode: appointmentData.mode,
                date_time_preference: appointmentData.date_time_preference,
                practitioner_ids: appointmentData.practitioner_id ? [parseInt(appointmentData.practitioner_id)] : [],
                // Include waiting list data if present
                ...(selectedWaitingListPrefs && {
                    is_waiting_list: true,
                    waiting_list_day: selectedWaitingListPrefs.day,
                    waiting_list_time: selectedWaitingListPrefs.time
                })
            }),
            credentials: 'include',
        });

        const responseData = await response.json();

        if (response.ok && responseData.success) {
            toast.success(responseData.message || 'Login successful! Redirecting to your dashboard...');

            localStorage.setItem('from_public_portal', 'true');
            localStorage.setItem('patient_id', responseData.patient_id?.toString() || '');
            localStorage.setItem('login_timestamp', new Date().toISOString());

            if (responseData.appointment_id) {
                localStorage.setItem('appointment_id', responseData.appointment_id.toString());
            }

            localStorage.removeItem('appointment_booking_data');

            setShowLoginModal(false);
            setLoginEmail('');
            setLoginPassword('');
            setShowLoginPassword(false);
            
            // Wait for a short duration to ensure cookies are set before redirecting
            setTimeout(() => {
                window.location.href = responseData.redirect_url;
            }, 500); // A 500ms delay is usually sufficient and provides a good user experience.

        } else {
            if (responseData.action === 'patient_not_linked') {
                setSessionConflictMessage(responseData.message);
                setShowLoginModal(false);
                setShowSessionConflictModal(true);
            } else if (responseData.action === 'role_conflict') {
                setLogoutMessage(responseData.message);
                setShowLoginModal(false);
                setShowLogoutRequiredModal(true);
            } else {
                toast.error(responseData.message || 'Login failed. Please check your credentials and try again.');
            }
        }
    } catch (error) {
        console.error('Error during login:', error);
        toast.error('Login failed due to a network error. Please try again.');
    } finally {
        setLoginProcessing(false);
    }
};


    // Enhanced handleExistingUserLogin function with optional pre-validation
    const handleExistingUserLogin = async () => {
        setShowUserChoiceModal(false);
        setShowLoginModal(true);
        
        // Optional: If user has already entered email somewhere, we could pre-validate
        // For now, just show the login modal
    };

    // Updated handleNewUserRegistration function
    const handleNewUserRegistration = async () => {
        setShowUserChoiceModal(false);

        const isWaitingListFlow = selectedWaitingListPrefs !== null;

        // Store appointment data in localStorage for later use
        const bookingData = {
            ...appointmentData,
            practitioner_ids: appointmentData.practitioner_id ? [parseInt(appointmentData.practitioner_id)] : [],
            tenant_id: tenant.id,
            ...(isWaitingListFlow && {
                waiting_list_preferences: selectedWaitingListPrefs,
                is_waiting_list: true
            })
        };

        localStorage.setItem('appointment_booking_data', JSON.stringify(bookingData));

        // Redirect to registration page with appointment data as query parameters
        const appointmentParams = new URLSearchParams({
            service_type: appointmentData.service_type,
            service_name: appointmentData.service_name,
            service_id: appointmentData.service_id,
            location_id: appointmentData.location_id || '',
            mode: appointmentData.mode,
            date_time_preference: appointmentData.date_time_preference || '',
            practitioner_ids: appointmentData.practitioner_id || '',
            tenant_id: tenant.id,
            ...(isWaitingListFlow && {
                is_waiting_list: 'true',
                waiting_list_day: selectedWaitingListPrefs.day,
                waiting_list_time: selectedWaitingListPrefs.time
            })
        });

        // Redirect to registration page
        window.location.href = route('public-portal.register') + '?' + appointmentParams.toString();
    };

const handleNext = async () => {
    // Validate appointment details
    if (!appointmentData.service_type || !appointmentData.service_name || !appointmentData.mode) {
        toast.error('Please fill in all appointment details.');
        return;
    }
    if (appointmentData.mode === 'in-person' && !appointmentData.location_id) {
        toast.error('Please select a location for in-person appointments.');
        return;
    }

    // Check if this is a waiting list flow or regular appointment flow
    const isWaitingListFlow = selectedWaitingListPrefs !== null;

    if (!isWaitingListFlow && !appointmentData.date_time_preference) {
        toast.error('Please select a date and time for your appointment.');
        return;
    }

    // Store appointment data in localStorage for later use
    const bookingData = {
        ...appointmentData,
        practitioner_ids: appointmentData.practitioner_id ? [parseInt(appointmentData.practitioner_id)] : [],
        tenant_id: tenant.id,
        // Include waiting list preferences if this is a waiting list flow
        ...(isWaitingListFlow && {
            waiting_list_preferences: selectedWaitingListPrefs,
            is_waiting_list: true
        })
    };

    localStorage.setItem('appointment_booking_data', JSON.stringify(bookingData));

    // Show user choice modal for login or registration
    // Note: The layout handles blocking admin/practitioner sessions with a mandatory logout modal
    setShowUserChoiceModal(true);
};


    // Helper function to clear all login-related state
    const clearLoginState = () => {
        setLoginEmail('');
        setLoginPassword('');
        setShowLoginPassword(false);
        setEmail('');
        setShowLoginModal(false);
        setShowSessionConflictModal(false);
        setSessionConflictMessage('');
    };

    // Enhanced modal close handlers with proper cleanup
    const handleLoginModalClose = () => {
        if (!loginProcessing) {
            clearLoginState();
        }
    };

    const handleSessionConflictModalClose = () => {
        setShowSessionConflictModal(false);
        setSessionConflictMessage('');
        // Don't clear login email/password in case user wants to retry
    };

    return (
        <TooltipProvider>
            <PublicPortalLayout
                title="Book Appointment"
                tenant={tenant}
                appearanceSettings={appearanceSettings}
                websiteSettings={websiteSettings}
                requireLogout={true}
                redirectAfterLogout={route('public-portal.book-appointment')}
            >
                <div className="py-12">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <div></div> {/* Spacer for center alignment */}
                                <h1 className="text-3xl font-bold text-foreground">
                                    Book an Appointment
                                </h1>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={resetAllForms}
                                    className="text-xs"
                                >
                                    Start New Booking
                                </Button>
                            </div>
                            <p className="text-xl text-muted-foreground">
                                Schedule your appointment with {tenant.company_name}
                            </p>
                        </div>

                        <div className="space-y-8">
                            {/* Appointment Details */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Appointment Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Row 1: Service Type, Service Name, Mode */}
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                        {/* Service Type */}
                                        <div className="space-y-2">
                                            <Label htmlFor="service_type">
                                                Service Type <span className="text-red-500">*</span>
                                            </Label>
                                            <Select value={appointmentData.service_type} onValueChange={handleServiceTypeChange}>
                                                <SelectTrigger className="placeholder:text-gray-400">
                                                    <SelectValue placeholder="Select Service Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {serviceTypes.map((type) => (
                                                        <SelectItem key={type} value={type}>
                                                            {type}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Service Name */}
                                        <div className="space-y-2">
                                            <Label htmlFor="service_name">
                                                Service <span className="text-red-500">*</span>
                                            </Label>
                                            <Select
                                                value={appointmentData.service_name}
                                                onValueChange={handleServiceNameChange}
                                                disabled={loadingServices || filteredServices.length === 0}
                                            >
                                                <SelectTrigger className="placeholder:text-gray-400">
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
                                                            <div className="flex justify-between items-center w-full">
                                                                <span>{service.name}</span>
                                                                {service.default_price && !isNaN(service.default_price) && service.default_price > 0 && (
                                                                    <span className="text-sm text-muted-foreground ml-2">
                                                                        {formatPrice(service.default_price, service.currency)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Mode */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mode">
                                                Mode <span className="text-red-500">*</span>
                                            </Label>
                                            <Select
                                                value={appointmentData.mode}
                                                onValueChange={(value) => {
                                                    setAppointmentData(prev => ({
                                                        ...prev,
                                                        mode: value,
                                                        location_id: '',
                                                        practitioner_id: '',
                                                        date_time_preference: '',
                                                    }));
                                                    // Scroll to calendar after a brief delay to allow rendering
                                                    setTimeout(() => {
                                                        if (calendarRef.current) {
                                                            calendarRef.current.scrollIntoView({
                                                                behavior: 'smooth',
                                                                block: 'center',
                                                            });
                                                        }
                                                    }, 100);
                                                }}
                                                disabled={filteredModeOptions.length === 0}
                                            >
                                                <SelectTrigger className="placeholder:text-gray-400">
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
                                        </div>
                                    </div>

                                    {/* Row 2: Location, Practitioners */}
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                        {/* Location - Always visible but conditionally disabled */}
                                        <div className="space-y-2">
                                            <Label htmlFor="location_id">
                                                Location {appointmentData.mode === 'in-person' && <span className="text-red-500">*</span>}
                                                {appointmentData.mode === 'virtual' && <span className="text-gray-500">(optional)</span>}
                                                {appointmentData.mode === 'hybrid' && <span className="text-gray-500">(optional)</span>}
                                            </Label>
                                            {appointmentData.mode === 'virtual' || appointmentData.mode === 'hybrid' || !appointmentData.mode ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div>
                                                            <Select
                                                                value={appointmentData.location_id}
                                                                onValueChange={(value) => {
                                                                    setAppointmentData(prev => ({
                                                                        ...prev,
                                                                        location_id: value,
                                                                        practitioner_id: '',
                                                                        date_time_preference: '',
                                                                    }));
                                                                }}
                                                                disabled={appointmentData.mode !== 'in-person'}
                                                            >
                                                                <SelectTrigger
                                                                    className={`placeholder:text-gray-400 ${appointmentData.mode !== 'in-person' ? 'cursor-not-allowed opacity-50' : ''}`}
                                                                >
                                                                    <SelectValue
                                                                        placeholder={
                                                                            appointmentData.mode === 'virtual'
                                                                                ? 'Not required for virtual appointments'
                                                                                : appointmentData.mode === 'hybrid'
                                                                                    ? 'Not required for hybrid appointments'
                                                                                    : !appointmentData.mode
                                                                                        ? 'Select mode first'
                                                                                        : 'Select Location'
                                                                        }
                                                                    />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {locations.map((location) => (
                                                                        <SelectItem key={location.id} value={location.id.toString()}>
                                                                            {location.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {appointmentData.mode === 'virtual' && <p>Location is not required for virtual appointments</p>}
                                                        {appointmentData.mode === 'hybrid' && <p>Location is not required for hybrid appointments</p>}
                                                        {!appointmentData.mode && <p>Please select a mode first</p>}
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <Select
                                                    value={appointmentData.location_id}
                                                    onValueChange={(value) => {
                                                        setAppointmentData(prev => ({
                                                            ...prev,
                                                            location_id: value,
                                                            practitioner_id: '',
                                                            date_time_preference: '',
                                                        }));
                                                    }}
                                                    disabled={appointmentData.mode !== 'in-person'}
                                                >
                                                    <SelectTrigger className="placeholder:text-gray-400">
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

                                        {/* Practitioner (Single-select) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="practitioner_id">
                                                Practitioner <span className="text-gray-500">(optional)</span>
                                            </Label>
                                            <Select
                                                value={appointmentData.practitioner_id}
                                                onValueChange={(value) => {
                                                    setAppointmentData(prev => ({
                                                        ...prev,
                                                        practitioner_id: value,
                                                        date_time_preference: '', // Reset date selection when practitioner changes
                                                    }));
                                                }}
                                                disabled={
                                                    loadingPractitioners ||
                                                    filteredPractitioners.length === 0 ||
                                                    (appointmentData.mode === 'in-person' && !appointmentData.location_id)
                                                }
                                            >
                                                <SelectTrigger className="placeholder:text-gray-400">
                                                    <SelectValue
                                                        placeholder={
                                                            loadingPractitioners
                                                                ? 'Loading practitioners...'
                                                                : filteredPractitioners.length === 0 && appointmentData.service_name
                                                                    ? 'No practitioners available for this service'
                                                                    : !appointmentData.service_name
                                                                        ? 'Select service first'
                                                                        : appointmentData.mode === 'in-person' && !appointmentData.location_id
                                                                            ? 'Select location first for in-person appointments'
                                                                            : 'Select practitioner (optional)'
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filteredPractitioners.map((practitioner) => (
                                                        <SelectItem key={practitioner.id} value={practitioner.id.toString()}>
                                                            {practitioner.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Calendar Booking Interface */}
                                    {appointmentData.mode && (
                                        <div className="mt-8 space-y-6">
                                            <Label className="text-base font-medium">
                                                Date & Time <span className="text-red-500">*</span>
                                            </Label>
                                            <CalendarBooking
                                                ref={calendarRef}
                                                selectedDateTime={appointmentData.date_time_preference}
                                                onDateTimeSelect={(dateTime) => {
                                                    setAppointmentData(prev => ({ ...prev, date_time_preference: dateTime }));
                                                }}
                                                practitionerId={appointmentData.practitioner_id}
                                                serviceId={appointmentData.service_id}
                                                practitionerAvailability={practitionerAvailability}
                                                loadingAvailability={loadingAvailability}
                                                appointmentSessionDuration={appointmentSessionDuration}
                                                appointmentSettings={appointmentSettings}
                                                existingAppointments={memoizedExistingAppointments}
                                                showConflicts={false}
                                                publicPortal={true}
                                                onJoinWaitingList={handleJoinWaitingList}
                                            />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Waiting List Preferences Display */}
                            {selectedWaitingListPrefs && (
                                <Card className="border-blue-200 bg-blue-50">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 rounded-full">
                                                    <Clock className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-blue-900">Waiting List Preferences</h3>
                                                    <p className="text-sm text-blue-700">
                                                        Preferred Day: <span className="font-medium capitalize">{selectedWaitingListPrefs.day === 'any' ? 'Any Day' : selectedWaitingListPrefs.day}</span>
                                                        {' • '}
                                                        Preferred Time: <span className="font-medium capitalize">{selectedWaitingListPrefs.time === 'any' ? 'Any Time' : selectedWaitingListPrefs.time}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedWaitingListPrefs(null)}
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                            >
                                                Change
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Continue Button */}
                            <div className="flex justify-center">
                                <Button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={processing}
                                    size="lg"
                                    className="min-w-48"
                                >
                                    Continue
                                    <ArrowRight className="h-4 w-4 " />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Choice Modal */}
                <Dialog open={showUserChoiceModal} onOpenChange={setShowUserChoiceModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Complete Your Appointment</DialogTitle>
                            <DialogDescription>
                                To book your appointment, you can either create a new account or login with an existing account.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col space-y-4 pt-4">
                            <Button 
                                onClick={handleNewUserRegistration}
                                size="lg" 
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <UserPlus className="h-4 w-4" />
                                Create New Account
                            </Button>
                            <Button 
                                onClick={handleExistingUserLogin}
                                variant="outline" 
                                size="lg" 
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <LogIn className="h-4 w-4" />
                                Login with Existing Account
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Login Modal */}
                <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Login to Book Appointment
                            </DialogTitle>
                            <DialogDescription>
                                Enter your credentials to login and book your appointment.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleLoginSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="login_email">Email Address</Label>
                                <Input
                                    id="login_email"
                                    type="email"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    placeholder="Enter your email address"
                                    required
                                    disabled={loginProcessing}
                                />
                                {loginValidationErrors.email && <p className="text-sm text-red-500">{loginValidationErrors.email}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="login_password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="login_password"
                                        type={showLoginPassword ? "text" : "password"}
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        disabled={loginProcessing}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                                        disabled={loginProcessing}
                                    >
                                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {loginValidationErrors.password && <p className="text-sm text-red-500">{loginValidationErrors.password}</p>}
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowLoginModal(false);
                                        setLoginEmail('');
                                        setLoginPassword('');
                                        setShowLoginPassword(false);
                                    }}
                                    disabled={loginProcessing}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loginProcessing}>
                                    {loginProcessing ? 'Logging in...' : 'Login & Book'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Session Conflict Modal */}
                <Dialog open={showSessionConflictModal} onOpenChange={setShowSessionConflictModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <LogIn className="h-5 w-5" />
                                Login Error
                            </DialogTitle>
                            <DialogDescription>
                                {sessionConflictMessage}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-center pt-4">
                            <Button
                                type="button"
                                onClick={() => {
                                    setShowSessionConflictModal(false);
                                    setSessionConflictMessage('');
                                    setShowRequestToJoinModal(true);
                                }}
                            >
                                Request to Join
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Waiting List Modal */}
                <Dialog open={showWaitingListModal} onOpenChange={setShowWaitingListModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Join Waiting List
                            </DialogTitle>
                            <DialogDescription>
                                All slots are currently booked. Join our waiting list and we'll contact you when a slot becomes available.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleWaitingListSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="waiting_list_day">Preferred Day</Label>
                                <Select value={waitingListDay} onValueChange={setWaitingListDay} disabled={waitingListProcessing}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select preferred day" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monday">Monday</SelectItem>
                                        <SelectItem value="tuesday">Tuesday</SelectItem>
                                        <SelectItem value="wednesday">Wednesday</SelectItem>
                                        <SelectItem value="thursday">Thursday</SelectItem>
                                        <SelectItem value="friday">Friday</SelectItem>
                                        <SelectItem value="saturday">Saturday</SelectItem>
                                        <SelectItem value="sunday">Sunday</SelectItem>
                                        <SelectItem value="any">Any Day</SelectItem>
                                    </SelectContent>
                                </Select>
                                {waitingListValidationErrors.day && <p className="text-sm text-red-500">{waitingListValidationErrors.day}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="waiting_list_time">Preferred Time</Label>
                                <Select value={waitingListTime} onValueChange={setWaitingListTime} disabled={waitingListProcessing}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select preferred time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="morning">Morning (5AM - 12PM)</SelectItem>
                                        <SelectItem value="afternoon">Afternoon (12PM - 5PM)</SelectItem>
                                        <SelectItem value="evening">Evening (5PM - 11PM)</SelectItem>
                                        <SelectItem value="any">Any Time</SelectItem>
                                    </SelectContent>
                                </Select>
                                {waitingListValidationErrors.time && <p className="text-sm text-red-500">{waitingListValidationErrors.time}</p>}
                            </div>
                            <DialogFooter className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowWaitingListModal(false);
                                        setWaitingListDay('');
                                        setWaitingListTime('');
                                    }}
                                    disabled={waitingListProcessing}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={waitingListProcessing} className="flex-1">
                                    {waitingListProcessing ? 'Joining...' : 'Join Waiting List'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Request to Join Modal */}
                <Dialog open={showRequestToJoinModal} onOpenChange={setShowRequestToJoinModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <UserPlus className="h-5 w-5" />
                                Request to Join
                            </DialogTitle>
                            <DialogDescription>
                                Please provide your details and we'll send your registration request to the clinic. They will contact you to complete the process.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleRequestToJoinSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="request_name">Full Name</Label>
                                <Input
                                    id="request_name"
                                    type="text"
                                    value={requestToJoinData.name}
                                    onChange={(e) => setRequestToJoinData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter your full name"
                                    required
                                    disabled={requestToJoinProcessing}
                                />
                                {requestToJoinValidationErrors.name && <p className="text-sm text-red-500">{requestToJoinValidationErrors.name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request_email">Email Address</Label>
                                <Input
                                    id="request_email"
                                    type="email"
                                    value={requestToJoinData.email}
                                    onChange={(e) => setRequestToJoinData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="Enter your email address"
                                    required
                                    disabled={requestToJoinProcessing}
                                />
                                {requestToJoinValidationErrors.email && <p className="text-sm text-red-500">{requestToJoinValidationErrors.email}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="request_health_card">Health Card Number</Label>
                                <Input
                                    id="request_health_card"
                                    type="text"
                                    value={requestToJoinData.healthCardNumber}
                                    onChange={(e) => setRequestToJoinData(prev => ({ ...prev, healthCardNumber: e.target.value }))}
                                    placeholder="Enter your health card number"
                                    required
                                    disabled={requestToJoinProcessing}
                                />
                                {requestToJoinValidationErrors.healthCardNumber && <p className="text-sm text-red-500">{requestToJoinValidationErrors.healthCardNumber}</p>}
                            </div>
                            <DialogFooter className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowRequestToJoinModal(false);
                                        setRequestToJoinData({ name: '', email: '', healthCardNumber: '' });
                                    }}
                                    disabled={requestToJoinProcessing}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={requestToJoinProcessing} className="flex-1">
                                    {requestToJoinProcessing ? 'Sending...' : 'Send Request'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Toaster position="top-right" />
            </PublicPortalLayout>
        </TooltipProvider>
    );
}
import React, { useState, useEffect, useRef, useMemo } from 'react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import CalendarBooking from '@/components/CalendarBooking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    User,
    MapPin,
    Video,
    Home,
    DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { useZodValidation } from '@/hooks/useZodValidation';
import { publicPortalLoginSchema, publicPortalRequestToJoinSchema, publicPortalWaitingListSchema } from '@/lib/validations';
import { router } from '@inertiajs/react';

interface Service {
    id: number;
    name: string;
    category: string;
    description?: string;
    delivery_modes: string[];
    price: number;
    currency: string;
    duration_minutes?: number;
}

interface Practitioner {
    id: number;
    first_name: string;
    slug: string;
    last_name: string;
    title?: string;
    full_name: string;
    display_name: string;
    credentials?: string[];
    profile_picture_path?: string;
    services?: Service[];
    session_types?: string[];
    hourly_rate_min?: number;
    hourly_rate_max?: number;
}

interface Location {
    id: number;
    value: number;
    label: string;
    address: string;
    name: string;
}

interface Props {
    tenant: {
        id: string;
        company_name: string;
    };
    practitioner: Practitioner;
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
    websiteSettings?: any;
}

interface AppointmentData {
    service_id: string;
    location_id: string;
    mode: string;
    date_time_preference: string;
}

const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

const getProfilePictureUrl = (path?: string) => {
    if (!path) return null;
    return `/storage/${path}`;
};

export default function BookPractitionerAppointment({
    tenant,
    practitioner,
    locations,
    appointmentSessionDuration,
    appointmentSettings,
    appearanceSettings,
    websiteSettings
}: Props) {
    const [appointmentData, setAppointmentData] = useState<AppointmentData>({
        service_id: '',
        location_id: '',
        mode: '',
        date_time_preference: '',
    });

    const [filteredModeOptions, setFilteredModeOptions] = useState<{ value: string; label: string }[]>([]);
    const [practitionerAvailability, setPractitionerAvailability] = useState<Record<string, { start_time: string; end_time: string }[]>>({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [existingAppointments, setExistingAppointments] = useState<Array<{datetime: string; date: string; time: string; appointment_id?: string; status?: string; mode?: string; location_id?: number; duration?: number}>>([]);
    const [processing, setProcessing] = useState(false);
    
    // Track the last fetched parameters to prevent unnecessary API calls
    const [lastFetchParams, setLastFetchParams] = useState<{
        practitioner_id: number;
        location_id: string;
        mode: string;
    }>({ practitioner_id: 0, location_id: '', mode: '' });
    
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

    // Ref for calendar booking component
    const calendarRef = useRef<HTMLDivElement>(null);

    // Memoize existingAppointments to prevent unnecessary re-renders
    const memoizedExistingAppointments = useMemo(() => {
        return existingAppointments;
    }, [JSON.stringify(existingAppointments)]);

    // Update mode options when service changes
    useEffect(() => {
        if (appointmentData.service_id && practitioner.services) {
            const selectedService = practitioner.services.find((s) => s.id.toString() === appointmentData.service_id);
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
    }, [appointmentData.service_id, practitioner.services]);

    // Fetch practitioner availability when location_id or mode changes
    useEffect(() => {
        const fetchPractitionerAvailability = async () => {
            const { service_id, location_id, mode } = appointmentData;

            // Check if parameters have actually changed to prevent unnecessary API calls
            const currentParams = {
                practitioner_id: practitioner.id,
                location_id: location_id || '',
                mode: mode || ''
            };
            
            const paramsChanged = (
                currentParams.practitioner_id !== lastFetchParams.practitioner_id ||
                currentParams.location_id !== lastFetchParams.location_id ||
                currentParams.mode !== lastFetchParams.mode
            );

            // Only fetch availability if mode is selected and parameters have changed
            if (mode && (mode === 'virtual' || mode === 'hybrid' || (mode === 'in-person' && location_id)) && paramsChanged) {
                setLoadingAvailability(true);
                try {
                    const response = await fetch(route('public-portal.practitioner-availability'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                        },
                        body: JSON.stringify({
                            practitioner_id: practitioner.id,
                            service_id: service_id || undefined,
                            location_id: mode === 'in-person' ? location_id : null,
                            mode,
                        }),
                    });

                    const responseData = await response.json();

                    if (response.ok && responseData.availability) {
                        setPractitionerAvailability(responseData.availability);
                        setExistingAppointments(responseData.existingAppointments || []);
                        setLastFetchParams(currentParams);
                    } else {
                        setPractitionerAvailability({});
                        setExistingAppointments([]);
                        toast.error(responseData.error || 'Failed to fetch practitioner availability');
                    }
                } catch (error) {
                    console.error('Error fetching practitioner availability:', error);
                    setPractitionerAvailability({});
                    setExistingAppointments([]);
                    toast.error('Failed to fetch practitioner availability');
                } finally {
                    setLoadingAvailability(false);
                }
            } else if (mode && (mode === 'virtual' || mode === 'hybrid' || (mode === 'in-person' && location_id)) && !paramsChanged) {
                console.log('📋 Skipping API call - parameters unchanged:', currentParams);
            } else {
                setPractitionerAvailability({});
                setExistingAppointments([]);
                setLastFetchParams({ practitioner_id: 0, location_id: '', mode: '' });
            }
        };

        fetchPractitionerAvailability();
    }, [appointmentData.location_id, appointmentData.mode, practitioner.id]);

    // Handle opening waiting list modal
    const handleJoinWaitingList = () => {
        setShowWaitingListModal(true);
    };

    // Handle waiting list submission
    const handleWaitingListSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const result = validateWaitingList({ day: waitingListDay, time: waitingListTime });
        if (!result.success) {
            setWaitingListValidationErrors(result.errors);
            toast.error('Please select both day and time preference.');
            return;
        }

        setWaitingListValidationErrors({});
        setSelectedWaitingListPrefs({
            day: waitingListDay,
            time: waitingListTime
        });

        setShowWaitingListModal(false);
        setWaitingListDay('');
        setWaitingListTime('');

        toast.success('Preferences saved! Please continue to registration to join the waiting list.');
    };

    // Handle request to join submission
    const handleRequestToJoinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
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
                    tenant_id: tenant.id,
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

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const result = validateLogin({ email: loginEmail, password: loginPassword });
        if (!result.success) {
            setLoginValidationErrors(result.errors);
            toast.error('Please fix the validation errors.');
            return;
        }

        setLoginValidationErrors({});
        setLoginProcessing(true);

        try {
            // Find the selected service
            const selectedService = practitioner.services?.find(s => s.id.toString() === appointmentData.service_id);

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
                    service_type: selectedService?.category || '',
                    service_name: selectedService?.name || '',
                    service_id: appointmentData.service_id,
                    location_id: appointmentData.location_id || null,
                    mode: appointmentData.mode,
                    date_time_preference: appointmentData.date_time_preference,
                    practitioner_ids: [practitioner.id],
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
                setShowLoginModal(false);
                setTimeout(() => {
                    window.location.href = responseData.redirect_url;
                }, 500);
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

    const handleExistingUserLogin = async () => {
        setShowUserChoiceModal(false);
        setShowLoginModal(true);
    };

    const handleNewUserRegistration = async () => {
        setShowUserChoiceModal(false);

        const isWaitingListFlow = selectedWaitingListPrefs !== null;
        const selectedService = practitioner.services?.find(s => s.id.toString() === appointmentData.service_id);

        const bookingData = {
            ...appointmentData,
            service_type: selectedService?.category || '',
            service_name: selectedService?.name || '',
            practitioner_ids: [practitioner.id],
            tenant_id: tenant.id,
            ...(isWaitingListFlow && {
                waiting_list_preferences: selectedWaitingListPrefs,
                is_waiting_list: true
            })
        };

        localStorage.setItem('appointment_booking_data', JSON.stringify(bookingData));

        const appointmentParams = new URLSearchParams({
            service_type: selectedService?.category || '',
            service_name: selectedService?.name || '',
            service_id: appointmentData.service_id,
            location_id: appointmentData.location_id || '',
            mode: appointmentData.mode,
            date_time_preference: appointmentData.date_time_preference || '',
            practitioner_ids: practitioner.id.toString(),
            tenant_id: tenant.id,
            ...(isWaitingListFlow && {
                is_waiting_list: 'true',
                waiting_list_day: selectedWaitingListPrefs.day,
                waiting_list_time: selectedWaitingListPrefs.time
            })
        });

        window.location.href = route('public-portal.register') + '?' + appointmentParams.toString();
    };

    const handleNext = async () => {
        if (!appointmentData.service_id || !appointmentData.mode) {
            toast.error('Please select a service and mode.');
            return;
        }
        if (appointmentData.mode === 'in-person' && !appointmentData.location_id) {
            toast.error('Please select a location for in-person appointments.');
            return;
        }

        const isWaitingListFlow = selectedWaitingListPrefs !== null;

        if (!isWaitingListFlow && !appointmentData.date_time_preference) {
            toast.error('Please select a date and time for your appointment.');
            return;
        }

        // Show user choice modal for login or registration
        // Note: The layout handles blocking admin/practitioner sessions with a mandatory logout modal
        setShowUserChoiceModal(true);
    };

    return (
        <PublicPortalLayout
            title={`Book with ${practitioner.display_name}`}
            tenant={tenant}
            appearanceSettings={appearanceSettings}
            websiteSettings={websiteSettings}
            requireLogout={true}
            redirectAfterLogout={route('public-portal.book-practitioner-appointment', practitioner.slug)}
        >
            <div className="py-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header with Practitioner Info */}
                    <div className="mb-8">
                        <Button
                            variant="ghost"
                            onClick={() => router.visit(`/explore/staff/${practitioner.slug}`)}
                            className="mb-4"
                        >
                            ← Back to Profile
                        </Button>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-6">
                                    <Avatar className="w-20 h-20 ring-2 ring-primary/20">
                                        <AvatarImage
                                            src={getProfilePictureUrl(practitioner.profile_picture_path) || undefined}
                                            alt={practitioner.full_name}
                                        />
                                        <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                                            {getInitials(practitioner.first_name, practitioner.last_name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <h1 className="text-2xl font-bold text-foreground">
                                            Book with {practitioner.display_name}
                                        </h1>
                                        {practitioner.credentials && practitioner.credentials.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {practitioner.credentials.map((credential, index) => (
                                                    <Badge key={index} variant="secondary" className="text-xs">
                                                        {credential}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                            {practitioner.session_types && practitioner.session_types.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    {practitioner.session_types.includes('Virtual') && (
                                                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                                            <Video className="h-3 w-3" />
                                                            Virtual
                                                        </Badge>
                                                    )}
                                                    {practitioner.session_types.includes('In-Person') && (
                                                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                                            <Home className="h-3 w-3" />
                                                            In-Person
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                            {(practitioner.hourly_rate_min && practitioner.hourly_rate_max) && (
                                                <div className="flex items-center gap-1">
                                                    <DollarSign className="h-4 w-4" />
                                                    <span>
                                                        {practitioner.hourly_rate_min === practitioner.hourly_rate_max 
                                                            ? `$${practitioner.hourly_rate_min}`
                                                            : `$${practitioner.hourly_rate_min} - $${practitioner.hourly_rate_max}`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Appointment Booking Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Appointment Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Service Selection */}
                            <div className="space-y-2">
                                <Label htmlFor="service">
                                    Select Service <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={appointmentData.service_id}
                                    onValueChange={(value) => {
                                        setAppointmentData(prev => ({
                                            ...prev,
                                            service_id: value,
                                            mode: '',
                                            location_id: '',
                                            date_time_preference: '',
                                        }));
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {practitioner.services && practitioner.services.map((service) => (
                                            <SelectItem key={service.id} value={service.id.toString()}>
                                                <div className="flex justify-between items-center w-full">
                                                    <span>{service.name}</span>
                                                    <span className="text-sm text-muted-foreground ml-4">
                                                        ${service.price} {service.currency}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {/* Mode Selection */}
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
                                                date_time_preference: '',
                                            }));
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
                                        <SelectTrigger>
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

                                {/* Location Selection */}
                                <div className="space-y-2">
                                    <Label htmlFor="location">
                                        Location {appointmentData.mode === 'in-person' && <span className="text-red-500">*</span>}
                                        {(appointmentData.mode === 'virtual' || appointmentData.mode === 'hybrid') && <span className="text-gray-500">(optional)</span>}
                                    </Label>
                                    <Select
                                        value={appointmentData.location_id}
                                        onValueChange={(value) => {
                                            setAppointmentData(prev => ({
                                                ...prev,
                                                location_id: value,
                                                date_time_preference: '',
                                            }));
                                        }}
                                        disabled={appointmentData.mode !== 'in-person'}
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    appointmentData.mode === 'virtual'
                                                        ? 'Not required for virtual'
                                                        : appointmentData.mode === 'hybrid'
                                                            ? 'Not required for hybrid'
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
                                        practitionerId={practitioner.id.toString()}
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
                        <Card className="border-blue-200 bg-blue-50 mt-6">
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
                    <div className="flex justify-center mt-8">
                        <Button
                            type="button"
                            onClick={handleNext}
                            disabled={processing}
                            size="lg"
                            className="min-w-48"
                        >
                            Continue
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modals (same as BookAppointment.tsx) */}
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
                            <input
                                id="login_email"
                                type="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="Enter your email address"
                                required
                                disabled={loginProcessing}
                                className="w-full px-3 py-2 border rounded-md"
                            />
                            {loginValidationErrors.email && <p className="text-sm text-red-500">{loginValidationErrors.email}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="login_password">Password</Label>
                            <div className="relative">
                                <input
                                    id="login_password"
                                    type={showLoginPassword ? "text" : "password"}
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    disabled={loginProcessing}
                                    className="w-full px-3 py-2 border rounded-md pr-10"
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
                        <div className="flex gap-2 justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowWaitingListModal(false);
                                    setWaitingListDay('');
                                    setWaitingListTime('');
                                }}
                                disabled={waitingListProcessing}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={waitingListProcessing}>
                                {waitingListProcessing ? 'Joining...' : 'Join Waiting List'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Toaster position="top-right" />
        </PublicPortalLayout>
    );
}
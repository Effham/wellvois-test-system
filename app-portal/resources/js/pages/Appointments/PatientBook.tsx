import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { withAppLayout } from '@/utils/layout';
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Calendar, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useZodValidation } from '@/hooks/useZodValidation';
import { appointmentSchema } from '@/lib/validations';
import CalendarBooking from '@/components/CalendarBooking';

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
}

interface PendingConsent {
    key: string;
    title: string;
    version_id: number;
    body: {
        heading?: string;
        description?: string;
        content?: string;
        checkbox_text?: string;
        important_notice?: string;
    };
}

interface Props {
    serviceTypes: string[];
    allServices: Service[];
    allPractitioners: Practitioner[];
    practitionerServiceRelations: Record<number, number[]>;
    locations: Location[];
    currentTab: string;
    appointmentSessionDuration: number;
    appointmentSettings: {
        advanceBookingHours: string;
        maxAdvanceBookingDays: string;
        allowSameDayBooking: boolean;
    };
    patientInfo: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        phone_number: string;
    };
    pendingConsents?: PendingConsent[];
    consentsRequired?: boolean;
    formData?: {
        service_type: string;
        service_name: string;
        service_id: string;
        practitioner_ids: number[];
        location_id: string;
        mode: string;
        date_time_preference: string;
    };
    errors?: any;
    flash?: {
        success?: string;
        error?: string;
    };
}

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '/appointments' },
    { title: 'Book Appointment', href: '' },
];

function PatientBookAppointment({
    serviceTypes,
    allServices,
    allPractitioners,
    practitionerServiceRelations,
    locations,
    currentTab,
    formData,
    errors = {},
    flash,
    appointmentSessionDuration,
    appointmentSettings,
    patientInfo,
    pendingConsents = [],
    consentsRequired = false,
}: Props) {
    const [activeTab, setActiveTab] = useState(currentTab || 'appointment-details');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Service/Practitioner filtering states
    const [filteredServices, setFilteredServices] = useState<Service[]>([]);
    const [filteredPractitioners, setFilteredPractitioners] = useState<Practitioner[]>([]);
    const [filteredModeOptions, setFilteredModeOptions] = useState<{ value: string; label: string }[]>([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [loadingPractitioners, setLoadingPractitioners] = useState(false);

    // Practitioner availability states
    const [practitionerAvailability, setPractitionerAvailability] = useState<Record<string, { start_time: string; end_time: string }[]>>({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [existingAppointments, setExistingAppointments] = useState<any[]>([]);

    // Consent checkbox states
    const [consentCheckboxes, setConsentCheckboxes] = useState<number[]>([]);

    // Form state
    const { data, setData, post, processing } = useForm({
        // Appointment Details
        service_type: formData?.service_type || '',
        service_name: formData?.service_name || '',
        service_id: formData?.service_id || '',
        practitioner_ids: formData?.practitioner_ids || [],
        location_id: formData?.location_id || '',
        mode: formData?.mode || '',
        date_time_preference: formData?.date_time_preference || '',
        // Consent fields (hidden from user)
        consent_checkboxes: [] as number[],
        consents_shown: consentsRequired,
    });

    // Handle flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Handle service type selection
    const handleServiceTypeChange = (serviceType: string) => {
        setData('service_type', serviceType);
        setData('service_name', '');
        setData('service_id', '');
        setData('practitioner_ids', []);
        setData('mode', '');
        setData('location_id', '');
        setData('date_time_preference', '');

        if (serviceType) {
            setLoadingServices(true);
            setTimeout(() => {
                const services = allServices.filter((service) => service.category === serviceType);
                setFilteredServices(services);
                setLoadingServices(false);
            }, 100);
        } else {
            setFilteredServices([]);
        }
    };

    // Handle service name selection
    const handleServiceNameChange = (serviceName: string) => {
        const selectedService = filteredServices.find((s) => s.name === serviceName);

        setData('service_name', serviceName);
        setData('service_id', selectedService?.id.toString() || '');
        setData('practitioner_ids', []);
        setData('mode', '');
        setData('location_id', '');
        setData('date_time_preference', '');

        // Reset availability and appointments
        setPractitionerAvailability({});
        setExistingAppointments([]);

        if (selectedService) {
            setLoadingPractitioners(true);

            const allModeOptions = [
                { value: 'in-person', label: 'In-person' },
                { value: 'virtual', label: 'Virtual' },
                { value: 'hybrid', label: 'Hybrid' },
            ];

            const availableModes = allModeOptions.filter((mode) => selectedService.delivery_modes.includes(mode.value));
            setFilteredModeOptions(availableModes);

            setTimeout(() => {
                const serviceId = selectedService.id;
                const practitioners = allPractitioners.filter((practitioner) => {
                    const serviceIds = practitionerServiceRelations[practitioner.id] || [];
                    return serviceIds.includes(serviceId);
                });
                setFilteredPractitioners(practitioners);
                setLoadingPractitioners(false);
            }, 100);
        } else {
            setFilteredPractitioners([]);
            setFilteredModeOptions([]);
        }
    };

    // Track last fetched availability params to prevent unnecessary reloads
    const lastFetchedParams = React.useRef<string>('');

    // Fetch practitioner availability when practitioner, mode, and location are selected
    // NOTE: Using JSON.stringify to compare values, not references
    useEffect(() => {
        const currentParams = JSON.stringify({
            practitioner_ids: data.practitioner_ids,
            mode: data.mode,
            location_id: data.location_id
        });

        // Only fetch if params actually changed
        if (currentParams === lastFetchedParams.current) {
            return;
        }

        if (data.practitioner_ids.length > 0 && data.mode && (data.mode === 'virtual' || data.mode === 'hybrid' || data.location_id)) {
            lastFetchedParams.current = currentParams;
            fetchPractitionerAvailability();
        } else {
            lastFetchedParams.current = '';
            setPractitionerAvailability({});
            setExistingAppointments([]);
        }
    }, [data.practitioner_ids, data.mode, data.location_id]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPractitionerAvailability = async () => {
        setLoadingAvailability(true);
        try {
            const response = await fetch('/appointments/practitioner-availability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    practitioner_ids: data.practitioner_ids,
                    service_id: data.service_id,
                    location_id: data.location_id || null,
                    mode: data.mode,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Availability response:', result);
                setPractitionerAvailability(result.availability || {});
                setExistingAppointments(result.existingAppointments || []);
            } else {
                const errorText = await response.text();
                console.error('Availability error:', errorText);
                toast.error('Failed to load availability');
                setPractitionerAvailability({});
                setExistingAppointments([]);
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
            toast.error('Failed to load availability');
            setPractitionerAvailability({});
            setExistingAppointments([]);
        } finally {
            setLoadingAvailability(false);
        }
    };

    // Handle consent checkbox change
    const handleConsentChange = (versionId: number, checked: boolean) => {
        if (checked) {
            setConsentCheckboxes([...consentCheckboxes, versionId]);
        } else {
            setConsentCheckboxes(consentCheckboxes.filter(id => id !== versionId));
        }
    };

    // Validate appointment details
    const validateAppointmentDetails = () => {
        const hasPractitioners = Array.isArray(data.practitioner_ids) && data.practitioner_ids.length > 0;
        const requiredStringFields = ['service_type', 'service_name', 'service_id', 'mode', 'date_time_preference'];
        const stringFieldsValid = requiredStringFields.every((field) => {
            const value = data[field as keyof typeof data];
            return value && String(value).trim() !== '';
        });

        const locationValid = data.mode === 'virtual' || data.mode === 'hybrid'
            ? true
            : data.location_id && String(data.location_id).trim() !== '';

        // Validate consents if they are required
        const consentsValid = consentsRequired 
            ? consentCheckboxes.length === pendingConsents.length 
            : true;

        return hasPractitioners && stringFieldsValid && locationValid && consentsValid;
    };

    const isAppointmentDetailsComplete = validateAppointmentDetails();

    // Handle next to review
    const handleAppointmentDetailsNext = () => {
        if (!validateAppointmentDetails()) {
            toast.error('Please fill in all required appointment details before proceeding.');
            return;
        }
        setActiveTab('review');
    };

    // Handle final form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateAppointmentDetails()) {
            if (consentsRequired && consentCheckboxes.length !== pendingConsents.length) {
                toast.error('Please accept all required consents before booking the appointment.');
            } else {
                toast.error('Please complete all required fields.');
            }
            return;
        }

        // Set consent data in form before submission
        setData({
            ...data,
            consent_checkboxes: consentCheckboxes,
            consents_shown: consentsRequired,
        });

        post(route('appointments.patient-store'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Appointment booked successfully! Awaiting confirmation.');
            },
            onError: (errors) => {
                toast.error('Failed to book appointment. Please check the form and try again.');
                console.error('Submission errors:', errors);
            },
        });
    };

    return (
        <>
            <Head title="Book Appointment" />

            <div className="mx-auto max-w-5xl p-4 sm:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl sm:text-2xl">Book an Appointment</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Schedule your appointment in just a few steps
                                </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                                Patient Booking
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {/* Patient Info Display */}
                        <Alert className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Booking for:</strong> {patientInfo.first_name} {patientInfo.last_name} ({patientInfo.email})
                            </AlertDescription>
                        </Alert>

                        <form onSubmit={handleSubmit}>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-6">
                                    <TabsTrigger value="appointment-details">
                                        <Calendar className="h-4 w-4 mr-2" />
                                        Appointment Details
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="review" 
                                        disabled={!isAppointmentDetailsComplete}
                                        className={!isAppointmentDetailsComplete ? 'opacity-50 cursor-not-allowed' : ''}
                                    >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Review & Confirm
                                    </TabsTrigger>
                                </TabsList>

                                {/* Appointment Details Tab */}
                                <TabsContent value="appointment-details" className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Service Type */}
                                        <div className="space-y-2">
                                            <Label htmlFor="service-type">
                                                Service Type <span className="text-red-500">*</span>
                                            </Label>
                                            <Select
                                                value={data.service_type}
                                                onValueChange={handleServiceTypeChange}
                                            >
                                                <SelectTrigger className={errors.service_type ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder="Select service type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {serviceTypes.map((type) => (
                                                        <SelectItem key={type} value={type}>
                                                            {type}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.service_type && (
                                                <p className="text-sm text-red-500">{errors.service_type}</p>
                                            )}
                                        </div>

                                        {/* Service Name */}
                                        <div className="space-y-2">
                                            <Label htmlFor="service-name">
                                                Service <span className="text-red-500">*</span>
                                            </Label>
                                            <Select
                                                value={data.service_name}
                                                onValueChange={handleServiceNameChange}
                                                disabled={!data.service_type || loadingServices}
                                            >
                                                <SelectTrigger className={errors.service_name ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder={loadingServices ? 'Loading...' : 'Select service'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filteredServices.map((service) => (
                                                        <SelectItem key={service.id} value={service.name}>
                                                            {service.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.service_name && (
                                                <p className="text-sm text-red-500">{errors.service_name}</p>
                                            )}
                                        </div>

                                        {/* Practitioner */}
                                        <div className="space-y-2">
                                            <Label htmlFor="practitioner">
                                                Practitioner <span className="text-red-500">*</span>
                                            </Label>
                                            <Select
                                                value={data.practitioner_ids[0]?.toString() || ''}
                                                onValueChange={(value) => setData('practitioner_ids', [parseInt(value)])}
                                                disabled={!data.service_name || loadingPractitioners}
                                            >
                                                <SelectTrigger className={errors.practitioner_ids ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder={loadingPractitioners ? 'Loading...' : 'Select practitioner'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filteredPractitioners.map((practitioner) => (
                                                        <SelectItem key={practitioner.id} value={practitioner.id.toString()}>
                                                            {practitioner.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.practitioner_ids && (
                                                <p className="text-sm text-red-500">{errors.practitioner_ids}</p>
                                            )}
                                        </div>

                                        {/* Mode */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mode">
                                                Mode <span className="text-red-500">*</span>
                                            </Label>
                                            <Select
                                                value={data.mode}
                                                onValueChange={(value) => setData('mode', value)}
                                                disabled={filteredModeOptions.length === 0}
                                            >
                                                <SelectTrigger className={errors.mode ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder="Select mode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filteredModeOptions.map((mode) => (
                                                        <SelectItem key={mode.value} value={mode.value}>
                                                            {mode.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.mode && (
                                                <p className="text-sm text-red-500">{errors.mode}</p>
                                            )}
                                        </div>

                                        {/* Location (only if in-person) */}
                                        {data.mode === 'in-person' && (
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="location">
                                                    Location <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={data.location_id}
                                                    onValueChange={(value) => setData('location_id', value)}
                                                >
                                                    <SelectTrigger className={errors.location_id ? 'border-red-500' : ''}>
                                                        <SelectValue placeholder="Select location" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {locations.map((location) => (
                                                            <SelectItem key={location.id} value={location.id.toString()}>
                                                                {location.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {errors.location_id && (
                                                    <p className="text-sm text-red-500">{errors.location_id}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Calendar Booking Selection */}
                                    {data.practitioner_ids.length > 0 && data.mode && (data.mode === 'virtual' || data.mode === 'hybrid' || data.location_id) && (
                                        <div className="space-y-4 mt-6 md:col-span-2">
                                            <Label>
                                                Select Date & Time <span className="text-red-500">*</span>
                                            </Label>
                                            {loadingAvailability ? (
                                                <div className="flex items-center justify-center py-12 border rounded-lg">
                                                    <div className="text-center">
                                                        <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                                                        <p className="text-sm text-muted-foreground">Loading availability...</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <CalendarBooking
                                                    selectedDateTime={data.date_time_preference}
                                                    onDateTimeSelect={(dateTime) => setData('date_time_preference', dateTime)}
                                                    practitionerIds={data.practitioner_ids}
                                                    serviceId={data.service_id}
                                                    practitionerAvailability={practitionerAvailability}
                                                    loadingAvailability={loadingAvailability}
                                                    appointmentSessionDuration={appointmentSessionDuration}
                                                    appointmentSettings={appointmentSettings}
                                                    existingAppointments={existingAppointments}
                                                    showConflicts={false}
                                                />
                                            )}
                                            {errors.date_time_preference && (
                                                <p className="text-sm text-red-500">{errors.date_time_preference}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Navigation */}
                                    <div className="flex justify-end mt-6">
                                        <Button
                                            type="button"
                                            onClick={handleAppointmentDetailsNext}
                                            disabled={!isAppointmentDetailsComplete}
                                        >
                                            Next: Review
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </TabsContent>

                                {/* Review Tab */}
                                <TabsContent value="review" className="space-y-6">
                                    <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                                        <Clock className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                                            Please review your appointment details below before confirming.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Patient</p>
                                                <p className="font-medium">{patientInfo.first_name} {patientInfo.last_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Contact</p>
                                                <p className="font-medium">{patientInfo.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Service</p>
                                                <p className="font-medium">{data.service_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Practitioner</p>
                                                <p className="font-medium">
                                                    {filteredPractitioners.find(p => p.id === data.practitioner_ids[0])?.name || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Mode</p>
                                                <p className="font-medium capitalize">{data.mode}</p>
                                            </div>
                                            {data.mode === 'in-person' && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Location</p>
                                                    <p className="font-medium">
                                                        {locations.find(l => l.id.toString() === data.location_id)?.name || 'N/A'}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="col-span-2">
                                                <p className="text-sm text-muted-foreground">Date & Time</p>
                                                <p className="font-medium">{data.date_time_preference}</p>
                                            </div>
                                        </div>

                                        {/* Consent Checkboxes - Only show if consents are required */}
                                        {consentsRequired && pendingConsents.length > 0 && (
                                            <div className="space-y-4 mt-6">
                                                <Separator />
                                                <div className="space-y-2">
                                                    <Label className="text-base font-semibold">
                                                        Required Consents <span className="text-red-500">*</span>
                                                    </Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        Please review and accept the following consents to proceed with your appointment booking.
                                                    </p>
                                                </div>

                                                <div className="space-y-4 mt-4">
                                                    {pendingConsents.map((consent) => (
                                                        <Card key={consent.version_id} className="border-l-4 border-l-primary">
                                                            <CardContent className="pt-4">
                                                                <div className="flex items-start gap-3">
                                                                    <Checkbox
                                                                        id={`consent-${consent.version_id}`}
                                                                        checked={consentCheckboxes.includes(consent.version_id)}
                                                                        onCheckedChange={(checked) => 
                                                                            handleConsentChange(consent.version_id, checked as boolean)
                                                                        }
                                                                    />
                                                                    <div className="flex-1 space-y-2">
                                                                        <Label 
                                                                            htmlFor={`consent-${consent.version_id}`}
                                                                            className="text-sm font-semibold cursor-pointer"
                                                                        >
                                                                            {consent.title}
                                                                        </Label>
                                                                        {consent.body.description && (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {consent.body.description}
                                                                            </p>
                                                                        )}
                                                                        {consent.body.content && (
                                                                            <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                                                                                <p>{consent.body.content}</p>
                                                                            </div>
                                                                        )}
                                                                        {consent.body.checkbox_text && (
                                                                            <p className="text-xs font-medium mt-2">
                                                                                {consent.body.checkbox_text}
                                                                            </p>
                                                                        )}
                                                                        {consent.body.important_notice && (
                                                                            <Alert className="mt-2 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                                                                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                                                                <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                                                                                    {consent.body.important_notice}
                                                                                </AlertDescription>
                                                                            </Alert>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>

                                                {consentCheckboxes.length > 0 && consentCheckboxes.length < pendingConsents.length && (
                                                    <Alert variant="destructive" className="mt-4">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <AlertDescription>
                                                            Please accept all consents before proceeding.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>
                                        )}

                                        <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
                                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                                            <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                                                Your appointment will be pending until confirmed by the clinic. You will receive a confirmation email shortly.
                                            </AlertDescription>
                                        </Alert>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex justify-between mt-6">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setActiveTab('appointment-details')}
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Back
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            className="bg-primary"
                                        >
                                            {processing ? 'Booking...' : 'Confirm Booking'}
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default withAppLayout(PatientBookAppointment, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'Book Appointment' }
    ]
});


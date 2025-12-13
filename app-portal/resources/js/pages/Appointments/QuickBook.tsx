import React, { useState, useEffect, useMemo } from 'react';
import { withAppLayout } from '@/utils/layout';
import CalendarBooking from '@/components/CalendarBooking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toaster } from '@/components/ui/sonner';
import {
    Calendar,
    Clock,
    ArrowRight,
    Search,
    User,
    MapPin,
    Video,
    Home,
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { router, Head } from '@inertiajs/react';
import { route } from 'ziggy-js';
import axios from 'axios';
import { usePatientSearch, FoundPatient, PatientSummary } from '@/hooks/usePatientSearch';
import { PhoneInput } from '@/components/phone-input';
import { BreadcrumbItem } from '@/types';

interface Service {
    id: number;
    name: string;
    category: string;
    delivery_modes: string[];
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
    full_name: string;
    display_name: string;
}

interface Location {
    id: number;
    value: number;
    label: string;
    address: string;
    name: string;
}

interface Props {
    practitioner: Practitioner;
    prefilledDate?: string;
    prefilledTimeSlot?: string;
    locations: Location[];
    services: Service[];
    appointmentSessionDuration: number;
    appointmentSettings: {
        advanceBookingHours: string;
        maxAdvanceBookingDays: string;
        allowSameDayBooking: boolean;
    };
}

interface PatientFormData {
    health_number: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    preferred_name: string;
    date_of_birth: string;
    gender: string;
    gender_pronouns: string;
    phone_number: string;
    email_address: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    contact_person: string;
    preferred_language: string;
    client_type: string;
}

interface AppointmentData {
    service_id: string;
    location_id: string;
    mode: string;
    date_time_preference: string;
    duration: number;
    notes: string;
}

function QuickBook({
    practitioner,
    prefilledDate,
    prefilledTimeSlot,
    locations,
    services,
    appointmentSessionDuration,
    appointmentSettings
}: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Calendar', href: '/calendar' },
        { title: 'Quick Book', href: '' },
    ];

    const [appointmentData, setAppointmentData] = useState<AppointmentData>({
        service_id: '',
        location_id: '',
        mode: '',
        date_time_preference: prefilledDate && prefilledTimeSlot 
            ? `${prefilledDate} ${prefilledTimeSlot}` 
            : '',
        duration: appointmentSessionDuration,
        notes: '',
    });

    const [filteredModeOptions, setFilteredModeOptions] = useState<{ value: string; label: string }[]>([]);
    const [practitionerAvailability, setPractitionerAvailability] = useState<Record<string, { start_time: string; end_time: string }[]>>({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [existingAppointments, setExistingAppointments] = useState<Array<{datetime: string; date: string; time: string; appointment_id?: string; status?: string; mode?: string; location_id?: number; duration?: number}>>([]);
    const [processing, setProcessing] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    
    const [patientData, setPatientData] = useState<PatientFormData>({
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
        preferred_language: '',
        client_type: '',
    });

    const {
        searching,
        foundPatient,
        multipleMatches,
        searchMethod,
        hasConflict,
        conflictingPatient,
        clearFoundPatient,
        clearAll,
        searchByHealthNumber,
        searchByEmail,
        searchByName,
        selectFromMultiple,
    } = usePatientSearch();

    // Update mode options when service changes
    useEffect(() => {
        if (appointmentData.service_id) {
            const selectedService = services.find(s => s.id === parseInt(appointmentData.service_id));
            if (selectedService && selectedService.delivery_modes) {
                const modes = selectedService.delivery_modes.map(mode => ({
                    value: mode,
                    label: mode === 'in-person' ? 'In-Person' : 'Virtual'
                }));
                setFilteredModeOptions(modes);
                
                // Reset mode if current mode is not available
                if (appointmentData.mode && !selectedService.delivery_modes.includes(appointmentData.mode)) {
                    setAppointmentData(prev => ({ ...prev, mode: '' }));
                }
            }
        } else {
            setFilteredModeOptions([]);
        }
    }, [appointmentData.service_id, services]);

    // Fetch practitioner availability
    useEffect(() => {
        if (appointmentData.location_id && appointmentData.mode) {
            setLoadingAvailability(true);
            
            const params = {
                practitioner_ids: [practitioner.id],
                location_id: parseInt(appointmentData.location_id),
                mode: appointmentData.mode,
            };
            
            console.log('Fetching availability with:', params);
            
            axios.post(route('appointments.practitionerAvailability'), params)
            .then(response => {
                console.log('Availability response:', response.data);
                setPractitionerAvailability(response.data.availability || {});
                setExistingAppointments(response.data.existingAppointments || []);
            })
            .catch(error => {
                console.error('Error fetching availability:', error);
                console.error('Error response:', error.response?.data);
                const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
                toast.error('Failed to load availability: ' + errorMsg);
                setPractitionerAvailability({});
                setExistingAppointments([]);
            })
            .finally(() => {
                setLoadingAvailability(false);
            });
        } else {
            // Clear availability if location or mode is not selected
            setPractitionerAvailability({});
            setExistingAppointments([]);
        }
    }, [appointmentData.location_id, appointmentData.mode, practitioner.id]);

    // Helper function to capitalize names
    const capitalizeName = (value: string): string => {
        return value
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // Handle field changes
    const handleFieldChange = (fieldName: keyof PatientFormData, value: string) => {
        let processedValue = value;

        // Process name fields
        if (['first_name', 'last_name', 'preferred_name', 'middle_name'].includes(fieldName)) {
            processedValue = value.replace(/[^A-Za-z\s\-\']/g, '');
            processedValue = capitalizeName(processedValue);
        }

        setPatientData(prev => ({ ...prev, [fieldName]: processedValue }));

        // Trigger patient search by name when both first_name and last_name are filled
        if (fieldName === 'first_name' || fieldName === 'last_name') {
            const firstName = fieldName === 'first_name' ? processedValue : patientData.first_name;
            const lastName = fieldName === 'last_name' ? processedValue : patientData.last_name;

            if (firstName && lastName) {
                searchByName(firstName, lastName);
            }
        }
    };

    // Handle auto-fill from found patient
    const handleAutoFill = () => {
        if (!foundPatient) return;

        setPatientData({
            health_number: foundPatient.health_number || '',
            first_name: foundPatient.first_name || '',
            middle_name: foundPatient.middle_name || '',
            last_name: foundPatient.last_name || '',
            preferred_name: foundPatient.preferred_name || '',
            date_of_birth: foundPatient.date_of_birth || '',
            gender: foundPatient.gender || '',
            gender_pronouns: foundPatient.gender_pronouns || '',
            phone_number: foundPatient.phone_number || '',
            email_address: foundPatient.email || '',
            emergency_contact_name: foundPatient.emergency_contact_name || '',
            emergency_contact_phone: foundPatient.emergency_contact_phone || '',
            contact_person: foundPatient.contact_person || '',
            preferred_language: foundPatient.preferred_language || '',
            client_type: foundPatient.client_type || '',
        });

        clearFoundPatient();
        setSelectedPatientId(null);
        toast.success('Patient information loaded successfully');
    };

    // Handle selection from multiple matches
    const handleSelectPatient = async () => {
        if (!selectedPatientId) return;
        await selectFromMultiple(selectedPatientId);
        setSelectedPatientId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required patient fields
        if (!patientData.first_name || !patientData.last_name) {
            toast.error('Please enter patient first and last name');
            return;
        }

        if (!patientData.phone_number) {
            toast.error('Please enter patient phone number');
            return;
        }

        if (!patientData.email_address) {
            toast.error('Please enter patient email address');
            return;
        }

        if (!patientData.gender_pronouns) {
            toast.error('Please enter gender/pronouns');
            return;
        }

        if (!patientData.date_of_birth) {
            toast.error('Please enter date of birth');
            return;
        }

        if (!patientData.client_type) {
            toast.error('Please select client type');
            return;
        }

        if (!patientData.emergency_contact_phone) {
            toast.error('Please enter emergency contact phone');
            return;
        }

        if (!appointmentData.service_id) {
            toast.error('Please select a service');
            return;
        }

        if (!appointmentData.location_id) {
            toast.error('Please select a location');
            return;
        }

        if (!appointmentData.mode) {
            toast.error('Please select a mode');
            return;
        }

        if (!appointmentData.date_time_preference) {
            toast.error('Please select a date and time');
            return;
        }

        setProcessing(true);

        try {
            // Prepare the quick book appointment data with all patient fields
            const payload = {
                // Patient information
                health_number: patientData.health_number,
                first_name: patientData.first_name,
                middle_name: patientData.middle_name,
                last_name: patientData.last_name,
                preferred_name: patientData.preferred_name,
                date_of_birth: patientData.date_of_birth,
                gender: patientData.gender,
                gender_pronouns: patientData.gender_pronouns,
                phone_number: patientData.phone_number,
                email_address: patientData.email_address,
                emergency_contact_name: patientData.emergency_contact_name,
                emergency_contact_phone: patientData.emergency_contact_phone,
                contact_person: patientData.contact_person,
                preferred_language: patientData.preferred_language,
                client_type: patientData.client_type,
                
                // Appointment details
                service_id: appointmentData.service_id,
                practitioner_id: practitioner.id,
                location_id: appointmentData.location_id,
                mode: appointmentData.mode,
                date_time_preference: appointmentData.date_time_preference,
                notes: appointmentData.notes,
            };

            const response = await axios.post(route('appointments.quick-book.store'), payload);

            toast.success('Appointment booked successfully!');
            
            // Redirect back to calendar
            router.visit(route('calendar.index'));
        } catch (error: any) {
            console.error('Error booking appointment:', error);
            
            if (error.response?.data?.message) {
                toast.error(error.response.data.message);
            } else if (error.response?.data?.errors) {
                const errors = error.response.data.errors;
                const firstError = Object.values(errors)[0];
                toast.error(Array.isArray(firstError) ? firstError[0] : 'Please check all fields');
            } else {
                toast.error('Failed to book appointment');
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <Head title="Quick Book Appointment" />
            <Toaster />
            
            <div className="m-3 sm:m-6">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Quick Book Appointment</h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Book an appointment with {practitioner.display_name || practitioner.full_name}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => router.visit(route('calendar.index'))}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Calendar
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Patient Form */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Patient Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Health Number Row */}
                                <div className="relative">
                                    <Label htmlFor="health_number">
                                        Health Card Number <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="health_number"
                                        value={patientData.health_number}
                                        onChange={(e) => {
                                            const value = e.target.value.toUpperCase();
                                            handleFieldChange('health_number', value);
                                            if (value.length >= 2) {
                                                searchByHealthNumber(value);
                                            }
                                        }}
                                        placeholder="e.g., 1234-567-890 (Ontario OHIP)"
                                        className="placeholder:text-gray-400"
                                        maxLength={30}
                                    />
                                    {searching && (
                                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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

                                {/* First Name, Last Name, Preferred Name Row */}
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                    <div>
                                        <Label htmlFor="first_name">
                                            First Name <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="first_name"
                                            value={patientData.first_name}
                                            onChange={(e) => handleFieldChange('first_name', e.target.value)}
                                            placeholder="Enter First Name"
                                            className="placeholder:text-gray-400"
                                            maxLength={50}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="last_name">
                                            Last Name <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="last_name"
                                            value={patientData.last_name}
                                            onChange={(e) => handleFieldChange('last_name', e.target.value)}
                                            placeholder="Enter Last Name"
                                            className="placeholder:text-gray-400"
                                            maxLength={50}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="preferred_name">
                                            Preferred Name <span className="text-gray-500">(optional)</span>
                                        </Label>
                                        <Input
                                            id="preferred_name"
                                            value={patientData.preferred_name}
                                            onChange={(e) => handleFieldChange('preferred_name', e.target.value)}
                                            placeholder="e.g., Jess"
                                            className="placeholder:text-gray-400"
                                            maxLength={50}
                                        />
                                    </div>
                                </div>

                                {/* Phone Number, Email Address, Gender/Pronouns Row */}
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                    <div>
                                        <Label htmlFor="phone_number">
                                            Phone Number <span className="text-red-500">*</span>
                                        </Label>
                                        <PhoneInput
                                            id="phone_number"
                                            name="phone_number"
                                            placeholder="Enter Phone Number"
                                            value={patientData.phone_number || ""}
                                            onChange={(val: any) => {
                                                setPatientData(prev => ({ ...prev, phone_number: (val as string) || "" }));
                                            }}
                                            defaultCountry="CA"
                                            international
                                            countryCallingCodeEditable={false}
                                            className="w-full placeholder:text-gray-400"
                                            maxLength={20}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="email_address">
                                            Email Address <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="email_address"
                                            type="email"
                                            value={patientData.email_address}
                                            onChange={(e) => {
                                                const value = e.target.value.toLowerCase();
                                                setPatientData(prev => ({ ...prev, email_address: value }));
                                                if (value.length >= 3) {
                                                    searchByEmail(value);
                                                }
                                            }}
                                            placeholder="Enter Email Address"
                                            className="placeholder:text-gray-400"
                                            maxLength={255}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="gender_pronouns">
                                            Gender/Pronouns <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="gender_pronouns"
                                            value={patientData.gender_pronouns}
                                            onChange={(e) => setPatientData(prev => ({ ...prev, gender_pronouns: e.target.value }))}
                                            placeholder="e.g., she/her, he/him"
                                            className="placeholder:text-gray-400"
                                            maxLength={50}
                                        />
                                    </div>
                                </div>

                                {/* Date of Birth, Client Type, Emergency Contact Phone Row */}
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                    <div>
                                        <Label htmlFor="date_of_birth">
                                            Date of Birth <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="date_of_birth"
                                            type="date"
                                            value={patientData.date_of_birth}
                                            onChange={(e) => setPatientData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                                            className="placeholder:text-gray-400"
                                            max={new Date(Date.now()).toISOString().split('T')[0]}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="client_type">
                                            Client Type <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={patientData.client_type}
                                            onValueChange={(value) => setPatientData(prev => ({ ...prev, client_type: value }))}
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
                                    </div>
                                    <div>
                                        <Label htmlFor="emergency_contact_phone">
                                            Emergency Contact Phone <span className="text-red-500">*</span>
                                        </Label>
                                        <PhoneInput
                                            id="emergency_contact_phone"
                                            name="emergency_contact_phone"
                                            placeholder="Enter Emergency Contact Phone"
                                            value={patientData.emergency_contact_phone || ""}
                                            onChange={(val: any) => {
                                                setPatientData(prev => ({ ...prev, emergency_contact_phone: (val as string) || "" }));
                                            }}
                                            defaultCountry="CA"
                                            international
                                            countryCallingCodeEditable={false}
                                            className="w-full placeholder:text-gray-400"
                                            maxLength={20}
                                        />
                                    </div>
                                </div>

                                {/* Emergency Contact Name, Contact Person, Preferred Language Row */}
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                    <div>
                                        <Label htmlFor="emergency_contact_name">
                                            Emergency Contact Name <span className="text-gray-500">(optional)</span>
                                        </Label>
                                        <Input
                                            id="emergency_contact_name"
                                            value={patientData.emergency_contact_name}
                                            onChange={(e) => setPatientData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                                            placeholder="Enter Emergency Contact Name"
                                            className="placeholder:text-gray-400"
                                            maxLength={100}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="contact_person">
                                            Contact Person <span className="text-gray-500">(leave blank if same as client)</span>
                                        </Label>
                                        <Input
                                            id="contact_person"
                                            value={patientData.contact_person}
                                            onChange={(e) => setPatientData(prev => ({ ...prev, contact_person: e.target.value }))}
                                            placeholder="Enter Contact Person Name"
                                            className="placeholder:text-gray-400"
                                            maxLength={100}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="preferred_language">
                                            Preferred Language <span className="text-gray-500">(optional)</span>
                                        </Label>
                                        <Input
                                            id="preferred_language"
                                            value={patientData.preferred_language}
                                            onChange={(e) => setPatientData(prev => ({ ...prev, preferred_language: e.target.value }))}
                                            placeholder="e.g., English, French"
                                            className="placeholder:text-gray-400"
                                            maxLength={50}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Appointment Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Appointment Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Practitioner (Read-only) */}
                                <div>
                                    <Label>Practitioner</Label>
                                    <Input
                                        value={practitioner.display_name || practitioner.full_name}
                                        disabled
                                        className="bg-gray-100 dark:bg-gray-800"
                                    />
                                </div>

                                {/* Service */}
                                <div>
                                    <Label htmlFor="service">Service *</Label>
                                    <Select
                                        value={appointmentData.service_id}
                                        onValueChange={(value) => setAppointmentData(prev => ({ ...prev, service_id: value }))}
                                    >
                                        <SelectTrigger id="service">
                                            <SelectValue placeholder="Select service" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {services.map(service => (
                                                <SelectItem key={service.id} value={service.id.toString()}>
                                                    {service.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Location */}
                                <div>
                                    <Label htmlFor="location">Location *</Label>
                                    <Select
                                        value={appointmentData.location_id}
                                        onValueChange={(value) => setAppointmentData(prev => ({ ...prev, location_id: value }))}
                                    >
                                        <SelectTrigger id="location">
                                            <SelectValue placeholder="Select location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locations.map(location => (
                                                <SelectItem key={location.id} value={location.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        <Home className="h-4 w-4" />
                                                        <div>
                                                            <div>{location.name}</div>
                                                            <div className="text-xs text-gray-500">{location.address}</div>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Mode */}
                                {filteredModeOptions.length > 0 && (
                                    <div>
                                        <Label htmlFor="mode">Mode *</Label>
                                        <Select
                                            value={appointmentData.mode}
                                            onValueChange={(value) => setAppointmentData(prev => ({ ...prev, mode: value }))}
                                        >
                                            <SelectTrigger id="mode">
                                                <SelectValue placeholder="Select mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {filteredModeOptions.map(option => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        <div className="flex items-center gap-2">
                                                            {option.value === 'virtual' ? (
                                                                <Video className="h-4 w-4" />
                                                            ) : (
                                                                <MapPin className="h-4 w-4" />
                                                            )}
                                                            {option.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Duration */}
                                <div>
                                    <Label htmlFor="duration">Duration (minutes) *</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        value={appointmentData.duration}
                                        onChange={(e) => setAppointmentData(prev => ({ ...prev, duration: parseInt(e.target.value) || appointmentSessionDuration }))}
                                        min="15"
                                        step="15"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea
                                        id="notes"
                                        value={appointmentData.notes}
                                        onChange={(e) => setAppointmentData(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Add any notes for this appointment..."
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Calendar Booking */}
                        {appointmentData.location_id && appointmentData.mode && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="h-5 w-5" />
                                        Select Date & Time
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CalendarBooking
                                        practitionerAvailability={practitionerAvailability}
                                        loadingAvailability={loadingAvailability}
                                        existingAppointments={existingAppointments}
                                        appointmentSessionDuration={appointmentData.duration}
                                        selectedDateTime={appointmentData.date_time_preference}
                                        onDateTimeSelect={(dateTime) => {
                                            setAppointmentData(prev => ({ ...prev, date_time_preference: dateTime }));
                                        }}
                                        practitionerId={practitioner.id.toString()}
                                        practitionerIds={[practitioner.id]}
                                        appointmentSettings={{
                                            advanceBookingHours: appointmentSettings.advanceBookingHours,
                                            maxAdvanceBookingDays: appointmentSettings.maxAdvanceBookingDays,
                                            allowSameDayBooking: appointmentSettings.allowSameDayBooking,
                                        }}
                                        showConflicts={true}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {/* Submit Button */}
                        <div className="flex items-center justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.visit(route('calendar.index'))}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={processing || !patientData.first_name || !patientData.last_name || !appointmentData.date_time_preference}
                            >
                                {processing ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                                        Booking...
                                    </>
                                ) : (
                                    <>
                                        Book Appointment
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

export default withAppLayout(QuickBook, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'Quick Book' }
    ]
});


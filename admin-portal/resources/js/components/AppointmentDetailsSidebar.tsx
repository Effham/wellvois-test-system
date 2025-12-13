import React from 'react';
import { X, Calendar, Clock, MapPin, Phone, Mail, User, FileText, CheckCircle, XCircle, AlertCircle, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    email: string;
    phone_number: string;
    health_number?: string;
    date_of_birth: string;
    gender_pronouns?: string;
    client_type?: string;
    emergency_contact_phone?: string;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
}

interface Service {
    id: number;
    name: string;
    category?: string;
}

interface Location {
    id: number;
    name: string;
    street_address?: string;
    city?: string;
    province?: string;
}

interface Appointment {
    id: number;
    status: string;
    appointment_datetime: string;
    appointment_datetime_local?: string;
    tenant_timezone?: string;
    start_time?: string;
    end_time?: string;
    mode: string;
    booking_source: string;
    date_time_preference: string;
    contact_person?: string;
    notes?: string;
    patient: Patient;
    practitioners_list?: Array<{id: number; name: string}>;
    practitioners_detail?: Array<{
        id: number; 
        name: string; 
        start_time: string; 
        end_time: string;
    }>;
    service: Service;
    location?: Location;
    send_intake_form: boolean;
    send_appointment_confirmation: boolean;
    add_to_calendar: boolean;
    tag_with_referral_source: boolean;
    encounter?: {
        id: number;
        status: string;
        session_started_at: string;
        session_completed_at: string;
        session_duration_seconds: number;
        has_data: boolean;
    } | null;
    ai_summary_status: string;
    created_at: string;
    updated_at: string;
}

interface Props {
    appointment: Appointment | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function AppointmentDetailsSidebar({ appointment, isOpen, onClose }: Props) {
    if (!appointment) return null;

    const formatDateTime = (dateTime: string) => {
        if (!dateTime) return 'Not set';
        
        try {
            return new Date(dateTime).toLocaleString();
        } catch (error) {
            return 'Invalid date';
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

    return (
        <div className={`fixed inset-y-0 right-0 w-[50vw] bg-white border-l border-gray-200 shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Appointment Details</h2>
                    <p className="text-sm text-gray-500">ID: #{appointment.id}</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 w-8 p-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="h-full overflow-y-auto p-6 space-y-6">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(appointment.status)}>
                        {getStatusIcon(appointment.status)}
                        <span className="ml-1 capitalize">{appointment.status}</span>
                    </Badge>
                </div>

                {/* Basic Info */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Date & Time</p>
                                <p className="text-base font-semibold">
                                    {formatDateTime(appointment.appointment_datetime_local || appointment.appointment_datetime)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Mode</p>
                                <p className="text-base font-semibold capitalize">{appointment.mode}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Patient Information */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Patient Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Name</p>
                                <p className="text-base font-semibold">
                                    {appointment.patient?.first_name} {appointment.patient?.last_name}
                                    {appointment.patient?.preferred_name && (
                                        <span className="text-sm text-gray-500 ml-2">
                                            ({appointment.patient.preferred_name})
                                        </span>
                                    )}
                                </p>
                            </div>
                            
                            {appointment.patient?.email && (
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                                    <p className="text-base font-semibold flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-gray-400" />
                                        {appointment.patient.email}
                                    </p>
                                </div>
                            )}
                            
                            {appointment.patient?.phone_number && (
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                                    <p className="text-base font-semibold flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-gray-400" />
                                        {appointment.patient.phone_number}
                                    </p>
                                </div>
                            )}
                            
                            {appointment.patient?.date_of_birth && (
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Date of Birth</p>
                                    <p className="text-base font-semibold">
                                        {new Date(appointment.patient.date_of_birth).toLocaleDateString()}
                                    </p>
                                </div>
                            )}
                        </div>

                        {appointment.patient?.emergency_contact_phone && (
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Emergency Contact</p>
                                <p className="text-base font-semibold flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-red-400" />
                                    {appointment.patient.emergency_contact_phone}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Service & Practitioner */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Appointment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Service</p>
                                <p className="text-base font-semibold">{appointment.service?.name || 'Unknown Service'}</p>
                            </div>
                            
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Practitioner</p>
                                <p className="text-base font-semibold">
                                    {appointment.practitioners_list && appointment.practitioners_list.length > 0 
                                        ? appointment.practitioners_list.map(p => p.name).join(', ')
                                        : 'No practitioners assigned'
                                    }
                                </p>
                            </div>
                            
                            {appointment.location && (
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Location</p>
                                    <p className="text-base font-semibold flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-gray-400" />
                                        {appointment.location.name}
                                    </p>
                                    {appointment.location.street_address && (
                                        <p className="text-sm text-gray-600 ml-6">
                                            {appointment.location.street_address}
                                            {appointment.location.city && `, ${appointment.location.city}`}
                                        </p>
                                    )}
                                </div>
                            )}
                            
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Booking Source</p>
                                <p className="text-base font-semibold capitalize">{appointment.booking_source}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Settings */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${appointment.send_intake_form ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-sm">Intake Form</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${appointment.send_appointment_confirmation ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-sm">Confirmation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${appointment.add_to_calendar ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-sm">Calendar</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${appointment.tag_with_referral_source ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-sm">Referral Tag</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Additional Information */}
                {(appointment.notes || appointment.contact_person) && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Additional Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {appointment.contact_person && (
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Contact Person</p>
                                    <p className="text-base font-semibold">{appointment.contact_person}</p>
                                </div>
                            )}
                            
                            {appointment.notes && (
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Notes</p>
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-sm text-gray-700">{appointment.notes}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Timestamps */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Timestamps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex justify-between">
                                <span>Created:</span>
                                <span>{new Date(appointment.created_at).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Updated:</span>
                                <span>{new Date(appointment.updated_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 
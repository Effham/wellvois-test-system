
import { Head, Link } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { withAppLayout } from '@/utils/layout';
import PageHeader from '@/components/general/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { Calendar, Clock, MapPin, User, FileText, Stethoscope, Eye, Phone, Mail, CheckCircle, XCircle, AlertCircle, Hourglass } from 'lucide-react';
import { formatDateTime, getTenantTimezone } from '@/hooks/use-time-locale';


interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    health_number?: string;
    date_of_birth: string;
    gender_pronouns?: string;
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
    mode: string;
    service: Service;
    location?: Location;
    notes?: string;
    created_at: string;
}

interface Encounter {
    id: number;
    status: string;
    session_started_at: string;
    session_completed_at: string;
    session_duration_seconds: number;
    chief_complaint?: string;
    examination_notes?: string;
    clinical_assessment?: string;
    treatment_plan?: string;
    created_at: string;
    updated_at: string;
}

interface Props {
    appointment: Appointment;
    encounter: Encounter;
    patient: Patient;
    practitioners: Practitioner[];
}

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '/appointments' },
    { title: 'Session Details', href: '' },
];

function SessionDetails({ appointment, encounter, patient, practitioners }: Props) {
    // Safety checks to prevent undefined errors
    if (!appointment || !encounter || !patient) {
        return (
            <>
                <Head title="Session Details" />
                <div className="p-6">
                    <div className="text-center py-8">
                        <p className="text-gray-500">Loading session details...</p>
                    </div>
                </div>
            </>
        );
    }

    // Use the hook's formatDateTime function instead of custom implementation

    const formatDuration = (seconds: number) => {
        if (!seconds) return 'Not recorded';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    // Use consistent status colors from appointments table
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'confirmed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'in_progress':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'cancelled':
            case 'declined':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return <Hourglass className="h-4 w-4" />;
            case 'confirmed':
            case 'completed':
            case 'in_progress':
                return <CheckCircle className="h-4 w-4" />;
            case 'cancelled':
            case 'declined':
                return <XCircle className="h-4 w-4" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
        }
    };

    return (
        <>
            <Head title="Session Details" />

            <div className="space-y-6 p-6">
                <PageHeader 
                    title="Session Details" 
                    breadcrumbs={breadcrumbs}
                />

                {/* Main Session Card */}
                <Card className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Stethoscope className="h-6 w-6 text-blue-600" />
                                    Session Completed - {appointment.service?.name || 'Unknown Service'}
                                </CardTitle>
                                <p className="text-gray-600 mt-1">
                                    Session conducted on {formatDateTime(encounter.session_started_at)}
                                </p>
                                <p className="text-sm text-gray-500">{getTenantTimezone()}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge className={`${getStatusColor(encounter.status || 'unknown')} flex items-center gap-1`}>
                                    {getStatusIcon(encounter.status || 'unknown')}
                                    <span className="capitalize">{(encounter.status || 'unknown').replace('_', ' ')}</span>
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                    {appointment.mode}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6">
                        {/* Patient & Session Overview */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                            {/* Patient Info */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                                    <User className="h-4 w-4" />
                                    Patient Information
                                </div>
                                <div className="space-y-3 pl-6">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Health Number</p>
                                        <p className="font-medium">{patient.health_number || 'Not provided'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3 text-gray-400" />
                                        <span className="text-sm">{patient.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-3 w-3 text-gray-400" />
                                        <span className="text-sm">{patient.phone_number}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Session Timing */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                                    <Clock className="h-4 w-4" />
                                    Session Timing
                                </div>
                                <div className="space-y-3 pl-6">
                                    <div>
                                        <p className="text-sm text-gray-600">Duration</p>
                                        <p className="font-medium text-lg">{formatDuration(encounter?.session_duration_seconds || 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Started</p>
                                        <p className="font-medium">{formatDateTime(encounter?.session_started_at || '')}</p>
                                        <p className="text-xs text-gray-500">{getTenantTimezone()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Completed</p>
                                        <p className="font-medium">{formatDateTime(encounter?.session_completed_at || '')}</p>
                                        <p className="text-xs text-gray-500">{getTenantTimezone()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Appointment Details */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                                    <Calendar className="h-4 w-4" />
                                    Appointment Details
                                </div>
                                <div className="space-y-3 pl-6">
                                    <div>
                                        <p className="text-sm text-gray-600">Scheduled Date</p>
                                        <p className="font-medium">{formatDateTime(appointment.appointment_datetime)}</p>
                                        <p className="text-xs text-gray-500">{getTenantTimezone()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Location</p>
                                        <p className="font-medium flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-gray-400" />
                                            {appointment.location ? appointment.location.name : 'Virtual'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Status</p>
                                        <Badge className={`${getStatusColor(appointment.status)} flex items-center gap-1 w-fit`}>
                                            {getStatusIcon(appointment.status)}
                                            <span className="capitalize">{appointment.status}</span>
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Practitioners */}
                        {practitioners && practitioners.length > 0 && (
                            <>
                                <Separator className="my-6" />
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                                        <Stethoscope className="h-4 w-4" />
                                        Practitioners Involved
                                    </div>
                                    <div className="flex flex-wrap gap-2 pl-6">
                                        {practitioners.map((practitioner) => (
                                            <Badge key={practitioner.id} variant="secondary" className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {practitioner.title && `${practitioner.title} `}
                                                {practitioner.first_name} {practitioner.last_name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Appointment Notes */}
                        {appointment.notes && (
                            <>
                                <Separator className="my-6" />
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                                        <FileText className="h-4 w-4" />
                                        Appointment Notes
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg border pl-6">
                                        <p className="text-gray-700">{appointment.notes}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Clinical Notes Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Clinical Documentation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {encounter?.chief_complaint && (
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Chief Complaint</h4>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="text-gray-700">{encounter.chief_complaint}</p>
                                </div>
                            </div>
                        )}

                        {encounter?.examination_notes && (
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Examination Notes</h4>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="text-gray-700">{encounter.examination_notes}</p>
                                </div>
                            </div>
                        )}

                        {encounter?.clinical_assessment && (
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Clinical Assessment</h4>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="text-gray-700">{encounter.clinical_assessment}</p>
                                </div>
                            </div>
                        )}

                        {encounter?.treatment_plan && (
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Treatment Plan</h4>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="text-gray-700">{encounter.treatment_plan}</p>
                                </div>
                            </div>
                        )}

                        {!encounter?.chief_complaint && !encounter?.examination_notes && 
                         !encounter?.clinical_assessment && !encounter?.treatment_plan && (
                            <div className="text-center py-12 text-gray-500">
                                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-medium mb-2">No Clinical Documentation</h3>
                                <p>No session details have been recorded for this appointment yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4">
                    <Link href={route('appointments.show', appointment.id)}>
                        <Button variant="outline" size="lg">
                            ← Back to Appointment Details
                        </Button>
                    </Link>
                    
                    <div className="flex gap-3">
                        <Link href={route('encounters.documents.upload', encounter.id)}>
                            <Button variant="outline" size="lg">
                                <Eye className="h-4 w-4 mr-2" />
                                View Documents
                            </Button>
                        </Link>
                        
                        <Button size="lg">
                            <FileText className="h-4 w-4 mr-2" />
                            Edit Session
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default withAppLayout(SessionDetails, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'Session Details' }
    ]
}); 
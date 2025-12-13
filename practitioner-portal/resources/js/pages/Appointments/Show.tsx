import { Head, Link, router } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Calendar, 
    Clock, 
    MapPin, 
    Phone, 
    Mail, 
    User, 
    FileText, 
    Stethoscope, 
    UserCheck, 
    ArrowLeft,
    CheckCircle,
    XCircle,
    AlertCircle,
    Hourglass,
    Edit,
    History,
    Star,
    Brain,
    Plus,
    Shield,
    Activity,
    Clipboard,
    Heart,
    Thermometer,
    Wind,
    Pill,
    AlertTriangle,
    Target,
    BookOpen,
    ClipboardCheck,
    MessageSquare,
    Sparkles
} from 'lucide-react';
import { smartFormatDateTime, getTenantTimezone } from '@/utils/time-locale-helpers';
import { formatDateTime } from '@/hooks/use-time-locale';
import AppointmentTabs from '@/components/appointments/AppointmentTabs';

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
    name?: string;
}

interface Service {
    id: number;
    name: string;
    category?: string;
    description?: string;
}

interface Location {
    id: number;
    name: string;
    street_address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
}

interface Encounter {
    id: number;
    status: string;
    session_started_at: string;
    session_completed_at: string;
    session_duration_seconds: number;
    session_type?: string;
    note_type?: string;
    has_data: boolean;
    // Clinical notes
    chief_complaint?: string;
    history_of_present_illness?: string;
    examination_notes?: string;
    clinical_assessment?: string;
    treatment_plan?: string;
    additional_notes?: string;
    // AI fields
    ai_note?: string;
    ai_note_status?: string;
    ai_summary?: string;
    report_sent_to_patient?: boolean;
    // Vital signs
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    // Mental health fields
    mental_state_exam?: string;
    mood_affect?: string;
    thought_process?: string;
    cognitive_assessment?: string;
    risk_assessment?: string;
    therapeutic_interventions?: string;
    session_goals?: string;
    homework_assignments?: string;
    // Relations
    documents?: any[];
    document_requests?: any[];
    prescriptions?: any[];
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
    primary_practitioner_id?: number;
    practitioners_list?: Array<{id: number; name: string; is_primary?: boolean}>;
    practitioners_detail?: Array<{
        id: number; 
        name: string; 
        start_time: string; 
        end_time: string;
        is_primary?: boolean;
    }>;
    service: Service;
    location?: Location;
    send_intake_form: boolean;
    send_appointment_confirmation: boolean;
    add_to_calendar: boolean;
    tag_with_referral_source: boolean;
    created_at: string;
    updated_at: string;
    encounter?: Encounter | null;
    ai_summary_status: string;
}

interface Props {
    appointment: Appointment;
    user_role?: string;
}

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '/appointments' },
    { title: 'Details', href: '' },
];

function Show({ appointment, user_role }: Props) {
    console.log('appointment',appointment)
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'confirmed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200';
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
                return <CheckCircle className="h-4 w-4" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4" />;
            case 'cancelled':
            case 'declined':
                return <XCircle className="h-4 w-4" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
        }
    };

    const getPrimaryPractitioner = () => {
        if (appointment.practitioners_detail) {
            const primary = appointment.practitioners_detail.find(p => p.is_primary);
            return primary || appointment.practitioners_detail[0];
        }
        if (appointment.practitioners_list && appointment.practitioners_list.length > 0) {
            const primary = appointment.practitioners_list.find(p => p.is_primary);
            return primary || appointment.practitioners_list[0];
        }
        return null;
    };

    const getOtherPractitioners = () => {
        if (appointment.practitioners_detail) {
            return appointment.practitioners_detail.filter(p => !p.is_primary);
        }
        if (appointment.practitioners_list) {
            return appointment.practitioners_list.filter(p => !p.is_primary);
        }
        return [];
    };

    const primaryPractitioner = getPrimaryPractitioner();
    const otherPractitioners = getOtherPractitioners();

    return (
        <>
            <Head title={`Appointment #${appointment.id}`} />

            {/* Tabs Navigation */}
            <AppointmentTabs 
                appointmentId={appointment.id}
                encounterId={appointment.encounter?.id}
                currentTab="details"
                userRole={user_role}
                appointmentStatus={appointment.status}
                showFeedback={user_role === 'patient'}
            />

            <div className="container mx-auto px-4 py-6 max-w-7xl">
                {/* Header Section */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/appointments">
                            <Button variant="outline" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Appointments
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Appointment Details</h1>
                            <p className="text-sm text-gray-500 mt-1">Appointment ID: #{appointment.id}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status Badge */}
                        <Badge className={`${getStatusColor(appointment.status)} px-4 py-2 text-sm font-semibold`}>
                            {getStatusIcon(appointment.status)}
                            <span className="ml-2 capitalize">{appointment.status}</span>
                        </Badge>

                        {/* Action Buttons */}
                        {user_role === 'admin' && appointment.status === 'pending' && (
                            <Link href={route('appointments.manageAppointment', appointment.id)}>
                                <Button variant="outline" size="sm">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Manage
                                </Button>
                            </Link>
                        )}

                        {user_role !== 'patient' && (appointment.status === 'completed' || appointment.status === 'confirmed') && (
                            <Link href={`/appointments/${appointment.id}/ai-summary`}>
                                <Button variant="outline" size="sm">
                                    <Brain className="h-4 w-4 mr-2" />
                                    AI Summary
                                </Button>
                            </Link>
                        )}

                        {user_role === 'patient' && appointment.status === 'completed' && (
                            <Link href={`/appointments/${appointment.id}/feedback`}>
                                <Button variant="outline" size="sm" className="text-yellow-600 hover:text-yellow-700">
                                    <Star className="h-4 w-4 mr-2" />
                                    Rate Appointment
                                </Button>
                            </Link>
                        )}

                        {appointment.encounter && (
                            <Link href={route('encounters.documents.upload', appointment.encounter.id)}>
                                <Button variant="outline" size="sm">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Documents
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Main Information */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Schedule Information Card */}
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                        <Clock className="w-5 h-5 text-white" />
                                    </div>
                                    <span>Schedule Information</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                                        <p className="text-sm font-medium text-gray-600 mb-2">Appointment Date & Time</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {smartFormatDateTime(appointment)}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">{getTenantTimezone()}</p>
                                    </div>

                                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                                        <p className="text-sm font-medium text-gray-600 mb-2">Session Mode</p>
                                        <Badge variant="secondary" className="capitalize font-semibold text-base px-3 py-1.5">
                                            {appointment.mode} Session
                                        </Badge>
                                    </div>
                                </div>

                                {appointment.location && (
                                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-rose-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Location</p>
                                            <p className="text-lg font-bold text-gray-900">{appointment.location.name}</p>
                                            {appointment.location.street_address && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {appointment.location.street_address}
                                                    {appointment.location.city && `, ${appointment.location.city}`}
                                                    {appointment.location.province && `, ${appointment.location.province}`}
                                                    {appointment.location.postal_code && ` ${appointment.location.postal_code}`}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Patient Information Card */}
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                        <User className="w-5 h-5 text-white" />
                                    </div>
                                    <span>Patient Information</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {/* Patient Name */}
                                    <div className="flex items-center gap-4 pb-4 border-b">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center border-2 border-emerald-200">
                                            <User className="w-7 h-7 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-gray-900">
                                                {appointment?.patient?.first_name} {appointment?.patient?.last_name}
                                            </p>
                                            {appointment?.patient?.preferred_name && (
                                                <p className="text-sm text-gray-500">Preferred: {appointment.patient.preferred_name}</p>
                                            )}
                                            {appointment?.patient?.gender_pronouns && (
                                                <p className="text-sm text-gray-500">{appointment.patient.gender_pronouns}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact Information Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {appointment?.patient?.email && (
                                            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <Mail className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                                                    <p className="text-sm font-medium text-gray-900">{appointment.patient.email}</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment?.patient?.phone_number && (
                                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                                                    <Phone className="w-4 h-4 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                                                    <p className="text-sm font-medium text-gray-900">{appointment?.patient?.phone_number}</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment?.patient?.date_of_birth && (
                                            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                                    <Calendar className="w-4 h-4 text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Birth</p>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {new Date(appointment?.patient?.date_of_birth).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment?.patient?.health_number && (
                                            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                                                    <Shield className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Health Number</p>
                                                    <p className="text-sm font-medium text-gray-900">{appointment?.patient?.health_number}</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment?.patient?.emergency_contact_phone && (
                                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg md:col-span-2">
                                                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                                                    <Phone className="w-4 h-4 text-red-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Emergency Contact</p>
                                                    <p className="text-sm font-medium text-gray-900">{appointment?.patient?.emergency_contact_phone}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Encounter/Session Card */}
                        {appointment.encounter && (
                            <Card className="border-2 shadow-sm">
                                <CardHeader className="bg-gradient-to-r from-cyan-50 to-sky-50 border-b">
                                    <CardTitle className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-lg">
                                            <Activity className="w-5 h-5 text-white" />
                                        </div>
                                        <span>Session Information</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center">
                                                    <Activity className="w-4 h-4 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
                                                    <Badge variant="secondary" className="capitalize mt-1">
                                                        {appointment.encounter.status}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {appointment.encounter.session_started_at && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                                        <Clock className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Started</p>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {formatDateTime(appointment.encounter.session_started_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {appointment.encounter.session_completed_at && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</p>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {formatDateTime(appointment.encounter.session_completed_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {appointment.encounter.session_duration_seconds > 0 && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                                        <Clock className="w-4 h-4 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</p>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {Math.floor(appointment.encounter.session_duration_seconds / 60)} minutes
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Clinical Notes Preview */}
                                        {appointment.encounter.has_data && (
                                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Clipboard className="w-4 h-4 text-blue-600" />
                                                    <p className="text-sm font-semibold text-blue-900">Clinical Notes Available</p>
                                                </div>
                                                <p className="text-xs text-blue-700">
                                                    This session has clinical documentation including assessment and treatment details.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Vital Signs Card */}
                        {appointment.encounter && (appointment.encounter.blood_pressure_systolic || appointment.encounter.heart_rate || 
                         appointment.encounter.temperature || appointment.encounter.respiratory_rate || 
                         appointment.encounter.oxygen_saturation || appointment.encounter.weight || 
                         appointment.encounter.height) && (
                            <Card className="border-2 shadow-sm">
                                <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 border-b">
                                    <CardTitle className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
                                            <Heart className="w-5 h-5 text-white" />
                                        </div>
                                        <span>Vital Signs</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {(appointment.encounter.blood_pressure_systolic || appointment.encounter.blood_pressure_diastolic) && (
                                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                                                    <Activity className="w-4 h-4 text-red-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blood Pressure</p>
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {appointment.encounter.blood_pressure_systolic}/{appointment.encounter.blood_pressure_diastolic} mmHg
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.encounter.heart_rate && (
                                            <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center">
                                                    <Heart className="w-4 h-4 text-pink-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Heart Rate</p>
                                                    <p className="text-sm font-bold text-gray-900">{appointment.encounter.heart_rate} bpm</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.encounter.temperature && (
                                            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                                                    <Thermometer className="w-4 h-4 text-orange-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Temperature</p>
                                                    <p className="text-sm font-bold text-gray-900">{appointment.encounter.temperature}°C</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.encounter.respiratory_rate && (
                                            <div className="flex items-center gap-3 p-3 bg-sky-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
                                                    <Wind className="w-4 h-4 text-sky-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Respiratory Rate</p>
                                                    <p className="text-sm font-bold text-gray-900">{appointment.encounter.respiratory_rate} /min</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.encounter.oxygen_saturation && (
                                            <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
                                                    <Activity className="w-4 h-4 text-teal-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">O₂ Saturation</p>
                                                    <p className="text-sm font-bold text-gray-900">{appointment.encounter.oxygen_saturation}%</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.encounter.weight && (
                                            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                                    <Activity className="w-4 h-4 text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Weight</p>
                                                    <p className="text-sm font-bold text-gray-900">{appointment.encounter.weight} kg</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.encounter.height && (
                                            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                    <Activity className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Height</p>
                                                    <p className="text-sm font-bold text-gray-900">{appointment.encounter.height} cm</p>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.encounter.bmi && (
                                            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                                                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                                                    <Activity className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">BMI</p>
                                                    <p className="text-sm font-bold text-gray-900">{appointment.encounter.bmi}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Clinical Notes Card */}
                        {appointment.encounter && (appointment.encounter.chief_complaint || appointment.encounter.history_of_present_illness || 
                         appointment.encounter.examination_notes || appointment.encounter.clinical_assessment || 
                         appointment.encounter.treatment_plan || appointment.encounter.additional_notes) && (
                            <Card className="border-2 shadow-sm">
                                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                                    <CardTitle className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                            <Clipboard className="w-5 h-5 text-white" />
                                        </div>
                                        <span>Clinical Notes</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    {appointment.encounter.chief_complaint && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <AlertCircle className="w-3 h-3" />
                                                Chief Complaint
                                            </p>
                                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.chief_complaint}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.history_of_present_illness && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <BookOpen className="w-3 h-3" />
                                                History of Present Illness
                                            </p>
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.history_of_present_illness}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.examination_notes && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <Stethoscope className="w-3 h-3" />
                                                Examination Notes
                                            </p>
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.examination_notes}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.clinical_assessment && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <ClipboardCheck className="w-3 h-3" />
                                                Clinical Assessment
                                            </p>
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.clinical_assessment}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.treatment_plan && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <Target className="w-3 h-3" />
                                                Treatment Plan
                                            </p>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.treatment_plan}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.additional_notes && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <MessageSquare className="w-3 h-3" />
                                                Additional Notes
                                            </p>
                                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.additional_notes}</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* AI Notes Card */}
                        {appointment.encounter && (appointment.encounter.ai_note || appointment.encounter.ai_summary) && (
                            <Card className="border-2 shadow-sm border-purple-200">
                                <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b">
                                    <CardTitle className="flex items-center gap-3 justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                                <Sparkles className="w-5 h-5 text-white" />
                                            </div>
                                            <span>AI-Generated Notes</span>
                                        </div>
                                        {appointment.encounter.ai_note_status && (
                                            <Badge variant="secondary" className="capitalize">
                                                {appointment.encounter.ai_note_status}
                                            </Badge>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    {appointment.encounter.ai_note && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-purple-600 font-semibold mb-2 flex items-center gap-2">
                                                <Brain className="w-3 h-3" />
                                                AI Clinical Note
                                            </p>
                                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.ai_note}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.ai_summary && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-indigo-600 font-semibold mb-2 flex items-center gap-2">
                                                <Sparkles className="w-3 h-3" />
                                                AI Summary
                                            </p>
                                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.ai_summary}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.report_sent_to_patient && (
                                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <p className="text-sm text-green-700 font-medium">Report sent to patient</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Mental Health Fields Card */}
                        {appointment.encounter && (appointment.encounter.mental_state_exam || appointment.encounter.mood_affect || 
                         appointment.encounter.thought_process || appointment.encounter.cognitive_assessment || 
                         appointment.encounter.risk_assessment || appointment.encounter.therapeutic_interventions || 
                         appointment.encounter.session_goals || appointment.encounter.homework_assignments) && (
                            <Card className="border-2 shadow-sm border-teal-200">
                                <CardHeader className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
                                    <CardTitle className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                            <Brain className="w-5 h-5 text-white" />
                                        </div>
                                        <span>Mental Health Assessment</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    {appointment.encounter.mental_state_exam && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Mental State Exam</p>
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.mental_state_exam}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.mood_affect && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Mood & Affect</p>
                                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.mood_affect}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.thought_process && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Thought Process</p>
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.thought_process}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.cognitive_assessment && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Cognitive Assessment</p>
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.cognitive_assessment}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.risk_assessment && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-red-600 font-semibold mb-2 flex items-center gap-2">
                                                <AlertTriangle className="w-3 h-3" />
                                                Risk Assessment
                                            </p>
                                            <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.risk_assessment}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.therapeutic_interventions && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Therapeutic Interventions</p>
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.therapeutic_interventions}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.session_goals && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <Target className="w-3 h-3" />
                                                Session Goals
                                            </p>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.session_goals}</p>
                                            </div>
                                        </div>
                                    )}

                                    {appointment.encounter.homework_assignments && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2">
                                                <BookOpen className="w-3 h-3" />
                                                Homework Assignments
                                            </p>
                                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.encounter.homework_assignments}</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Prescriptions Card */}
                        {appointment.encounter && appointment.encounter.prescriptions && appointment.encounter.prescriptions.length > 0 && (
                            <Card className="border-2 shadow-sm border-orange-200">
                                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                                    <CardTitle className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                                            <Pill className="w-5 h-5 text-white" />
                                        </div>
                                        <span>Prescriptions ({appointment.encounter.prescriptions.length})</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-3">
                                        {appointment.encounter.prescriptions.map((prescription: any, index: number) => (
                                            <div key={index} className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                                        <Pill className="w-4 h-4 text-orange-600" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-gray-900 mb-1">{prescription.medicine_name}</p>
                                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                                            {prescription.dosage && (
                                                                <div>
                                                                    <span className="text-gray-500">Dosage:</span>
                                                                    <span className="ml-1 text-gray-700 font-medium">{prescription.dosage}</span>
                                                                </div>
                                                            )}
                                                            {prescription.frequency && (
                                                                <div>
                                                                    <span className="text-gray-500">Frequency:</span>
                                                                    <span className="ml-1 text-gray-700 font-medium">{prescription.frequency}</span>
                                                                </div>
                                                            )}
                                                            {prescription.duration && (
                                                                <div>
                                                                    <span className="text-gray-500">Duration:</span>
                                                                    <span className="ml-1 text-gray-700 font-medium">{prescription.duration}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {prescription.instructions && (
                                                            <div className="mt-2 p-2 bg-white rounded border border-orange-100">
                                                                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Instructions</p>
                                                                <p className="text-sm text-gray-700">{prescription.instructions}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Additional Information */}
                        {(appointment.notes || appointment.contact_person) && (
                            <Card className="border-2 shadow-sm">
                                <CardHeader className="bg-gray-50 border-b">
                                    <CardTitle className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-gray-600" />
                                        <span>Additional Information</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    {appointment.contact_person && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Contact Person</p>
                                            <p className="font-semibold text-gray-900">{appointment.contact_person}</p>
                                        </div>
                                    )}

                                    {appointment.notes && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Notes</p>
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{appointment.notes}</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right Column - Service & Practitioners */}
                    <div className="space-y-6">
                        {/* Service Details Card */}
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <Stethoscope className="w-5 h-5 text-white" />
                                    </div>
                                    <span>Service</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-3">
                                    <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg p-4">
                                        <p className="text-sm font-medium text-gray-600 mb-1">Service Type</p>
                                        <p className="text-xl font-bold text-gray-900">{appointment.service.name}</p>
                                        {appointment.service.category && (
                                            <Badge variant="secondary" className="mt-2 capitalize">
                                                {appointment.service.category}
                                            </Badge>
                                        )}
                                    </div>

                                    {appointment.service.description && (
                                        <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                                            {appointment.service.description}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Practitioners Card */}
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                                        <UserCheck className="w-5 h-5 text-white" />
                                    </div>
                                    <span>Healthcare Providers</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {/* Primary Practitioner */}
                                {primaryPractitioner && (
                                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border-2 border-amber-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="w-4 h-4 text-amber-600" />
                                            <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Primary Provider</p>
                                        </div>
                                        <p className="text-lg font-bold text-gray-900">{primaryPractitioner.name}</p>
                                    </div>
                                )}

                                {/* Other Practitioners */}
                                {otherPractitioners.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Other Providers</p>
                                        <div className="space-y-2">
                                            {otherPractitioners.map((practitioner, index) => (
                                                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                        <UserCheck className="w-4 h-4 text-gray-600" />
                                                    </div>
                                                    <p className="font-medium text-gray-900">{practitioner.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!primaryPractitioner && otherPractitioners.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-4">No practitioners assigned</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Booking Information Card */}
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="bg-gray-50 border-b">
                                <CardTitle className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-gray-600" />
                                    <span>Booking Details</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-600">Booking Source</p>
                                    <Badge variant="secondary" className="capitalize">
                                        {appointment.booking_source}
                                    </Badge>
                                </div>

                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-600">Time Preference</p>
                                    <Badge variant="outline" className="capitalize">
                                        {appointment.date_time_preference}
                                    </Badge>
                                </div>

                                <div className="border-t pt-3 mt-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Intake Form</span>
                                        <span className={appointment.send_intake_form ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                                            {appointment.send_intake_form ? '✓ Sent' : 'Not sent'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Confirmation</span>
                                        <span className={appointment.send_appointment_confirmation ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                                            {appointment.send_appointment_confirmation ? '✓ Sent' : 'Not sent'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Calendar Invite</span>
                                        <span className={appointment.add_to_calendar ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                                            {appointment.add_to_calendar ? '✓ Added' : 'Not added'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* System Information Card */}
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="bg-gray-50 border-b">
                                <CardTitle className="text-sm">System Information</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="text-xs text-gray-600 space-y-2">
                                    <div className="flex justify-between">
                                        <span>Created:</span>
                                        <span className="font-medium">{formatDateTime(appointment.created_at)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Last Updated:</span>
                                        <span className="font-medium">{formatDateTime(appointment.updated_at)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}

export default withAppLayout(Show, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'Details' }
    ]
});


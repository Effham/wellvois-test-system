import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    ArrowLeft, 
    User, 
    Calendar, 
    FileText, 
    Activity, 
    Phone, 
    Mail, 
    MapPin,
    Heart,
    Pill,
    Download,
    Eye,
    Clock,
    CheckCircle
} from 'lucide-react';

interface Patient {
    id: number;
    health_number?: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    gender_pronouns?: string;
    email: string;
    phone_number?: string;
    emergency_contact_phone?: string;
    street_address?: string;
    city?: string;
    province?: string;
    postal_zip_code?: string;
    invitation_status: string;
    created_at: string;
    // Medical information
    presenting_concern?: string;
    goals_for_therapy?: string;
    previous_therapy_experience?: string;
    current_medications?: string;
    diagnoses?: string;
    history_of_hospitalization?: string;
    risk_safety_concerns?: string;
    other_medical_conditions?: string;
    cultural_religious_considerations?: string;
    accessibility_needs?: string;
    // Insurance
    insurance_provider?: string;
    policy_number?: string;
    // Contact preferences
    language_preferences?: string;
    best_time_to_contact?: string;
    best_way_to_contact?: string;
}

interface Service {
    id: number;
    name: string;
}

interface Location {
    id: number;
    name: string;
    street_address?: string;
    city?: string;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
}

interface Appointment {
    id: number;
    appointment_datetime: string;
    status: string;
    mode: string;
    service: Service;
    location?: Location;
    practitioners: Practitioner[];
    created_at: string;
}

interface Document {
    id: number;
    original_name: string;
    file_size_human: string;
    document_type: string;
    document_type_display: string;
    uploaded_by_type: string;
    uploaded_by_id: number;
    document_request_id?: number;
    created_at: string;
    documentRequest?: DocumentRequest;
    uploadedByUser?: {
        id: number;
        name: string;
        email: string;
    };
}

interface DocumentRequest {
    id: number;
    document_type: string;
    title: string;
    priority: string;
    status: string;
    requested_by_id: number;
    requested_at: string;
    requestedBy?: {
        id: number;
        name: string;
        email: string;
    };
}

interface Prescription {
    id: number;
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
}

interface Encounter {
    id: number;
    status: string;
    chief_complaint?: string;
    examination_notes?: string;
    clinical_assessment?: string;
    treatment_plan?: string;
    session_started_at?: string;
    session_completed_at?: string;
    created_at: string;
    appointment: Appointment;
    prescriptions: Prescription[];
    documents: Document[];
    documentRequests: DocumentRequest[];
}

interface Stats {
    total_appointments: number;
    completed_appointments: number;
    total_encounters: number;
    total_documents: number;
    total_document_requests: number;
    pending_document_requests: number;
}

interface FamilyMedicalHistory {
    id: number;
    patient_id: number;
    summary: string;
    relationship_to_patient: string;
    details?: string;
    diagnosis_date?: string;
    created_at: string;
    updated_at: string;
}

interface PatientMedicalHistory {
    id: number;
    patient_id: number;
    disease: string;
    recent_tests?: string;
    created_at: string;
    updated_at: string;
}

interface KnownAllergy {
    id: number;
    patient_id: number;
    allergens: string;
    type: string;
    severity: 'mild' | 'moderate' | 'severe';
    reaction?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

interface Props {
    patient: Patient;
    appointments: Appointment[];
    encounters: Encounter[];
    stats: Stats;
    familyMedicalHistories?: FamilyMedicalHistory[];
    patientMedicalHistories?: PatientMedicalHistory[];
    knownAllergies?: KnownAllergy[];
    aiPatientOverview?: string;
}

function PatientShow({ 
    patient, 
    appointments, 
    encounters, 
    stats, 
    familyMedicalHistories = [], 
    patientMedicalHistories = [], 
    knownAllergies = [],
    aiPatientOverview = '' 
}: Props) {
    const [activeTab, setActiveTab] = useState('overview');

    const breadcrumbs = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Patients', href: '/patients' },
        { title: `${patient.first_name} ${patient.last_name}`, href: '' },
    ];

    const formatDateTime = (dateTime: string) => {
        return new Date(dateTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'confirmed':
                return 'bg-blue-100 text-blue-800';
            case 'pending':
            case 'pending_invitation':
                return 'bg-yellow-100 text-yellow-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            case 'accepted':
                return 'bg-green-100 text-green-800';
            case 'expired':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatInvitationStatus = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending_invitation':
                return 'Pending Invitation';
            case 'accepted':
                return 'Accepted';
            case 'expired':
                return 'Expired';
            case 'cancelled':
                return 'Cancelled';
            default:
                return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        }
    };

    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Name not provided';
    const displayName = patient.preferred_name || fullName;

    // Check if patient has any medical information to show the medical tab
    const hasMedicalInfo = !!(
        patient.presenting_concern ||
        patient.goals_for_therapy ||
        patient.previous_therapy_experience ||
        patient.current_medications ||
        patient.diagnoses ||
        patient.history_of_hospitalization ||
        patient.risk_safety_concerns ||
        patient.other_medical_conditions ||
        patient.cultural_religious_considerations ||
        patient.accessibility_needs ||
        patient.insurance_provider ||
        patient.policy_number ||
        patient.language_preferences ||
        patient.best_time_to_contact ||
        patient.best_way_to_contact ||
        familyMedicalHistories.length > 0 ||
        patientMedicalHistories.length > 0 ||
        knownAllergies.length > 0
    );

    return (
        <>
            <Head title={`Patient Details - ${fullName}`} />

            <div className="max-w-full mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                            <p className="text-gray-600">
                                {patient.health_number && `Health #: ${patient.health_number} • `}
                                Patient since {formatDate(patient.created_at)}
                            </p>
                        </div>
                    </div>
                    <Link href="/patients">
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Patients
                        </Button>
                    </Link>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card>
                        <CardContent className="p-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-blue-500" />
                                <div>
                                    <p className="text-2xl font-bold">{stats.total_appointments}</p>
                                    <p className="text-xs text-gray-500">Appointments</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <div>
                                    <p className="text-2xl font-bold">{stats.completed_appointments}</p>
                                    <p className="text-xs text-gray-500">Completed</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-purple-500" />
                                <div>
                                    <p className="text-2xl font-bold">{stats.total_encounters}</p>
                                    <p className="text-xs text-gray-500">Sessions</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                <div>
                                    <p className="text-2xl font-bold">{stats.total_documents}</p>
                                    <p className="text-xs text-gray-500">Documents</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Layout - Left: Patient Details (80%), Right: AI Overview (20%) */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    {/* Left Side - Patient Details (80%) */}
                    <div className="lg:col-span-4">
                        {/* Main Content Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="appointments">Appointments</TabsTrigger>
                        <TabsTrigger value="sessions">Sessions</TabsTrigger>
                        <TabsTrigger value="documents">Documents</TabsTrigger>
                        {hasMedicalInfo && <TabsTrigger value="medical">Medical Info</TabsTrigger>}
                        <TabsTrigger value="family-history">Family History</TabsTrigger>
                        <TabsTrigger value="patient-history">Patient History</TabsTrigger>
                        <TabsTrigger value="allergies">Allergies</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Personal Information */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="h-5 w-5" />
                                        Personal Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Full Name</p>
                                            <p className="text-sm">{fullName}</p>
                                        </div>
                                        {patient.preferred_name && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Preferred Name</p>
                                                <p className="text-sm">{patient.preferred_name}</p>
                                            </div>
                                        )}
                                        {patient.date_of_birth && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                                                <p className="text-sm">{formatDate(patient.date_of_birth)}</p>
                                            </div>
                                        )}
                                        {patient.gender && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">Gender</p>
                                                <p className="text-sm capitalize">{patient.gender}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Contact Information */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Phone className="h-5 w-5" />
                                        Contact Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm">{patient.email}</span>
                                    </div>
                                    {patient.phone_number && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-gray-500" />
                                            <span className="text-sm">{patient.phone_number}</span>
                                        </div>
                                    )}
                                    {patient.emergency_contact_phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-red-500" />
                                            <span className="text-sm">Emergency: {patient.emergency_contact_phone}</span>
                                        </div>
                                    )}
                                    {(patient.street_address || patient.city) && (
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                                            <div className="text-sm">
                                                {patient.street_address && <div>{patient.street_address}</div>}
                                                {(patient.city || patient.province) && (
                                                    <div>{patient.city}{patient.province && `, ${patient.province}`} {patient.postal_zip_code}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Activity */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {appointments.slice(0, 3).map((appointment) => (
                                        <div key={appointment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                            <div className="flex items-center gap-3">
                                                <Calendar className="h-4 w-4 text-gray-500" />
                                                <div>
                                                    <p className="text-sm font-medium">{appointment.service.name}</p>
                                                    <p className="text-xs text-gray-500">{formatDateTime(appointment.appointment_datetime)}</p>
                                                </div>
                                            </div>
                                            <Badge className={getStatusColor(appointment.status)}>
                                                {appointment.status}
                                            </Badge>
                                        </div>
                                    ))}
                                    {appointments.length === 0 && (
                                        <p className="text-sm text-gray-500 text-center py-4">No appointments yet</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Appointments Tab */}
                    <TabsContent value="appointments">
                        <Card>
                            <CardHeader>
                                <CardTitle>All Appointments</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {appointments.map((appointment) => (
                                        <div key={appointment.id} className="border rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium">{appointment.service.name}</h4>
                                                        <Badge className={getStatusColor(appointment.status)}>
                                                            {appointment.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        {formatDateTime(appointment.appointment_datetime)}
                                                    </p>
                                                    {appointment.location && (
                                                        <p className="text-sm text-gray-500">
                                                            📍 {appointment.location.name}
                                                        </p>
                                                    )}
                                                    <p className="text-sm text-gray-500">
                                                        Mode: <span className="capitalize">{appointment.mode}</span>
                                                    </p>
                                                    {appointment.practitioners.length > 0 && (
                                                        <p className="text-sm text-gray-500">
                                                            Practitioners: {appointment.practitioners.map(p => `${p.first_name} ${p.last_name}`).join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {appointments.length === 0 && (
                                        <p className="text-center text-gray-500 py-8">No appointments found</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Sessions Tab */}
                    <TabsContent value="sessions">
                        <Card>
                            <CardHeader>
                                <CardTitle>Session History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {encounters.map((encounter) => (
                                        <div key={encounter.id} className="border rounded-lg p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h4 className="font-medium">{encounter.appointment.service.name}</h4>
                                                    <p className="text-sm text-gray-600">{formatDateTime(encounter.created_at)}</p>
                                                </div>
                                                <Badge className={getStatusColor(encounter.status)}>
                                                    {encounter.status}
                                                </Badge>
                                            </div>
                                            
                                            {encounter.chief_complaint && (
                                                <div className="mb-2">
                                                    <p className="text-sm font-medium text-gray-700">Chief Complaint:</p>
                                                    <p className="text-sm text-gray-600">{encounter.chief_complaint}</p>
                                                </div>
                                            )}
                                            
                                            {encounter.prescriptions.length > 0 && (
                                                <div className="mb-2">
                                                    <p className="text-sm font-medium text-gray-700">Prescriptions:</p>
                                                    <div className="space-y-1">
                                                        {encounter.prescriptions.map((prescription) => (
                                                            <div key={prescription.id} className="text-sm text-gray-600">
                                                                <Pill className="inline h-3 w-3 mr-1" />
                                                                {prescription.medicine_name} - {prescription.dosage}, {prescription.frequency}, {prescription.duration}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {encounter.documents.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700">Documents ({encounter.documents.length}):</p>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {encounter.documents.map((doc) => (
                                                            <Badge key={doc.id} variant="outline">
                                                                {doc.original_name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {encounters.length === 0 && (
                                        <p className="text-center text-gray-500 py-8">No sessions found</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Documents Tab */}
                    <TabsContent value="documents">
                        <Card>
                            <CardHeader>
                                <CardTitle>All Documents</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {encounters.map((encounter) => (
                                        encounter.documents.length > 0 && (
                                            <div key={encounter.id} className="border rounded-lg p-4">
                                                <h4 className="font-medium mb-4 text-lg">
                                                    {encounter.appointment.service.name} - {formatDate(encounter.created_at)}
                                                </h4>
                                                <div className="space-y-3">
                                                    {encounter.documents.map((doc) => (
                                                        <div key={doc.id} className="border rounded-lg p-4 bg-gray-50">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                                                        <div className="min-w-0">
                                                                            <h5 className="text-sm font-semibold truncate">{doc.original_name}</h5>
                                                                            <p className="text-xs text-gray-500">{doc.file_size_human} • {doc.document_type_display}</p>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                                        {/* Document Type */}
                                                                        <div>
                                                                            <p className="font-medium text-gray-700">Document Type</p>
                                                                            <p className="text-gray-600">{doc.document_type_display}</p>
                                                                        </div>
                                                                        
                                                                        {/* Upload Information */}
                                                                        <div>
                                                                            <p className="font-medium text-gray-700">Uploaded By</p>
                                                                            <p className="text-gray-600">
                                                                                {doc.uploadedByUser?.name || 'System/Unknown'}
                                                                            </p>
                                                                            <p className="text-gray-500">{formatDateTime(doc.created_at)}</p>
                                                                        </div>
                                                                        
                                                                        {/* Request Information */}
                                                                        <div>
                                                                            <p className="font-medium text-gray-700">Request Details</p>
                                                                            {doc.documentRequest ? (
                                                                                <div>
                                                                                    <p className="text-gray-600">"{doc.documentRequest.title}"</p>
                                                                                    <p className="text-gray-500">
                                                                                        Requested by: {doc.documentRequest.requestedBy?.name || 'Unknown'}
                                                                                    </p>
                                                                                    <Badge className="mt-1 bg-green-100 text-green-800 text-xs">
                                                                                        Requested Document
                                                                                    </Badge>
                                                                                </div>
                                                                            ) : (
                                                                                <div>
                                                                                    <p className="text-gray-600">Additional upload</p>
                                                                                    <Badge className="mt-1 bg-blue-100 text-blue-800 text-xs">
                                                                                        Self-Uploaded
                                                                                    </Badge>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-2 ml-4">
                                                                    <Link href={route('encounters.documents.show', [encounter.id, doc.id])}>
                                                                        <Button variant="outline" size="sm" className="h-8">
                                                                            <Eye className="h-3 w-3 mr-1" />
                                                                            View
                                                                        </Button>
                                                                    </Link>
                                                                    <Link href={route('encounters.documents.download', [encounter.id, doc.id])}>
                                                                        <Button variant="outline" size="sm" className="h-8">
                                                                            <Download className="h-3 w-3 mr-1" />
                                                                            Download
                                                                        </Button>
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                    {encounters.every(e => e.documents.length === 0) && (
                                        <p className="text-center text-gray-500 py-8">No documents found</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Medical Information Tab */}
                    {hasMedicalInfo && <TabsContent value="medical">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Medical History */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Heart className="h-5 w-5" />
                                        Medical History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {patient.presenting_concern && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Presenting Concern</p>
                                            <p className="text-sm text-gray-600">{patient.presenting_concern}</p>
                                        </div>
                                    )}
                                    {patient.current_medications && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Current Medications</p>
                                            <p className="text-sm text-gray-600">{patient.current_medications}</p>
                                        </div>
                                    )}
                                    {patient.diagnoses && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Diagnoses</p>
                                            <p className="text-sm text-gray-600">{patient.diagnoses}</p>
                                        </div>
                                    )}
                                    {patient.other_medical_conditions && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Other Medical Conditions</p>
                                            <p className="text-sm text-gray-600">{patient.other_medical_conditions}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Therapy Information */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Therapy Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {patient.goals_for_therapy && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Goals for Therapy</p>
                                            <p className="text-sm text-gray-600">{patient.goals_for_therapy}</p>
                                        </div>
                                    )}
                                    {patient.previous_therapy_experience && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Previous Therapy Experience</p>
                                            <p className="text-sm text-gray-600">{patient.previous_therapy_experience}</p>
                                        </div>
                                    )}
                                    {patient.cultural_religious_considerations && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Cultural/Religious Considerations</p>
                                            <p className="text-sm text-gray-600">{patient.cultural_religious_considerations}</p>
                                        </div>
                                    )}
                                    {patient.accessibility_needs && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Accessibility Needs</p>
                                            <p className="text-sm text-gray-600">{patient.accessibility_needs}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Insurance Information */}
                            {(patient.insurance_provider || patient.policy_number) && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Insurance Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {patient.insurance_provider && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Provider</p>
                                                <p className="text-sm text-gray-600">{patient.insurance_provider}</p>
                                            </div>
                                        )}
                                        {patient.policy_number && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Policy Number</p>
                                                <p className="text-sm text-gray-600">{patient.policy_number}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Contact Preferences */}
                            {(patient.language_preferences || patient.best_time_to_contact || patient.best_way_to_contact) && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Contact Preferences</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {patient.language_preferences && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Language Preferences</p>
                                                <p className="text-sm text-gray-600">{patient.language_preferences}</p>
                                            </div>
                                        )}
                                        {patient.best_time_to_contact && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Best Time to Contact</p>
                                                <p className="text-sm text-gray-600">{patient.best_time_to_contact}</p>
                                            </div>
                                        )}
                                        {patient.best_way_to_contact && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Best Way to Contact</p>
                                                <p className="text-sm text-gray-600">{patient.best_way_to_contact}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>}

                    {/* Family Medical History Tab */}
                    <TabsContent value="family-history">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Heart className="h-5 w-5" />
                                    Family Medical History
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {familyMedicalHistories.length > 0 ? (
                                    <div className="space-y-4">
                                        {familyMedicalHistories.map((history) => (
                                            <div key={history.id} className="border rounded-lg p-4 bg-gray-50">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-sm">{history.relationship_to_patient}</h4>
                                                        {history.diagnosis_date && (
                                                            <p className="text-xs text-gray-500">{formatDate(history.diagnosis_date)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-700">Summary</p>
                                                        <p className="text-xs text-gray-600">{history.summary}</p>
                                                    </div>
                                                    {history.details && (
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-700">Details</p>
                                                            <p className="text-xs text-gray-600">{history.details}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No data for Family Medical History</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Patient Medical History Tab */}
                    <TabsContent value="patient-history">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5" />
                                    Patient Medical History
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {patientMedicalHistories.length > 0 ? (
                                    <div className="space-y-4">
                                        {patientMedicalHistories.map((history) => (
                                            <div key={history.id} className="border rounded-lg p-4 bg-gray-50">
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Disease</p>
                                                        <p className="text-sm text-gray-600">{history.disease}</p>
                                                    </div>
                                                    {history.recent_tests && (
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-700">Recent Tests</p>
                                                            <p className="text-sm text-gray-600">{history.recent_tests}</p>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-gray-500">Added {formatDate(history.created_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No data for Patient Medical History</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Known Allergies Tab */}
                    <TabsContent value="allergies">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Pill className="h-5 w-5" />
                                    Known Allergies
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {knownAllergies.length > 0 ? (
                                    <div className="space-y-4">
                                        {knownAllergies.map((allergy) => (
                                            <div key={allergy.id} className="border rounded-lg p-4 bg-gray-50">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-sm">{allergy.allergens}</h4>
                                                        <p className="text-xs text-gray-500">Type: {allergy.type}</p>
                                                    </div>
                                                    <Badge className={
                                                        allergy.severity === 'severe' ? 'bg-red-100 text-red-800' :
                                                        allergy.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }>
                                                        {allergy.severity}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {allergy.reaction && (
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-700">Reaction</p>
                                                            <p className="text-xs text-gray-600">{allergy.reaction}</p>
                                                        </div>
                                                    )}
                                                    {allergy.notes && (
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-700">Notes</p>
                                                            <p className="text-xs text-gray-600">{allergy.notes}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No data for Known Allergies</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                        </Tabs>
                    </div>

                    {/* Right Side - AI Patient Overview (20%) */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-blue-800">
                                        <Activity className="h-5 w-5" />
                                        AI Patient Overview
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-2">
                                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                            {aiPatientOverview || `${displayName} has been receiving care at our clinic since ${formatDate(patient.created_at)}. This patient demonstrates a consistent commitment to their healthcare journey, actively participating in scheduled appointments and maintaining open communication with our medical team.`}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default withAppLayout(PatientShow, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Patients', href: route('patients.index') },
        { title: 'Patient Details' }
    ]
}); 
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, AlertCircle, Stethoscope, Timer } from 'lucide-react';

interface IntroProps {
    appointment?: any;
    patient?: any;
    practitioner?: any;
}

export default function SessionIntro({ appointment, patient, practitioner }: IntroProps) {
    // Show loading state while deferred data is being fetched
    if (!appointment || !practitioner) {
        return (
            <AppLayout
                breadcrumbs={[
                    { title: 'Dashboard', href: '/dashboard' },
                    { title: 'Current Session', href: '/current-session' },
                ]}
            >
                <Head title="Current Session" />
                <div className="p-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-center p-8">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-muted-foreground">Loading session data...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // Use real patient data if available, otherwise fallback to mock
    const patientInfo = patient ? {
        name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        age: patient.age || 'N/A',
        gender: patient.gender || 'N/A',
        mrn: patient.mrn || patient.health_number || 'N/A',
        dob: patient.dob || patient.date_of_birth || 'N/A',
        allergies: patient.allergies || [],
        lastVisit: patient.last_visit || 'N/A',
        conditions: patient.conditions || patient.medical_conditions || [],
        email: patient.email || 'N/A',
        phone: patient.phone || patient.phone_number || 'N/A'
    } : {
        name: "John Doe",
        first_name: "John",
        last_name: "Doe",
        age: 45,
        gender: "Male", 
        mrn: "MRN12345",
        dob: "1978-05-15",
        allergies: ["Penicillin", "Shellfish"],
        lastVisit: "2023-10-15",
        conditions: ["Hypertension", "Type 2 Diabetes"],
        email: "john.doe@example.com",
        phone: "+1234567890"
    };

    const startSession = () => {
        // Navigate to the active session page
        router.visit(`/session/active/${appointment?.id}`);
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Current Session', href: '/current-session' },
            ]}
        >
            <Head title="Current Session" />
            <div className="p-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-semibold text-primary mb-1">
                            Session Ready
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {appointment?.service?.name || 'Consultation'} • {appointment?.appointment_datetime && new Date(appointment.appointment_datetime).toLocaleDateString()}
                        </p>
                    </div>

                    {/* Patient Summary Bar */}
                    <div className="bg-white border border-border rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                    <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-medium text-primary">{patientInfo.name}</h2>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>MRN: {patientInfo.mrn}</span>
                                        <span>•</span>
                                        <span>{patientInfo.age} years</span>
                                        <span>•</span>
                                        <span>{patientInfo.gender}</span>
                                        <span>•</span>
                                        <span>{patientInfo.email}</span>
                                        <span>•</span>
                                        <span>{patientInfo.phone}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                                <div>DOB: {patientInfo.dob}</div>
                                <div>Last Visit: {patientInfo.lastVisit}</div>
                            </div>
                        </div>
                    </div>

                    {/* Key Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    Allergies & Alerts
                                </h3>
                                {patientInfo.allergies?.length > 0 ? (
                                    <div className="space-y-1">
                                        {patientInfo.allergies.map((allergy: string, index: number) => (
                                            <div key={index} className="bg-destructive/10 border border-destructive/20 rounded px-3 py-1 text-sm text-destructive">
                                                <span className="font-medium">Allergy:</span> {allergy}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                                        No known allergies documented
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-primary mb-2">Active Conditions</h3>
                                {patientInfo.conditions?.length > 0 ? (
                                    <div className="space-y-1">
                                        {patientInfo.conditions.map((condition: string, index: number) => (
                                            <div key={index} className="text-sm bg-muted rounded px-3 py-1">
                                                {condition}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                                        No active conditions documented
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column */}
                        <div>
                            <h3 className="text-sm font-medium text-primary mb-2">Today's Appointment</h3>
                            <div className="bg-muted rounded p-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Service:</span>
                                    <span className="font-medium">{appointment?.service?.name || 'General Consultation'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Provider:</span>
                                    <span className="font-medium">{practitioner?.first_name} {practitioner?.last_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Mode:</span>
                                    <span className="font-medium">{appointment?.mode === 'virtual' ? 'Virtual' : 'In-person'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Time:</span>
                                    <span className="font-medium">
                                        {appointment?.appointment_datetime && new Date(appointment.appointment_datetime).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Start Session Section */}
                    <div className="text-center">
                        <div className="bg-muted border border-border rounded-lg p-6">
                            <div className="max-w-md mx-auto">
                                <Stethoscope className="h-6 w-6 text-primary mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-primary mb-1">Ready to Begin</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    All patient information has been reviewed. Start the consultation session.
                                </p>
                                <Button 
                                    onClick={startSession} 
                                    size="lg" 
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3"
                                >
                                    <Timer className="mr-2 h-4 w-4" />
                                    Start Session
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}


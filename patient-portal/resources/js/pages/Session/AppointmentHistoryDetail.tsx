import React from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Pill, AlertCircle } from 'lucide-react';

interface AppointmentHistoryDetailProps {
    appointment: {
        date: string;
        type: string;
        chiefComplaint: string;
        historyOfPresentIllness?: string;
        findings: string[];
        clinicalAssessment?: string;
        treatmentPlan?: string;
        additionalNotes?: string;
        prescriptions: string[];
        vitalSigns?: {
            bloodPressure?: string;
            heartRate?: string;
            temperature?: string;
            weight?: string;
        };
        mentalHealthData?: {
            mentalStateExam?: string;
            moodAffect?: string;
            thoughtProcess?: string;
            cognitiveAssessment?: string;
            riskAssessment?: string;
            therapeuticInterventions?: string;
            sessionGoals?: string;
            homeworkAssignments?: string;
        };
        status?: string;
        sessionDuration?: string;
    };
    currentSessionId: number;
}

export default function AppointmentHistoryDetail({ appointment, currentSessionId }: AppointmentHistoryDetailProps) {
    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Current Session', href: `/current-session/${currentSessionId}` },
                { title: 'Appointment History', href: '' },
            ]}
        >
            <Head title="Appointment History Detail" />

            <div className="p-6 max-w-5xl mx-auto">
                {/* Back Button */}
                <div className="mb-6">
                    <Link href={`/current-session/${currentSessionId}`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Current Session
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="bg-white border border-border rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-primary">Appointment Details</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                {appointment.type} • {appointment.date}
                            </p>
                        </div>
                        {appointment.status && (
                            <Badge className="capitalize">
                                {appointment.status}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    {/* Chief Complaint */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-sm font-medium text-primary mb-3">Chief Complaint</h3>
                            <p className="text-sm bg-muted rounded p-4">{appointment.chiefComplaint}</p>
                        </CardContent>
                    </Card>

                    {/* History of Present Illness */}
                    {appointment.historyOfPresentIllness && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-sm font-medium text-primary mb-3">History of Present Illness</h3>
                                <p className="text-sm bg-muted rounded p-4">{appointment.historyOfPresentIllness}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Examination Notes */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-sm font-medium text-primary mb-3">Examination Notes</h3>
                            <div className="space-y-2">
                                {appointment.findings.map((finding, index) => (
                                    <div key={index} className="text-sm bg-muted rounded p-4 flex items-start gap-3">
                                        <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                                        <span>{finding}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Clinical Assessment */}
                    {appointment.clinicalAssessment && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-sm font-medium text-primary mb-3">Clinical Assessment</h3>
                                <p className="text-sm bg-muted rounded p-4">{appointment.clinicalAssessment}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Treatment Plan */}
                    {appointment.treatmentPlan && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-sm font-medium text-primary mb-3">Treatment Plan</h3>
                                <p className="text-sm bg-muted rounded p-4">{appointment.treatmentPlan}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Additional Notes */}
                    {appointment.additionalNotes && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-sm font-medium text-primary mb-3">Additional Notes</h3>
                                <p className="text-sm bg-muted rounded p-4">{appointment.additionalNotes}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Vital Signs */}
                    {appointment.vitalSigns && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-sm font-medium text-primary mb-3">Vital Signs</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    {appointment.vitalSigns.bloodPressure && (
                                        <div className="bg-muted rounded p-4">
                                            <div className="font-medium text-primary">Blood Pressure</div>
                                            <div className="mt-1">{appointment.vitalSigns.bloodPressure}</div>
                                        </div>
                                    )}
                                    {appointment.vitalSigns.heartRate && (
                                        <div className="bg-muted rounded p-4">
                                            <div className="font-medium text-primary">Heart Rate</div>
                                            <div className="mt-1">{appointment.vitalSigns.heartRate} bpm</div>
                                        </div>
                                    )}
                                    {appointment.vitalSigns.temperature && (
                                        <div className="bg-muted rounded p-4">
                                            <div className="font-medium text-primary">Temperature</div>
                                            <div className="mt-1">{appointment.vitalSigns.temperature}°F</div>
                                        </div>
                                    )}
                                    {appointment.vitalSigns.weight && (
                                        <div className="bg-muted rounded p-4">
                                            <div className="font-medium text-primary">Weight</div>
                                            <div className="mt-1">{appointment.vitalSigns.weight} kg</div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Prescriptions */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-sm font-medium text-primary mb-3">Prescriptions & Medications</h3>
                            <div className="space-y-2">
                                {appointment.prescriptions.map((prescription, index) => (
                                    <div key={index} className="text-sm bg-primary/5 border border-primary/20 rounded p-4 flex items-start gap-3">
                                        <Pill className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                        <span>{prescription}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Mental Health Assessment - Show only if data exists */}
                    {appointment.mentalHealthData && (
                        appointment.mentalHealthData.mentalStateExam ||
                        appointment.mentalHealthData.moodAffect ||
                        appointment.mentalHealthData.thoughtProcess ||
                        appointment.mentalHealthData.cognitiveAssessment ||
                        appointment.mentalHealthData.riskAssessment ||
                        appointment.mentalHealthData.therapeuticInterventions ||
                        appointment.mentalHealthData.sessionGoals ||
                        appointment.mentalHealthData.homeworkAssignments
                    ) && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-sm font-medium text-primary mb-3">Mental Health Assessment</h3>
                                <div className="space-y-4">
                                    {appointment.mentalHealthData.mentalStateExam && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Mental State Exam</h4>
                                            <p className="text-sm bg-muted rounded p-4">{appointment.mentalHealthData.mentalStateExam}</p>
                                        </div>
                                    )}
                                    {appointment.mentalHealthData.moodAffect && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Mood & Affect</h4>
                                            <p className="text-sm bg-muted rounded p-4">{appointment.mentalHealthData.moodAffect}</p>
                                        </div>
                                    )}
                                    {appointment.mentalHealthData.thoughtProcess && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Thought Process</h4>
                                            <p className="text-sm bg-muted rounded p-4">{appointment.mentalHealthData.thoughtProcess}</p>
                                        </div>
                                    )}
                                    {appointment.mentalHealthData.cognitiveAssessment && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Cognitive Assessment</h4>
                                            <p className="text-sm bg-muted rounded p-4">{appointment.mentalHealthData.cognitiveAssessment}</p>
                                        </div>
                                    )}
                                    {appointment.mentalHealthData.riskAssessment && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                Risk Assessment
                                            </h4>
                                            <p className="text-sm bg-red-50 border border-red-200 rounded p-4 text-red-800">
                                                {appointment.mentalHealthData.riskAssessment}
                                            </p>
                                        </div>
                                    )}
                                    {appointment.mentalHealthData.therapeuticInterventions && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Therapeutic Interventions</h4>
                                            <p className="text-sm bg-muted rounded p-4">{appointment.mentalHealthData.therapeuticInterventions}</p>
                                        </div>
                                    )}
                                    {appointment.mentalHealthData.sessionGoals && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Session Goals</h4>
                                            <p className="text-sm bg-blue-50 border border-blue-200 rounded p-4 text-blue-800">
                                                {appointment.mentalHealthData.sessionGoals}
                                            </p>
                                        </div>
                                    )}
                                    {appointment.mentalHealthData.homeworkAssignments && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Homework Assignments</h4>
                                            <p className="text-sm bg-green-50 border border-green-200 rounded p-4 text-green-800">
                                                {appointment.mentalHealthData.homeworkAssignments}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Session Information */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-sm font-medium text-primary mb-3">Session Information</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-muted rounded p-4">
                                    <div className="font-medium text-primary">Status</div>
                                    <div className="mt-1 capitalize">{appointment.status || 'Unknown'}</div>
                                </div>
                                <div className="bg-muted rounded p-4">
                                    <div className="font-medium text-primary">Duration</div>
                                    <div className="mt-1">{appointment.sessionDuration || 'Not available'}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer */}
                <div className="mt-8">
                    <Link href={`/current-session/${currentSessionId}`}>
                        <Button className="w-full">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Current Session
                        </Button>
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}



import { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { withLayout } from '@/utils/layout';
import AppLayout from '@/layouts/app-layout';
import PageHeader from '@/components/general/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Brain, RefreshCw, Send, Edit3, Save, X, Calendar, Clock, User, FileText, Loader2, AlertTriangle, Mic } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import AppointmentTabs from '@/components/appointments/AppointmentTabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
}

interface Service {
    id: number;
    name: string;
}

interface Appointment {
    id: number;
    status: string;
    appointment_datetime: string;
    mode: string;
    service: Service;
    created_at: string;
}

interface AISummary {
    id: number;
    summary_text?: string;
    generated_at: string | null;
    status: string;
    message?: string;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
}

interface Encounter {
    id: number;
    chief_complaint?: string;
    examination_notes?: string;
    clinical_assessment?: string;
    treatment_plan?: string;
    blood_pressure?: string;
    heart_rate?: string;
    temperature?: string;
    weight?: string;
    height?: string;
    session_started_at?: string;
    session_completed_at?: string;
    session_duration_seconds?: number;
    status?: string;
}

interface RecordingAISummary {
    summary_text?: string | null;
    summary_type?: string | null;
    status?: string;
}

interface Props {
    appointment: Appointment;
    patient?: Patient;
    aiSummary?: AISummary | null;
    encounter?: Encounter;
    practitioners: Practitioner[];
    hasAIConsent?: boolean;
    user_role?: string;
    recordingAISummary?: RecordingAISummary | null;
    loadedData?: boolean;
}



const SUMMARY_TYPES = [
    { value: 'plain_summary', label: 'Plain Summary' },
    { value: 'soap_note', label: 'SOAP Note' },
    { value: 'history_and_physical', label: 'History and Physical' },
    { value: 'medical_encounter_summary', label: 'Medical Encounter Summary' },
    { value: 'progress_note', label: 'Progress Note' },
    { value: 'discharge_summary', label: 'Discharge Summary' },
    { value: 'operative_note', label: 'Operative Note' },
    { value: 'procedure_note', label: 'Procedure Note' },
    { value: 'emergency_encounter', label: 'Emergency Encounter' },
    { value: 'prescription_summary', label: 'Prescription Summary' },
    { value: 'lab_and_imaging_summary', label: 'Lab and Imaging Summary' },
    { value: 'chronic_disease_followup', label: 'Chronic Disease Follow-up' },
    { value: 'pediatric_visit', label: 'Pediatric Visit' },
    { value: 'antenatal_visit', label: 'Antenatal Visit' },
    { value: 'psychiatry_summary', label: 'Psychiatry Summary' },
    { value: 'telemedicine_summary', label: 'Telemedicine Summary' },
];

function AISummary({ appointment, patient, aiSummary, encounter, practitioners, hasAIConsent = true, user_role = 'admin', recordingAISummary, loadedData = false }: Props) {

    const [isEditing, setIsEditing] = useState(false);
    const [editedSummary, setEditedSummary] = useState(aiSummary?.summary_text);
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [selectedSummaryType, setSelectedSummaryType] = useState<string>(recordingAISummary?.summary_type || 'plain_summary');
    const [isGeneratingRecordingSummary, setIsGeneratingRecordingSummary] = useState(false);
    const [isSummaryTypeDialogOpen, setIsSummaryTypeDialogOpen] = useState(false);

    const formatDateTime = (dateTime: string) => {
        if (!dateTime) return 'Not set';
        
        try {
            const date = new Date(dateTime);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            return 'Invalid date';
        }
    };

    const formatSessionDuration = () => {
        if (encounter?.session_duration_seconds) {
            const minutes = Math.round(encounter.session_duration_seconds / 60);
            return `${minutes} minutes`;
        }
        
        if (encounter?.session_started_at && encounter?.session_completed_at) {
            const start = new Date(encounter.session_started_at);
            const end = new Date(encounter.session_completed_at);
            const diffMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
            return `${diffMinutes} minutes`;
        }
        
        return 'Not recorded';
    };

    const getSessionStatus = () => {
        if (encounter?.status) {
            return encounter.status.charAt(0).toUpperCase() + encounter.status.slice(1);
        }
        return appointment.status ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1) : 'Unknown';
    };

    const [isRegenerating, setIsRegenerating] = useState(false);

    const handleSaveEdit = async () => {
        try {
            const response = await fetch(`/appointments/${appointment.id}/update-ai-summary`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    summary_text: editedSummary,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('AI Summary updated successfully!', {
                    description: 'Your changes have been saved.',
                });
                setIsEditing(false);
            } else {
                toast.error('Failed to update AI summary', {
                    description: data.message || 'Please try again later.',
                });
            }
        } catch (error) {
            console.error('Error updating AI summary:', error);
            toast.error('Failed to update AI summary', {
                description: 'Please try again later.',
            });
        }
    };

    const handleRegenerate = async () => {
        if (isRegenerating) return;
        
        setIsRegenerating(true);
        
        try {
            const response = await fetch(`/appointments/${appointment.id}/regenerate-ai-summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                toast.success('AI Summary regenerated successfully!', {
                    description: 'The summary has been regenerated with the latest information.',
                    duration: 5000,
                });
                // Reload the page to show new summary
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                toast.error('Failed to regenerate AI summary', {
                    description: data.message || 'Please try again later.',
                });
            }
        } catch (error) {
            console.error('Error regenerating AI summary:', error);
            toast.error('Failed to regenerate AI summary', {
                description: 'Please try again later.',
            });
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleSendToPatient = async () => {
        if (isSending || isSent) return;
        
        setIsSending(true);
        
        try {
            const response = await fetch(`/appointments/${appointment.id}/send-ai-summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                toast.success('AI Summary sent to patient successfully!', {
                    description: `Summary has been emailed to ${patient.first_name} ${patient.last_name}`,
                    duration: 5000,
                });
                setIsSent(true);
            } else {
                toast.error('Failed to send AI summary', {
                    description: data.message || 'Please try again later.',
                });
            }
        } catch (error) {
            console.error('Error sending AI summary:', error);
            toast.error('Failed to send AI summary', {
                description: 'Please try again later.',
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleGenerateRecordingSummary = async () => {
        if (isGeneratingRecordingSummary) return;
        
        setIsGeneratingRecordingSummary(true);
        setIsSummaryTypeDialogOpen(false);
        
        try {
            const response = await fetch(`/appointments/${appointment.id}/generate-recording-ai-summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    summary_type: selectedSummaryType,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Recording AI Summary generation started!', {
                    description: 'This may take a few minutes. The page will refresh when complete.',
                    duration: 5000,
                });
                // Poll for status updates
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                toast.error('Failed to generate recording AI summary', {
                    description: data.message || 'Please try again later.',
                });
            }
        } catch (error) {
            console.error('Error generating recording AI summary:', error);
            toast.error('Failed to generate recording AI summary', {
                description: 'Please try again later.',
            });
        } finally {
            setIsGeneratingRecordingSummary(false);
        }
    };

    const handleRegenerateRecordingSummary = async () => {
        if (isGeneratingRecordingSummary) return;
        
        setIsGeneratingRecordingSummary(true);
        
        try {
            const response = await fetch(`/appointments/${appointment.id}/regenerate-recording-ai-summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    summary_type: selectedSummaryType,
                }),
            });

            const data = await response.json();

            if (data.success) {
                // toast.success('Recording AI Summary regeneration started!', {
                //     description: 'This may take a few minutes. The page will refresh when complete.',
                //     duration: 5000,
                // });
                // Poll for status updates
                // setTimeout(() => {
                //     window.location.reload();
                // }, 3000);
            } else {
                toast.error('Failed to regenerate recording AI summary', {
                    description: data.message || 'Please try again later.',
                });
            }
        } catch (error) {
            console.error('Error regenerating recording AI summary:', error);
            toast.error('Failed to regenerate recording AI summary', {
                description: 'Please try again later.',
            });
        } finally {
            setIsGeneratingRecordingSummary(false);
        }
    };

    return (
        <>
            <Head title="AI Summary" />

            {/* Tabs Navigation */}
            <AppointmentTabs 
                appointmentId={appointment.id}
                encounterId={encounter?.id}
                currentTab="ai-summary"
                userRole={user_role}
                appointmentStatus={appointment.status}
            />
            
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('appointments.show', appointment.id)}>
                            <Button variant="outline" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Appointment Details
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">AI Summary</h1>
                            <p className="text-gray-600">Appointment #{appointment.id}</p>
                        </div>
                    </div>
                    
                    <Badge variant="outline" className="flex items-center gap-1">
                        <Brain className="h-3 w-3" />
                        AI Generated
                    </Badge>
                </div>

                {/* Minimal Appointment Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Appointment Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Patient</p>
                                <p className="font-medium">{patient?.first_name} {patient?.last_name}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Service</p>
                                <p className="font-medium">{appointment?.service?.name}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Date & Time</p>
                                <p className="font-medium">{formatDateTime(appointment?.appointment_datetime)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Mode</p>
                                <p className="font-medium capitalize">{appointment?.mode}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left Column - Appointment Details & AI Summary */}
                    <div className="lg:col-span-9">
                        {/* AI Summary */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Brain className="h-5 w-5" />
                                        AI Generated Summary
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRegenerate}
                                            disabled={isRegenerating || aiSummary?.status === 'no_consent'}
                                        >
                                            {isRegenerating ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Regenerating...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    Regenerate
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsEditing(!isEditing)}
                                        >
                                            {isEditing ? (
                                                <>
                                                    <X className="h-4 w-4 mr-2" />
                                                    Cancel
                                                </>
                                            ) : (
                                                <>
                                                    <Edit3 className="h-4 w-4 mr-2" />
                                                    Edit
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500">
                                    {aiSummary?.generated_at ? `Generated on ${formatDateTime(aiSummary?.generated_at)}` : 'Not yet generated'}
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {aiSummary?.status === 'no_consent' && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>AI Summary Not Available</AlertTitle>
                                        <AlertDescription>
                                            {aiSummary?.message || 'The patient has not provided consent to use their information for AI summary generation.'}
                                            <br />
                                            <span className="mt-2 block">
                                                The patient can manage their consent preferences in their dashboard under "Consents".
                                            </span>
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <Textarea
                                            value={editedSummary}
                                            onChange={(e) => setEditedSummary(e.target.value)}
                                            className="min-h-[300px] text-sm"
                                            placeholder="Edit the AI generated summary..."
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setEditedSummary(aiSummary?.summary_text);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button onClick={handleSaveEdit}>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Changes
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-lg p-6 min-h-[300px] shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Brain className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm font-medium text-blue-700">AI Generated Content</span>
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                                                {aiSummary?.summary_text?.replace(/\\n/g, '\n')}
                                            </p>
                                        </div>
                                        
                                        {/* Send to Patient Button */}
                                        <div className="flex justify-center">
                                            <Button 
                                                onClick={handleSendToPatient} 
                                                className="px-8" 
                                                disabled={isSending || isSent}
                                                variant={isSent ? "secondary" : "default"}
                                            >
                                                {isSending ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Sending...
                                                    </>
                                                ) : isSent ? (
                                                    <>
                                                        <Send className="h-4 w-4 mr-2" />
                                                        Sent to Patient
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="h-4 w-4 mr-2" />
                                                        Send to Patient
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recording AI Summary */}
                        <Card className="mt-4">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Mic className="h-5 w-5" />
                                        Recording AI Summary
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        {recordingAISummary?.status === 'completed' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleRegenerateRecordingSummary}
                                                disabled={isGeneratingRecordingSummary}
                                            >
                                                {isGeneratingRecordingSummary ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Regenerating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                        Regenerate
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                        <Dialog open={isSummaryTypeDialogOpen} onOpenChange={setIsSummaryTypeDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    disabled={isGeneratingRecordingSummary || recordingAISummary?.status === 'processing'}
                                                >
                                                    {isGeneratingRecordingSummary || recordingAISummary?.status === 'processing' ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            {recordingAISummary?.status === 'processing' ? 'Processing...' : 'Generating...'}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Brain className="h-4 w-4 mr-2" />
                                                            {recordingAISummary?.status === 'completed' ? 'Change Type & Generate' : 'Generate'}
                                                        </>
                                                    )}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Select Summary Type</DialogTitle>
                                                    <DialogDescription>
                                                        Choose the format for the AI summary generated from encounter recordings.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <Select value={selectedSummaryType} onValueChange={setSelectedSummaryType}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select summary type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {SUMMARY_TYPES.map((type) => (
                                                                <SelectItem key={type.value} value={type.value}>
                                                                    {type.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => setIsSummaryTypeDialogOpen(false)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button onClick={handleGenerateRecordingSummary}>
                                                            Generate Summary
                                                        </Button>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                                {recordingAISummary?.summary_type && (
                                    <p className="text-sm text-gray-500 mt-2">
                                        Type: {SUMMARY_TYPES.find(t => t.value === recordingAISummary.summary_type)?.label || recordingAISummary.summary_type}
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {recordingAISummary?.status === 'processing' && (
                                    <Alert>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <AlertTitle>Generating Summary</AlertTitle>
                                        <AlertDescription>
                                            The AI summary is being generated from encounter recordings. This may take a few minutes.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {recordingAISummary?.status === 'failed' && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Generation Failed</AlertTitle>
                                        <AlertDescription>
                                            Failed to generate the recording AI summary. Please try again.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {recordingAISummary?.status === 'completed' && recordingAISummary?.summary_text ? (
                                    <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200 rounded-lg p-6 min-h-[300px] shadow-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Mic className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-700">AI Generated from Recordings</span>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                                            {recordingAISummary?.summary_text?.replace(/\\n/g, '\n')}
                                        </p>
                                    </div>
                                ) : recordingAISummary?.status !== 'processing' && recordingAISummary?.status !== 'failed' && (
                                    <div className="text-center py-8">
                                        <div className="bg-gray-50 rounded-lg p-6">
                                            <Mic className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                                            <p className="text-sm text-gray-500 mb-2">No recording summary generated</p>
                                            <p className="text-xs text-gray-400">
                                                Generate an AI summary from encounter recordings with timestamps and speaker labels.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Session Details/Summary */}
                    <div className="lg:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Session Summary
                                </CardTitle>
                                <p className="text-sm text-gray-500">
                                    Practitioner's findings from the session
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {encounter ? (
                                    <>
                                        {/* Chief Complaint */}
                                        {encounter.chief_complaint && (
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Chief Complaint</h4>
                                                <div className="bg-gray-50 rounded-lg p-3">
                                                    <p className="text-sm text-gray-600">
                                                        {encounter.chief_complaint}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Examination Notes */}
                                        {encounter.examination_notes && (
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Examination Notes</h4>
                                                <div className="bg-gray-50 rounded-lg p-3">
                                                    <p className="text-sm text-gray-600">
                                                        {encounter.examination_notes}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Vital Signs */}
                                        {(encounter.blood_pressure || encounter.heart_rate || encounter.temperature || encounter.weight || encounter.height) && (
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Vital Signs</h4>
                                                <div className="bg-gray-50 rounded-lg p-3">
                                                    <div className="grid grid-cols-1 gap-1 text-sm text-gray-600">
                                                        {encounter.blood_pressure && <p>Blood Pressure: {encounter.blood_pressure}</p>}
                                                        {encounter.heart_rate && <p>Heart Rate: {encounter.heart_rate}</p>}
                                                        {encounter.temperature && <p>Temperature: {encounter.temperature}</p>}
                                                        {encounter.weight && <p>Weight: {encounter.weight}</p>}
                                                        {encounter.height && <p>Height: {encounter.height}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Clinical Assessment */}
                                        {encounter.clinical_assessment && (
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Clinical Assessment</h4>
                                                <div className="bg-gray-50 rounded-lg p-3">
                                                    <p className="text-sm text-gray-600">
                                                        {encounter.clinical_assessment}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Treatment Plan */}
                                        {encounter.treatment_plan && (
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Treatment Plan</h4>
                                                <div className="bg-gray-50 rounded-lg p-3">
                                                    <p className="text-sm text-gray-600">
                                                        {encounter.treatment_plan}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Session Duration */}
                                        <div className="pt-3 border-t">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500">Session Duration:</span>
                                                <span className="font-medium">{formatSessionDuration()}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500">Session Status:</span>
                                                <Badge variant="default" className="text-xs">{getSessionStatus()}</Badge>
                                            </div>
                                            {encounter.session_started_at && encounter.session_completed_at && (
                                                <div className="flex items-center justify-between text-sm mt-1">
                                                    <span className="text-gray-500">Session Time:</span>
                                                    <span className="font-medium text-xs">
                                                        {new Date(encounter.session_started_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - {new Date(encounter.session_completed_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    // No encounter data available
                                    <div className="text-center py-8">
                                        <div className="bg-gray-50 rounded-lg p-6">
                                            <FileText className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                                            <p className="text-sm text-gray-500 mb-2">No session data recorded</p>
                                            <p className="text-xs text-gray-400">
                                                Session details will appear here once the practitioner completes the encounter documentation.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <Toaster />
        </>
    );
}

export default withLayout(AISummary, (page) => {
    const appointmentId = (page.props as Props).appointment?.id;
    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Appointments', href: '/appointments' },
            { title: 'Appointment Details', href: appointmentId ? `/appointments/${appointmentId}` : '' },
            { title: 'AI Summary', href: '' },
        ]}>
            {page}
        </AppLayout>
    );
}); 
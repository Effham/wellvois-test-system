import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    ArrowLeft, 
    CheckCircle, 
    XCircle,
    Edit,
    Calendar,
    User,
    FileText,
    Clock,
    Send
} from 'lucide-react';

interface SummaryData {
    id: number;
    appointment_id: number;
    appointment_date: string;
    patient_name: string;
    service_name: string;
    encounter_date: string;
    status: string;
    summary_approved: boolean;
    auto_generated_summary: string;
}

interface AppointmentSummaryShowProps {
    summary: SummaryData;
}

export default function AppointmentSummaryShow({ summary }: AppointmentSummaryShowProps) {
    const [editedSummary, setEditedSummary] = useState(summary.auto_generated_summary);
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showDeclineModal, setShowDeclineModal] = useState(false);

    const handleApprove = async () => {
        setIsProcessing(true);
        setShowApprovalModal(false);

        try {
            const response = await fetch('/appointment-summaries/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    encounter_id: summary.id,
                    approved_summary: editedSummary
                })
            });

            if (response.ok) {
                // Redirect back to list with success message
                router.visit('/appointment-summaries', {
                    preserveState: false,
                });
            }
        } catch (error) {
            console.error('Error approving summary:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDecline = () => {
        setShowDeclineModal(false);
        // For now, just redirect back
        router.visit('/appointment-summaries');
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Summaries', href: '/appointment-summaries' },
                { title: summary.patient_name, href: `/appointment-summaries/${summary.id}` },
            ]}
        >
            <Head title={`Summary - ${summary.patient_name}`} />
            
            <div className="p-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/appointment-summaries">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Summaries
                        </Button>
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
                            <FileText className="h-6 w-6" />
                            Appointment Summary
                        </h1>
                        <p className="text-muted-foreground">Review and approve the auto-generated summary</p>
                    </div>
                    <Badge 
                        variant={summary.summary_approved ? "default" : "secondary"}
                        className={summary.summary_approved ? "bg-green-100 text-green-800" : ""}
                    >
                        {summary.summary_approved ? 'Approved' : 'Pending Review'}
                    </Badge>
                </div>

                {/* Patient & Appointment Info */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Appointment Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Patient</p>
                                <p className="text-sm font-semibold">{summary.patient_name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Service</p>
                                <p className="text-sm">{summary.service_name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Appointment Date</p>
                                <div className="flex items-center gap-1 text-sm">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(summary.appointment_date).toLocaleDateString()}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Encounter Date</p>
                                <div className="flex items-center gap-1 text-sm">
                                    <Clock className="h-3 w-3" />
                                    {new Date(summary.encounter_date).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Auto-Generated Summary */}
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Auto-Generated Summary
                            </CardTitle>
                            {!summary.summary_approved && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(!isEditing)}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    {isEditing ? 'View Mode' : 'Edit Mode'}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isEditing ? (
                            <Textarea
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                                className="min-h-[300px] text-sm leading-relaxed"
                                placeholder="Edit the summary as needed..."
                            />
                        ) : (
                            <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted rounded-lg p-4">
                                {editedSummary}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                {!summary.summary_approved && (
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeclineModal(true)}
                            disabled={isProcessing}
                            className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                            <XCircle className="mr-2 h-4 w-4" />
                            Decline Summary
                        </Button>
                        <Button
                            onClick={() => setShowApprovalModal(true)}
                            disabled={isProcessing || !editedSummary.trim()}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve & Send to Patient
                        </Button>
                    </div>
                )}

                {summary.summary_approved && (
                    <div className="flex justify-center">
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Summary has been approved and sent to patient</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Approval Confirmation Modal */}
            <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            Approve Summary
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to approve this summary? Once approved, it will be automatically 
                            sent to the patient via email and cannot be modified.
                        </p>
                        
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowApprovalModal(false)}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleApprove}
                                disabled={isProcessing}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isProcessing ? (
                                    'Sending...'
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Approve & Send
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Decline Confirmation Modal */}
            <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-500" />
                            Decline Summary
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to decline this summary? This will mark it as declined and 
                            no email will be sent to the patient.
                        </p>
                        
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeclineModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDecline}
                                variant="destructive"
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Decline
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
} 
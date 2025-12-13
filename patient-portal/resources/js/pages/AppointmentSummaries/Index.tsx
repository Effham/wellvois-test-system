import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { 
    Info, 
    Calendar,
    User,
    FileText,
    Clock
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

interface AppointmentSummariesProps {
    summaries: SummaryData[];
}

export default function AppointmentSummariesIndex({ summaries }: AppointmentSummariesProps) {
    const handleViewSummary = (summary: SummaryData) => {
        router.visit(`/appointment-summaries/${summary.id}`);
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Appointment Summaries', href: '/appointment-summaries' },
            ]}
        >
            <Head title="Appointment Summaries" />
            
            <div className="p-6">
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-semibold text-primary">Appointment Summaries</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Review and approve auto-generated summaries for completed appointments
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Completed Appointments ({summaries.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {summaries.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No completed appointments with summaries found.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Service</TableHead>
                                        <TableHead>Appointment Date</TableHead>
                                        <TableHead>Encounter Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summaries.map((summary) => (
                                        <TableRow key={summary.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    {summary.patient_name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {summary.service_name}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    {new Date(summary.appointment_date).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    {new Date(summary.encounter_date).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={summary.summary_approved ? "default" : "secondary"}
                                                    className={summary.summary_approved ? "bg-green-100 text-green-800" : ""}
                                                >
                                                    {summary.summary_approved ? 'Approved' : 'Pending Review'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewSummary(summary)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Info className="h-4 w-4" />
                                                    View Summary
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
} 
import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, FileText, Eye, Calendar, User } from 'lucide-react';

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
    patient: Patient;
    service: Service;
    appointment_datetime: string;
}

interface Encounter {
    id: number;
    appointment: Appointment;
}

interface Document {
    id: number;
    original_name: string;
    file_name: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    file_size_human: string;
    document_type: string;
    document_type_display: string;
    description?: string;
    uploaded_by_type: string;
    uploaded_by_id: number;
    document_request_id?: number;
    created_at: string;
    updated_at: string;
}

interface Props {
    encounter: Encounter;
    document: Document;
}

export default function DocumentShow({ encounter, document }: Props) {
    const breadcrumbs = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Appointments', href: '/appointments' },
        { title: 'Documents', href: `/encounters/${encounter.id}/documents/upload` },
        { title: 'View Document', href: '' },
    ];

    const formatDateTime = (dateTime: string) => {
        return new Date(dateTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleDownload = () => {
        window.location.href = route('encounters.documents.download', [encounter.id, document.id]);
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) {
            return '🖼️';
        } else if (mimeType === 'application/pdf') {
            return '📄';
        } else if (mimeType.includes('word')) {
            return '📝';
        }
        return '📄';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`View Document - ${document.original_name}`} />

            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Document Details</h1>
                        <p className="text-gray-600 mt-1">
                            {encounter.appointment?.patient?.first_name} {encounter.appointment?.patient?.last_name} • {encounter.appointment?.service?.name}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleDownload}
                            className="bg-primary hover:bg-primary/90"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                        <Link href={`/encounters/${encounter.id}/documents/upload`}>
                            <Button variant="outline">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Documents
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Document Information */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Document Card */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl">{getFileIcon(document.mime_type)}</div>
                                        <div>
                                            <CardTitle className="text-lg">{document.original_name}</CardTitle>
                                            <p className="text-sm text-gray-500 mt-1">{document.document_type_display}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline">
                                        {document.file_size_human}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {document.description && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                            {document.description}
                                        </p>
                                    </div>
                                )}

                                {/* Document Preview Area */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                                    <div className="border rounded-lg p-8 bg-gray-50 text-center">
                                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600 mb-4">
                                            {document.mime_type.startsWith('image/') 
                                                ? 'Image preview not available in this view'
                                                : 'Document preview not available'
                                            }
                                        </p>
                                        <Button onClick={handleDownload} variant="outline">
                                            <Download className="h-4 w-4 mr-2" />
                                            Download to View
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Document Metadata */}
                    <div className="space-y-6">
                        {/* File Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">File Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Type</p>
                                    <p className="text-sm text-gray-900">{document.mime_type}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Size</p>
                                    <p className="text-sm text-gray-900">{document.file_size_human}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Uploaded</p>
                                    <p className="text-sm text-gray-900">{formatDateTime(document.created_at)}</p>
                                </div>
                                {document.document_request_id && (
                                    <div>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            Requested Document
                                        </Badge>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Appointment Context */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Appointment Context</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {encounter.appointment?.patient?.first_name} {encounter.appointment?.patient?.last_name}
                                        </p>
                                        <p className="text-xs text-gray-500">{encounter.appointment?.patient?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-sm text-gray-900">
                                            {formatDateTime(encounter.appointment?.appointment_datetime)}
                                        </p>
                                        <p className="text-xs text-gray-500">{encounter.appointment?.service?.name}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
} 
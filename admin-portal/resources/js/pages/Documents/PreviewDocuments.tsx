import { Head } from '@inertiajs/react';
import { Download, FileText, Calendar, Building2, User, FileCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    patient_id: number;
    patient?: Patient;
    service: Service;
    appointment_datetime: string;
}

interface Encounter {
    id: number;
    appointment: Appointment;
}

interface DocumentRequest {
    id: number;
    title: string;
    document_type: string;
    by_practitioner: boolean;
}

interface Document {
    id: number;
    original_name: string;
    file_name: string;
    mime_type: string;
    file_size: number;
    file_size_human: string;
    document_type: string;
    document_type_display: string;
    description?: string;
    document_request_id?: number;
    document_request?: DocumentRequest;
    created_at: string;
}

interface PreviewDocumentsProps {
    encounter: Encounter;
    documents: Document[];
    clinicName: string;
    patient: Patient | null;
}

export default function PreviewDocuments({ encounter, documents, clinicName, patient }: PreviewDocumentsProps) {
    const formatDateTime = (dateTime: string) => {
        return new Date(dateTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDate = (dateTime: string) => {
        return new Date(dateTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const handleDownload = (documentId: number) => {
        window.location.href = route('encounters.documents.download', [encounter.id, documentId]);
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) {
            return '🖼️';
        } else if (mimeType === 'application/pdf') {
            return '📄';
        } else if (mimeType.includes('word')) {
            return '📝';
        } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
            return '📊';
        }
        return '📄';
    };

    return (
        <>
            <Head title={`Your Documents - ${clinicName}`} />

            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                {/* Header */}
                <div className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 dark:border-gray-800">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{clinicName}</h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Your Healthcare Documents
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <FileCheck className="h-5 w-5" />
                                <span className="text-sm font-medium">Secure Access</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="space-y-6">
                        {/* Patient & Appointment Info */}
                        <Card className="border-gray-200 dark:border-gray-800">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Appointment Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {patient && (
                                        <div className="flex items-start gap-3">
                                            <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                    Patient
                                                </p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {patient.first_name} {patient.last_name}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-3">
                                        <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                Appointment Date
                                            </p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {formatDate(encounter.appointment.appointment_datetime)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                Service
                                            </p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {encounter.appointment.service.name}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Documents Section */}
                        <Card className="border-gray-200 dark:border-gray-800">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl">Your Documents</CardTitle>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Documents uploaded by your healthcare provider
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-sm">
                                        {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {documents.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FileText className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                                        <p className="text-gray-600 dark:text-gray-400">No documents available yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {documents.map((document) => (
                                            <div
                                                key={document.id}
                                                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                                    <div className="text-3xl flex-shrink-0">
                                                        {getFileIcon(document.mime_type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                                {document.original_name}
                                                            </h4>
                                                            {document.document_request && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                                                >
                                                                    {document.document_request.title}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                            <span>{document.document_type_display}</span>
                                                            <span>•</span>
                                                            <span>{document.file_size_human}</span>
                                                            <span>•</span>
                                                            <span>Uploaded {formatDate(document.created_at)}</span>
                                                        </div>
                                                        {document.description && (
                                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                                                                {document.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => handleDownload(document.id)}
                                                    size="sm"
                                                    className="ml-4 flex-shrink-0"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Important Notice */}
                        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-3">
                                    <FileCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                            Important Information
                                        </p>
                                        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                                            <li>These documents are confidential and for your personal use only.</li>
                                            <li>Please store downloaded documents securely.</li>
                                            <li>
                                                If you have questions about these documents, please contact {clinicName}{' '}
                                                directly.
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-8 border-t border-gray-200 dark:border-gray-800">
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <p>This is a secure document portal provided by {clinicName}.</p>
                        <p>
                            Powered by{' '}
                            <span className="font-medium text-gray-700 dark:text-gray-300">Wellovis</span> • All
                            documents are encrypted and stored securely.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

import { useState, useMemo } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FilePond, registerPlugin } from 'react-filepond';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';
import FilePondPluginFileValidateSize from 'filepond-plugin-file-validate-size';
import { ArrowLeft, FileText, Upload, Plus, CheckCircle, Clock, Download, Eye } from 'lucide-react';
import { useS3Upload } from '@/hooks/use-s3-upload';
import DocumentSecurityModal from '@/components/practitioner/DocumentSecurityModal';
import AppointmentTabs from '@/components/appointments/AppointmentTabs';

// Register FilePond plugins
registerPlugin(
    FilePondPluginImagePreview,
    FilePondPluginFileValidateType,
    FilePondPluginFileValidateSize
);

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
    status?: string;
}

interface Encounter {
    id: number;
    appointment: Appointment;
    status?: string;
}

interface DocumentRequest {
    id: number;
    document_type: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    requested_at: string;
    fulfilled_by_document_id?: number;
    document_type_display: string;
    priority_color: string;
    by_practitioner?: boolean;
    linked_documents?: ExistingDocument[];
}

interface ExistingDocument {
    id: number;
    original_name: string;
    document_type: string;
    file_size_human: string;
    created_at: string;
    document_request_id?: number;
    uploaded_by_type?: string;
}

interface Props {
    encounter: Encounter;
    documentRequests: DocumentRequest[];
    existingDocuments: ExistingDocument[];
    userRole?: string;
    isViewMode?: boolean;
}

export default function DocumentUpload({ encounter, documentRequests = [], existingDocuments = [], userRole = 'admin', isViewMode = false }: Props) {
    const [requestUploads, setRequestUploads] = useState<{ [key: number]: any[] }>({});
    const [additionalFiles, setAdditionalFiles] = useState<any[]>([]);
    const [additionalDescription, setAdditionalDescription] = useState('');
    const [submittingRequests, setSubmittingRequests] = useState<{ [key: number]: boolean }>({});
    const [isSubmittingAdditional, setIsSubmittingAdditional] = useState(false);
    
    // Document security consent modal state
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [pendingUpload, setPendingUpload] = useState<'additional' | null>(null);

    // S3 upload hook
    const { uploadFile, uploading: s3Uploading, progress, error: s3Error, uploadedFile, reset: resetS3 } = useS3Upload();

    // S3 upload state tracking
    const [s3UploadStates, setS3UploadStates] = useState<{ [key: string]: { uploading: boolean; progress: number; error?: string; success?: boolean } }>({});

    // Get user role from auth data
    const { auth }: any = usePage().props;
    const isPractitionerFromAuth = auth?.user?.roles?.includes('Practitioner');
    const isPractitionerFromProps = userRole === 'practitioner';
    const isPractitioner = isPractitionerFromAuth || isPractitionerFromProps;
    
    // Debug auth data (temporary)
    console.log('DocumentUpload: Auth data', {
        isPractitioner,
        userRole
    });

    // Separate document requests by role
    const { currentUserRequests, otherRoleRequests } = useMemo(() => {
        return {
            currentUserRequests: documentRequests.filter(req =>
                isPractitioner ? req.by_practitioner : !req.by_practitioner
            ),
            otherRoleRequests: documentRequests.filter(req =>
                isPractitioner ? !req.by_practitioner : req.by_practitioner
            )
        };
    }, [documentRequests, isPractitioner]);

    // Separate existing documents by uploader role
    const { currentUserDocs, otherRoleDocs } = useMemo(() => {
        const practitionerClass = 'App\\Models\\Practitioner';
        const patientClass = 'App\\Models\\Patient';

        return {
            currentUserDocs: existingDocuments.filter(doc => {
                if (isPractitioner) {
                    return doc.uploaded_by_type === practitionerClass;
                } else {
                    return doc.uploaded_by_type === patientClass;
                }
            }),
            otherRoleDocs: existingDocuments.filter(doc => {
                if (isPractitioner) {
                    return doc.uploaded_by_type === patientClass;
                } else {
                    return doc.uploaded_by_type === practitionerClass;
                }
            })
        };
    }, [existingDocuments, isPractitioner]);

    const breadcrumbs = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Appointments', href: '/appointments' },
        { title: 'Upload Documents', href: '' },
    ];

    const formatDateTime = (dateTime: string) => {
        return new Date(dateTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleRequestUpload = (requestId: number, files: any[]) => {
        setRequestUploads(prev => ({
            ...prev,
            [requestId]: files
        }));
    };

    // Document security consent handlers
    const handleSecurityConsentAccept = () => {
        setShowSecurityModal(false);
        
        // Determine if this is a requested document or additional document
        if (pendingUpload === 'additional') {
            // Proceed with additional file upload (without consent check)
            performUpload();
        } else if (pendingUpload && pendingUpload.startsWith('request_')) {
            // Extract requestId from pendingUpload (e.g., "request_2" -> 2)
            const requestId = parseInt(pendingUpload.replace('request_', ''));
            // Proceed with requested document upload (without consent check)
            performUpload(requestId);
        }
        
        setPendingUpload(null);
    };

    const handleSecurityConsentCancel = () => {
        setShowSecurityModal(false);
        setPendingUpload(null);
    };

    // Perform actual upload without consent check
    const performUpload = async (requestId?: number) => {
        const uploadKey = requestId ? `request_${requestId}` : 'additional';

        if (requestId) {
            setSubmittingRequests(prev => ({ ...prev, [requestId]: true }));
        } else {
            setIsSubmittingAdditional(true);
        }

        // Set initial S3 upload state
        setS3UploadStates(prev => ({
            ...prev,
            [uploadKey]: { uploading: true, progress: 0 }
        }));

        console.log('DocumentUpload: Starting S3 upload process', { requestId, encounterId: encounter.id });

        const filesToUpload = requestId ? (requestUploads[requestId] || []) : additionalFiles;

        if (filesToUpload.length === 0) {
            console.warn('DocumentUpload: No files to upload');
            if (requestId) {
                setSubmittingRequests(prev => ({ ...prev, [requestId]: false }));
            } else {
                setIsSubmittingAdditional(false);
            }
            return;
        }

        try {
            console.log('DocumentUpload: Uploading files to S3', {
                fileCount: filesToUpload.length,
                requestId,
                encounterId: encounter.id
            });

            // Upload each file to S3
            const s3UploadPromises = filesToUpload.map(async (fileItem, index) => {
                const actualFile = fileItem.file || fileItem;
                const s3Key = `encounters/${encounter.id}/documents/${requestId ? `request_${requestId}` : 'additional'}/${Date.now()}_${actualFile.name}`;

                console.log(`DocumentUpload: Uploading file ${index + 1}/${filesToUpload.length} to S3`, {
                    fileName: actualFile.name,
                    s3Key,
                    fileSize: actualFile.size
                });

                return await uploadFile(actualFile, {
                    key: s3Key,
                    expiresMinutes: 1440, // 24 hours for documents
                    onProgress: (progress) => {
                        console.log(`DocumentUpload: File ${index + 1} upload progress`, { progress, fileName: actualFile.name });
                        setS3UploadStates(prev => ({
                            ...prev,
                            [uploadKey]: { ...prev[uploadKey], progress: Math.round(progress * (index + 1) / filesToUpload.length) }
                        }));
                    },
                    onSuccess: (response) => {
                        console.log(`DocumentUpload: File ${index + 1} uploaded successfully to S3`, {
                            fileName: actualFile.name,
                            s3Key: response.key
                        });
                    },
                    onError: (error) => {
                        console.error(`DocumentUpload: File ${index + 1} S3 upload failed`, {
                            fileName: actualFile.name,
                            error
                        });
                    }
                });
            });

            const s3Responses = await Promise.all(s3UploadPromises);

            console.log('DocumentUpload: All files uploaded to S3 successfully', {
                uploadedFiles: s3Responses.map(r => r.key)
            });

            // Now create the database records with S3 keys ONLY
            const formData = new FormData();

            s3Responses.forEach((response, index) => {
                const fileObj = filesToUpload[index].file || filesToUpload[index];
                formData.append(`s3_keys[${index}]`, response.key);
                formData.append(`file_names[${index}]`, fileObj.name);
                formData.append(`mime_types[${index}]`, fileObj.type || 'application/octet-stream');
                formData.append(`file_sizes[${index}]`, fileObj.size?.toString() || '0');

                console.log(`DocumentUpload: Preparing file ${index} for backend`, {
                    s3_key: response.key,
                    file_name: fileObj.name,
                    mime_type: fileObj.type,
                    file_size: fileObj.size
                });
            });

            if (requestId) {
                formData.append('document_request_id', requestId.toString());
            } else {
                formData.append('document_type', 'additional');
                if (additionalDescription.trim()) {
                    formData.append('description', additionalDescription);
                }
            }

            console.log('DocumentUpload: Submitting S3 file data to backend');

            await router.post(route('encounters.documents.store', encounter.id), formData, {
                onSuccess: () => {
                    console.log('DocumentUpload: Database records created successfully');
                    setS3UploadStates(prev => ({
                        ...prev,
                        [uploadKey]: { uploading: false, progress: 100, success: true }
                    }));

                    if (requestId) {
                        setRequestUploads(prev => ({
                            ...prev,
                            [requestId]: []
                        }));
                    } else {
                        setAdditionalFiles([]);
                        setAdditionalDescription('');
                    }

                    // Clear success state after 3 seconds
                    setTimeout(() => {
                        setS3UploadStates(prev => {
                            const newState = { ...prev };
                            delete newState[uploadKey];
                            return newState;
                        });
                    }, 3000);
                },
                onError: (errors) => {
                    console.error('DocumentUpload: Database submission failed', errors);
                    setS3UploadStates(prev => ({
                        ...prev,
                        [uploadKey]: { uploading: false, progress: 0, error: 'Failed to save document records' }
                    }));
                },
                onFinish: () => {
                    if (requestId) {
                        setSubmittingRequests(prev => ({ ...prev, [requestId]: false }));
                    } else {
                        setIsSubmittingAdditional(false);
                    }
                }
            });

        } catch (error) {
            console.error('DocumentUpload: S3 upload exception', error);
            setS3UploadStates(prev => ({
                ...prev,
                [uploadKey]: {
                    uploading: false,
                    progress: 0,
                    error: error instanceof Error ? error.message : 'Upload failed'
                }
            }));

            if (requestId) {
                setSubmittingRequests(prev => ({ ...prev, [requestId]: false }));
            } else {
                setIsSubmittingAdditional(false);
            }
        }
    };

    const handleSubmit = async (requestId?: number) => {
        // For all practitioner uploads (both requested and additional), check consent first
        if (isPractitioner) {
            console.log('DocumentUpload: Showing consent modal for practitioner upload', {
                requestId,
                isAdditional: !requestId
            });
            setPendingUpload(requestId ? `request_${requestId}` : 'additional');
            setShowSecurityModal(true);
            return;
        }

        // For non-practitioner uploads, proceed directly
        performUpload(requestId);
    };

    const isRequestFulfilled = (request: DocumentRequest) => {
        return request.status === 'fulfilled' || request.fulfilled_by_document_id || (request.linked_documents && request.linked_documents.length > 0);
    };

    const getLinkedDocumentsCount = (request: DocumentRequest) => {
        return request.linked_documents ? request.linked_documents.length : 0;
    };

    const getPriorityBadge = (priority: string) => {
        const colors = {
            urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
            normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        };
        return colors[priority as keyof typeof colors] || colors.normal;
    };

    // Render document request card (reusable component for both columns)
    const renderDocumentRequestCard = (request: DocumentRequest, readOnly: boolean = false) => (
        <Card key={request.id} className={`h-fit ${isRequestFulfilled(request) ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'border-gray-200 dark:border-gray-700'}`}>
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2 mb-2">
                            {isRequestFulfilled(request) ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                                <Clock className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                            )}
                            <Badge className={getPriorityBadge(request.priority)}>
                                {request.priority}
                            </Badge>
                        </div>
                        <CardTitle className="text-base leading-tight dark:text-white">{request.title}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{request.document_type_display}</p>
                        {request.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{request.description}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Requested {formatDateTime(request.requested_at)}</p>

                        {/* Show linked documents */}
                        {request.linked_documents && request.linked_documents.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Uploaded documents:</p>
                                {request.linked_documents.map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <FileText className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                                            <span className="text-xs text-green-800 dark:text-green-200 truncate">{doc.original_name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                title="View document"
                                                onClick={() => window.location.href = route('encounters.documents.show', [encounter.id, doc.id])}
                                            >
                                                <Eye className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                title="Download document"
                                                onClick={() => window.location.href = route('encounters.documents.download', [encounter.id, doc.id])}
                                            >
                                                <Download className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {isRequestFulfilled(request) && (
                        <div className="flex-shrink-0 ml-2">
                            <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700">
                                {getLinkedDocumentsCount(request) > 1 ? 'Multi' : 'Fulfilled'}
                            </Badge>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-4">
                <div className="space-y-3">
                    {isRequestFulfilled(request) && !readOnly && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-950 p-2 rounded border border-green-200 dark:border-green-800">
                            <CheckCircle className="h-3 w-3 inline mr-1" />
                            This request has documents. You can upload additional files if needed.
                        </p>
                    )}

                    <div className="relative z-0">
                        {!readOnly ? (
                            <FilePond
                                files={requestUploads[request.id] || []}
                                onupdatefiles={(files) => handleRequestUpload(request.id, files)}
                                allowMultiple={true}
                                maxFiles={5}
                                maxFileSize="10MB"
                                acceptedFileTypes={['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                                labelIdle={`<span class="text-sm text-gray-600">Drag files here or <span class="text-primary font-medium">Browse</span></span>`}
                                credits={false}
                                allowImagePreview={true}
                                allowFileTypeValidation={true}
                                allowFileSizeValidation={true}
                                fileValidateTypeLabelExpectedTypes="PDF, Word, or Image files"
                                stylePanelLayout="compact"
                                styleButtonRemoveItemPosition="right"
                                styleButtonProcessItemPosition="right"
                            />
                        ) : (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {isRequestFulfilled(request) ? 'View only - Documents uploaded' : 'View only - Pending upload by other role'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {!readOnly && (requestUploads[request.id] || []).length > 0 && (
                    <div className="upload-button-container relative z-10 mt-4 space-y-3">
                        {/* S3 Upload Progress */}
                        {s3UploadStates[`request_${request.id}`] && (
                            <div className="space-y-2">
                                {s3UploadStates[`request_${request.id}`].uploading && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-blue-600 dark:text-blue-400">Uploading...</span>
                                            <span className="text-blue-600 dark:text-blue-400">{s3UploadStates[`request_${request.id}`].progress}%</span>
                                        </div>
                                        <div className="w-full bg-blue-100 dark:bg-blue-900 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${s3UploadStates[`request_${request.id}`].progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {s3UploadStates[`request_${request.id}`].error && (
                                    <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950 p-2 rounded">
                                        <span>❌</span>
                                        <span>{s3UploadStates[`request_${request.id}`].error}</span>
                                    </div>
                                )}

                                {s3UploadStates[`request_${request.id}`].success && (
                                    <div className="flex items-center space-x-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-950 p-2 rounded">
                                        <CheckCircle className="h-4 w-4" />
                                        <span>Files uploaded successfully!</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button
                            onClick={() => handleSubmit(request.id)}
                            disabled={submittingRequests[request.id] || s3UploadStates[`request_${request.id}`]?.uploading || false}
                            className="w-full bg-primary hover:bg-primary/90 relative z-10 pointer-events-auto"
                            style={{ position: 'relative', zIndex: 1000 }}
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            {submittingRequests[request.id] || s3UploadStates[`request_${request.id}`]?.uploading ? 'Uploading...' : `Upload ${isRequestFulfilled(request) ? 'Additional' : ''} Files`}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // Render document list (reusable for both columns)
    const renderDocumentList = (documents: ExistingDocument[]) => {
        if (documents.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No documents uploaded yet
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 gap-3">
                {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-primary/30 dark:hover:border-primary/30 transition-colors">
                        <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.original_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {doc.file_size_human} • {formatDateTime(doc.created_at)}
                            </p>
                            {doc.document_request_id && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                    Requested Document
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="View document"
                                onClick={() => window.location.href = route('encounters.documents.show', [encounter.id, doc.id])}
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Download document"
                                onClick={() => window.location.href = route('encounters.documents.download', [encounter.id, doc.id])}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Document Management" />
            <style dangerouslySetInnerHTML={{
                __html: `
                    .filepond--root {
                        position: relative;
                        z-index: 1;
                    }
                    .filepond--drop-label {
                        z-index: 1;
                    }
                    .filepond--file {
                        z-index: 1;
                    }
                    .upload-button-container {
                        position: relative;
                        z-index: 1000 !important;
                        pointer-events: auto !important;
                    }
                    .upload-button-container button {
                        position: relative;
                        z-index: 1001 !important;
                        pointer-events: auto !important;
                    }
                `
            }} />

            {/* Tabs Navigation */}
            <AppointmentTabs 
                appointmentId={encounter.appointment.id}
                encounterId={encounter.id}
                currentTab="documents"
                userRole={userRole}
                appointmentStatus={encounter.appointment?.status}
            />

            <div className="max-w-[1600px] mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Document Management
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {encounter.appointment?.patient?.first_name} {encounter.appointment?.patient?.last_name} • {encounter.appointment?.service?.name}
                        </p>
                    </div>
                    <Link href={route('appointments.show', encounter.appointment.id)}>
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Appointment Details
                        </Button>
                    </Link>
                </div>

                {/* Two-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT COLUMN - Current User's Upload Section (Editable) */}
                    <div className="space-y-6">
                        <div className="sticky top-4">
                            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                                    {isPractitioner ? '📋 Practitioner Documents' : '👤 Patient Documents'}
                                </h2>
                                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                    {isPractitioner ? 'Documents you upload as a practitioner' : 'Documents you upload as a patient'}
                                </p>
                            </div>
                        </div>

                        {/* Requested Documents - Current User */}
                        {currentUserRequests.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Requested Documents</h3>
                                    <Badge variant="outline" className="bg-primary text-primary-foreground">
                                        {currentUserRequests.filter(r => !isRequestFulfilled(r)).length} Pending
                                    </Badge>
                                </div>
                                <div className="space-y-4">
                                    {currentUserRequests.map((request) => renderDocumentRequestCard(request, false))}
                                </div>
                            </div>
                        )}

                        {/* Additional Documents - Current User */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Additional Documents</h3>
                                <Badge variant="outline" className="text-gray-600 dark:text-gray-400">Optional</Badge>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base dark:text-white">Upload Other Documents</CardTitle>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Upload any other relevant documents not specifically requested.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Description (Optional)
                                        </Label>
                                        <Textarea
                                            id="description"
                                            placeholder="Briefly describe these documents..."
                                            value={additionalDescription}
                                            onChange={(e) => setAdditionalDescription(e.target.value)}
                                            className="mt-1 text-sm"
                                            rows={2}
                                        />
                                    </div>

                                    <div className="relative z-0">
                                        <FilePond
                                            files={additionalFiles}
                                            onupdatefiles={setAdditionalFiles}
                                            allowMultiple={true}
                                            maxFiles={10}
                                            maxFileSize="10MB"
                                            acceptedFileTypes={['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                                            labelIdle='<span class="text-gray-600">Drag additional files here or <span class="text-primary font-medium">Browse</span></span>'
                                            credits={false}
                                            allowImagePreview={true}
                                            allowFileTypeValidation={true}
                                            allowFileSizeValidation={true}
                                            fileValidateTypeLabelExpectedTypes="PDF, Word, or Image files"
                                            stylePanelLayout="compact"
                                            styleButtonRemoveItemPosition="right"
                                            styleButtonProcessItemPosition="right"
                                        />
                                    </div>

                                    {additionalFiles.length > 0 && (
                                        <div className="upload-button-container relative z-10 mt-4 space-y-3">
                                            {/* S3 Upload Progress */}
                                            {s3UploadStates['additional'] && (
                                                <div className="space-y-2">
                                                    {s3UploadStates['additional'].uploading && (
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-blue-600 dark:text-blue-400">Uploading...</span>
                                                                <span className="text-blue-600 dark:text-blue-400">{s3UploadStates['additional'].progress}%</span>
                                                            </div>
                                                            <div className="w-full bg-blue-100 dark:bg-blue-900 rounded-full h-2">
                                                                <div
                                                                    className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                                                                    style={{ width: `${s3UploadStates['additional'].progress}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {s3UploadStates['additional'].error && (
                                                        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950 p-2 rounded">
                                                            <span>❌</span>
                                                            <span>{s3UploadStates['additional'].error}</span>
                                                        </div>
                                                    )}

                                                    {s3UploadStates['additional'].success && (
                                                        <div className="flex items-center space-x-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-950 p-2 rounded">
                                                            <CheckCircle className="h-4 w-4" />
                                                            <span>Files uploaded successfully!</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <Button
                                                onClick={() => handleSubmit()}
                                                disabled={isSubmittingAdditional || s3UploadStates['additional']?.uploading || false}
                                                className="w-full bg-primary hover:bg-primary/90 relative z-10 pointer-events-auto"
                                                style={{ position: 'relative', zIndex: 1000 }}
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                {isSubmittingAdditional || s3UploadStates['additional']?.uploading ? 'Uploading...' : 'Upload Additional Files'}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Previously Uploaded - Current User */}
                        {currentUserDocs.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Previously Uploaded</h3>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    {renderDocumentList(currentUserDocs)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN - Other Role's Upload Section (Read-only) */}
                    <div className="space-y-6">
                        <div className="sticky top-4">
                            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {isPractitioner ? '👤 Patient Documents' : '📋 Practitioner Documents'}
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    View-only: Documents uploaded by {isPractitioner ? 'patient' : 'practitioner'}
                                </p>
                            </div>
                        </div>

                        {/* Requested Documents - Other Role */}
                        {otherRoleRequests.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Requested Documents</h3>
                                    <Badge variant="outline" className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                        {otherRoleRequests.filter(r => !isRequestFulfilled(r)).length} Pending
                                    </Badge>
                                </div>
                                <div className="space-y-4">
                                    {otherRoleRequests.map((request) => renderDocumentRequestCard(request, true))}
                                </div>
                            </div>
                        )}

                        {/* Additional Documents - Other Role */}
                        {otherRoleDocs.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Additional Documents</h3>
                                    <Badge variant="outline" className="text-gray-600 dark:text-gray-400">{otherRoleDocs.length}</Badge>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    {renderDocumentList(otherRoleDocs)}
                                </div>
                            </div>
                        )}

                        {/* Empty state for other role */}
                        {otherRoleRequests.length === 0 && otherRoleDocs.length === 0 && (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                                <p>No documents from {isPractitioner ? 'patient' : 'practitioner'} yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Document Security Consent Modal */}
            <DocumentSecurityModal
                open={showSecurityModal}
                onAccept={handleSecurityConsentAccept}
                onCancel={handleSecurityConsentCancel}
                patientName={encounter.appointment.patient.first_name + ' ' + encounter.appointment.patient.last_name}
            />
        </AppLayout>
    );
}

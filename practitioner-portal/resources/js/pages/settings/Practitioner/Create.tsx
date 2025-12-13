import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, CheckCircle, Info, Upload, X, FileText, Image, Award } from 'lucide-react';
import { useS3Upload } from '@/hooks/use-s3-upload';

type Practitioner = {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
    phone_number?: string;
    gender?: string;
    pronoun?: string;
    email: string;
    short_bio?: string;
    full_bio?: string;
    profile_picture_path?: string;
    resume_files?: string[];
    licensing_docs?: string[];
    certificates?: string[];
};

interface PractitionerCreateProps {
    practitioner?: Practitioner | null;
    onCancel: () => void;
}

export default function PractitionerCreate({ practitioner, onCancel }: PractitionerCreateProps) {
    const { flash }: any = usePage().props;
    const [emailValidation, setEmailValidation] = useState<{ available: boolean; message: string } | null>(null);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [showDisclaimerDialog, setShowDisclaimerDialog] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(false);

    // Success/Error message states
    const [showResultAlert, setShowResultAlert] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [resultType, setResultType] = useState<'success' | 'error'>('success');

    const [uploadedFiles, setUploadedFiles] = useState<{
        profile_picture?: File;
        resume_files: File[];
        licensing_docs: File[];
        certificates: File[];
    }>({
        resume_files: [],
        licensing_docs: [],
        certificates: [],
    });

    // S3 upload hooks and state
    const { uploadFile, uploading: s3Uploading, progress, error: s3Error, uploadedFile, reset: resetS3 } = useS3Upload();
    const [s3UploadStates, setS3UploadStates] = useState<{ [key: string]: { uploading: boolean; progress: number; error?: string; success?: boolean; s3Key?: string } }>({});
    const [s3UploadedFiles, setS3UploadedFiles] = useState<{
        profile_picture?: { s3Key: string; signedUrl: string; fileName: string };
        resume_files: { s3Key: string; signedUrl: string; fileName: string }[];
        licensing_docs: { s3Key: string; signedUrl: string; fileName: string }[];
        certificates: { s3Key: string; signedUrl: string; fileName: string }[];
    }>({
        resume_files: [],
        licensing_docs: [],
        certificates: [],
    });

    const { data, setData, post, put, processing, errors, reset } = useForm({
        first_name: practitioner?.first_name || '',
        last_name: practitioner?.last_name || '',
        title: practitioner?.title || '',
        phone_number: practitioner?.phone_number || '',
        gender: practitioner?.gender || '',
        pronoun: practitioner?.pronoun || '',
        email: practitioner?.email || '',
        short_bio: practitioner?.short_bio || '',
        full_bio: practitioner?.full_bio || '',
        profile_picture: null,
        resume_files: [],
        licensing_docs: [],
        certificates: [],
    });

    const validateEmail = async () => {
        if (!data.email.trim()) {
            setEmailValidation(null);
            return;
        }

        setCheckingEmail(true);

        try {
            const response = await fetch(route('practitioners.validate-email'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setEmailValidation(result);
        } catch (error) {
            console.error('Error validating email:', error);
            setEmailValidation({
                available: false,
                message: 'Error validating email. Please try again.',
            });
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        setShowDisclaimerDialog(true);
        setPendingSubmit(true);
    };

    const handleDisclaimerAccept = () => {
        setShowDisclaimerDialog(false);

        console.log('PractitionerCreate: Submitting form with S3 file data', {
            s3UploadedFiles,
            practitionerId: practitioner?.id
        });

        // Create FormData with S3 file keys
        const formData = new FormData();

        // Add text fields
        Object.keys(data).forEach(key => {
            if (key !== 'profile_picture' && key !== 'resume_files' && key !== 'licensing_docs' && key !== 'certificates') {
                formData.append(key, data[key] as string);
            }
        });

        // Add S3 file data instead of actual files
        if (s3UploadedFiles.profile_picture) {
            formData.append('profile_picture_s3_key', s3UploadedFiles.profile_picture.s3Key);
            formData.append('profile_picture_s3_url', s3UploadedFiles.profile_picture.signedUrl);
            formData.append('profile_picture_file_name', s3UploadedFiles.profile_picture.fileName);
        }

        s3UploadedFiles.resume_files.forEach((s3File, index) => {
            formData.append(`resume_files_s3_keys[${index}]`, s3File.s3Key);
            formData.append(`resume_files_s3_urls[${index}]`, s3File.signedUrl);
            formData.append(`resume_files_file_names[${index}]`, s3File.fileName);
        });

        s3UploadedFiles.licensing_docs.forEach((s3File, index) => {
            formData.append(`licensing_docs_s3_keys[${index}]`, s3File.s3Key);
            formData.append(`licensing_docs_s3_urls[${index}]`, s3File.signedUrl);
            formData.append(`licensing_docs_file_names[${index}]`, s3File.fileName);
        });

        s3UploadedFiles.certificates.forEach((s3File, index) => {
            formData.append(`certificates_s3_keys[${index}]`, s3File.s3Key);
            formData.append(`certificates_s3_urls[${index}]`, s3File.signedUrl);
            formData.append(`certificates_file_names[${index}]`, s3File.fileName);
        });

        console.log('PractitionerCreate: Form data prepared for submission');

        if (practitioner) {
            router.post(route('practitioners.update', practitioner.id), formData, {
                method: 'put',
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    console.log('PractitionerCreate: Practitioner updated successfully');
                    setResultType('success');
                    setResultMessage('Practitioner updated successfully!');
                    setShowResultAlert(true);
                    setTimeout(() => setShowResultAlert(false), 5000);
                    reset();
                },
                onError: (errors) => {
                    console.error('PractitionerCreate: Update errors:', errors);
                    setResultType('error');
                    setResultMessage('Failed to update practitioner. Please check your information and try again.');
                    setShowResultAlert(true);
                    setTimeout(() => setShowResultAlert(false), 5000);
                }
            });
        } else {
            router.post(route('practitioners.store'), formData, {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    console.log('PractitionerCreate: Practitioner created successfully');
                    setResultType('success');
                    setResultMessage('Practitioner created successfully!');
                    setShowResultAlert(true);
                    setTimeout(() => setShowResultAlert(false), 5000);
                    reset();
                },
                onError: (errors) => {
                    console.error('PractitionerCreate: Create errors:', errors);
                    setResultType('error');
                    setResultMessage('Failed to create practitioner. Please check your information and try again.');
                    setShowResultAlert(true);
                    setTimeout(() => setShowResultAlert(false), 5000);
                }
            });
        }
        setPendingSubmit(false);
    };

    const handleDisclaimerCancel = () => {
        setShowDisclaimerDialog(false);
        setPendingSubmit(false);
    };

    const handleFileUpload = async (fileType: 'profile_picture' | 'resume_files' | 'licensing_docs' | 'certificates', files: FileList | null) => {
        if (!files) return;

        console.log('PractitionerCreate: Starting S3 file upload', { fileType, fileCount: files.length });

        if (fileType === 'profile_picture') {
            const file = files[0];
            if (file && file.type.startsWith('image/')) {
                await uploadFileToS3(file, fileType);
            }
        } else {
            const newFiles = Array.from(files);
            for (const file of newFiles) {
                await uploadFileToS3(file, fileType);
            }
        }
    };

    const uploadFileToS3 = async (file: File, fileType: 'profile_picture' | 'resume_files' | 'licensing_docs' | 'certificates') => {
        const uploadKey = `${fileType}_${Date.now()}_${file.name}`;

        // Set initial upload state
        setS3UploadStates(prev => ({
            ...prev,
            [uploadKey]: { uploading: true, progress: 0 }
        }));

        try {
            // Generate practitioner ID or use existing one
            const practitionerId = practitioner?.id || 'new';
            const s3Key = `practitioners/${practitionerId}/${fileType}/${Date.now()}_${file.name}`;

            console.log('PractitionerCreate: Uploading file to S3', {
                fileName: file.name,
                fileType,
                s3Key,
                fileSize: file.size
            });

            const response = await uploadFile(file, {
                key: s3Key,
                expiresMinutes: 1440, // 24 hours
                onProgress: (progress) => {
                    setS3UploadStates(prev => ({
                        ...prev,
                        [uploadKey]: { ...prev[uploadKey], progress }
                    }));
                },
                onSuccess: (s3Response) => {
                    console.log('PractitionerCreate: File uploaded successfully to S3', {
                        fileName: file.name,
                        s3Key: s3Response.key
                    });

                    setS3UploadStates(prev => ({
                        ...prev,
                        [uploadKey]: { uploading: false, progress: 100, success: true, s3Key: s3Response.key }
                    }));

                    // Store S3 file information
                    const s3FileInfo = {
                        s3Key: s3Response.key,
                        signedUrl: s3Response.signed_url,
                        fileName: file.name
                    };

                    if (fileType === 'profile_picture') {
                        setS3UploadedFiles(prev => ({ ...prev, profile_picture: s3FileInfo }));
                    } else {
                        setS3UploadedFiles(prev => ({
                            ...prev,
                            [fileType]: [...prev[fileType], s3FileInfo]
                        }));
                    }

                    // Also keep the local file for display
                    if (fileType === 'profile_picture') {
                        setUploadedFiles(prev => ({ ...prev, profile_picture: file }));
                    } else {
                        setUploadedFiles(prev => ({
                            ...prev,
                            [fileType]: [...prev[fileType], file]
                        }));
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
                onError: (error) => {
                    console.error('PractitionerCreate: S3 upload failed', {
                        fileName: file.name,
                        error
                    });

                    setS3UploadStates(prev => ({
                        ...prev,
                        [uploadKey]: { uploading: false, progress: 0, error }
                    }));
                }
            });

        } catch (error) {
            console.error('PractitionerCreate: S3 upload exception', error);
            setS3UploadStates(prev => ({
                ...prev,
                [uploadKey]: {
                    uploading: false,
                    progress: 0,
                    error: error instanceof Error ? error.message : 'Upload failed'
                }
            }));
        }
    };

    const removeFile = (fileType: 'profile_picture' | 'resume_files' | 'licensing_docs' | 'certificates', index?: number) => {
        if (fileType === 'profile_picture') {
            setUploadedFiles(prev => ({ ...prev, profile_picture: undefined }));
            setData('profile_picture', null);
        } else if (index !== undefined) {
            const newFiles = uploadedFiles[fileType].filter((_, i) => i !== index);
            setUploadedFiles(prev => ({ ...prev, [fileType]: newFiles }));
            setData(fileType, newFiles);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            {/* Success/Error Alert */}
            {showResultAlert && (
                <Alert className={`border-2 ${resultType === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                    <div className="flex items-center gap-2">
                        {resultType === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <AlertTitle className={resultType === 'success' ? 'text-green-800' : 'text-red-800'}>
                            {resultType === 'success' ? 'Success' : 'Error'}
                        </AlertTitle>
                    </div>
                    <AlertDescription className={resultType === 'success' ? 'text-green-700' : 'text-red-700'}>
                        {resultMessage}
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">
                    {practitioner ? 'Edit Practitioner' : 'Create Practitioner'}
                </h2>
                <p className="text-muted-foreground">
                    {practitioner ? 'Update practitioner information' : 'Add a new practitioner to your organization'}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        {practitioner ? 'Edit Practitioner' : 'Create Practitioner'}
                        <Button variant="outline" onClick={onCancel}>
                            Back to List
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Success Message */}
                    {flash?.success && (
                        <Alert className="mb-6 border-green-400 bg-green-50">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-700">Success</AlertTitle>
                            <AlertDescription className="text-green-600">{flash.success}</AlertDescription>
                        </Alert>
                    )}

                    {/* Error Message */}
                    {flash?.error && (
                        <Alert className="mb-6 border-red-400 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-700">Error</AlertTitle>
                            <AlertDescription className="text-red-600">{flash.error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmitClick}>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-6">
                            <div className="">
                                <Label htmlFor="first_name">First Name *</Label>
                                <Input
                                    id="first_name"
                                    type="text"
                                    value={data.first_name}
                                    onChange={(e) => setData('first_name', e.target.value)}
                                    className={errors.first_name ? 'border-red-500' : ''}
                                    placeholder="Enter first name"
                                />
                                {errors.first_name && <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>}
                            </div>
                            
                            <div className="">
                                <Label htmlFor="last_name">Last Name *</Label>
                                <Input
                                    id="last_name"
                                    type="text"
                                    value={data.last_name}
                                    onChange={(e) => setData('last_name', e.target.value)}
                                    className={errors.last_name ? 'border-red-500' : ''}
                                    placeholder="Enter last name"
                                />
                                {errors.last_name && <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>}
                            </div>

                            <div className="">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    type="text"
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    className={errors.title ? 'border-red-500' : ''}
                                    placeholder="e.g., Dr., MD, RN, etc."
                                />
                                {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
                            </div>

                            <div className="">
                                <Label htmlFor="email">Email *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => {
                                            setData('email', e.target.value);
                                            setEmailValidation(null);
                                        }}
                                        className={errors.email ? 'border-red-500' : ''}
                                        placeholder="Enter email address"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={validateEmail}
                                        disabled={!data.email.trim() || checkingEmail}
                                        className="shrink-0"
                                    >
                                        {checkingEmail ? 'Checking...' : 'Validate'}
                                    </Button>
                                </div>
                                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}

                                {emailValidation && (
                                    <div className="mt-2">
                                        {emailValidation.available ? (
                                            <Alert className="border-green-400 bg-green-50">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                <AlertDescription className="text-green-600">
                                                    {emailValidation.message}
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <Alert className="border-red-400 bg-red-50">
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <AlertDescription className="text-red-600">
                                                    {emailValidation.message}
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="">
                                <Label htmlFor="phone_number">Phone Number</Label>
                                <Input
                                    id="phone_number"
                                    type="text"
                                    value={data.phone_number}
                                    onChange={(e) => setData('phone_number', e.target.value)}
                                    className={errors.phone_number ? 'border-red-500' : ''}
                                    placeholder="Enter phone number"
                                />
                                {errors.phone_number && <p className="mt-1 text-sm text-red-500">{errors.phone_number}</p>}
                            </div>

                            <div className="">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={data.gender} onValueChange={(value) => setData('gender', value)}>
                                    <SelectTrigger id="gender" className={`w-full ${errors.gender ? 'border-red-500' : ''}`}>
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.gender && <p className="mt-1 text-sm text-red-500">{errors.gender}</p>}
                            </div>

                            <div className="">
                                <Label htmlFor="pronoun">Pronoun</Label>
                                <Input
                                    id="pronoun"
                                    type="text"
                                    value={data.pronoun}
                                    onChange={(e) => setData('pronoun', e.target.value)}
                                    className={errors.pronoun ? 'border-red-500' : ''}
                                    placeholder="e.g., he/him, she/her, they/them"
                                />
                                {errors.pronoun && <p className="mt-1 text-sm text-red-500">{errors.pronoun}</p>}
                            </div>

                            <div className="md:col-span-2">
                                <Label htmlFor="short_bio">Short Bio/Headline</Label>
                                <Textarea
                                    id="short_bio"
                                    value={data.short_bio}
                                    onChange={(e) => setData('short_bio', e.target.value)}
                                    className={errors.short_bio ? 'border-red-500' : ''}
                                    placeholder="Brief professional headline or summary"
                                    rows={2}
                                />
                                {errors.short_bio && <p className="mt-1 text-sm text-red-500">{errors.short_bio}</p>}
                            </div>

                            <div className="md:col-span-2">
                                <Label htmlFor="full_bio">Full Bio</Label>
                                <Textarea
                                    id="full_bio"
                                    value={data.full_bio}
                                    onChange={(e) => setData('full_bio', e.target.value)}
                                    className={errors.full_bio ? 'border-red-500' : ''}
                                    placeholder="Complete professional biography, experience, education, etc."
                                    rows={6}
                                />
                                {errors.full_bio && <p className="mt-1 text-sm text-red-500">{errors.full_bio}</p>}
                            </div>
                        </div>

                        {/* File Upload Section */}
                        <div className="mt-8 space-y-6 border-t pt-6">
                            <h3 className="text-lg font-medium text-gray-900">Documents & Profile Picture</h3>
                            
                            {/* Profile Picture Upload */}
                            <div className="space-y-2">
                                <Label htmlFor="profile_picture" className="flex items-center">
                                    <Image className="w-4 h-4 mr-2" />
                                    Profile Picture
                                </Label>
                                <div className="flex items-center space-x-4">
                                    <div className="flex-1">
                                        <input
                                            id="profile_picture"
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload('profile_picture', e.target.files)}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        {errors.profile_picture && <p className="mt-1 text-sm text-red-500">{errors.profile_picture}</p>}
                                    </div>
                                </div>

                                {/* S3 Upload Progress for Profile Picture */}
                                {Object.entries(s3UploadStates).filter(([key]) => key.startsWith('profile_picture_')).map(([uploadKey, state]) => (
                                    <div key={uploadKey} className="space-y-2">
                                        {state.uploading && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-blue-600">Uploading...</span>
                                                    <span className="text-blue-600">{state.progress}%</span>
                                                </div>
                                                <div className="w-full bg-blue-100 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${state.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {state.error && (
                                            <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                                                <span>❌</span>
                                                <span>{state.error}</span>
                                            </div>
                                        )}

                                        {state.success && (
                                            <div className="flex items-center space-x-2 text-green-600 text-sm bg-green-50 p-2 rounded">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Profile picture uploaded successfully!</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {uploadedFiles.profile_picture && (
                                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                                        <div className="flex items-center">
                                            <Image className="w-4 h-4 mr-2 text-gray-600" />
                                            <span className="text-sm text-gray-700">{uploadedFiles.profile_picture.name}</span>
                                            <span className="text-xs text-gray-500 ml-2">({formatFileSize(uploadedFiles.profile_picture.size)})</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeFile('profile_picture')}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Resume Files Upload */}
                            <div className="space-y-2">
                                <Label htmlFor="resume_files" className="flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Resume/CV Files
                                </Label>
                                <input
                                    id="resume_files"
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => handleFileUpload('resume_files', e.target.files)}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                />
                                {errors.resume_files && <p className="mt-1 text-sm text-red-500">{errors.resume_files}</p>}

                                {/* S3 Upload Progress for Resume Files */}
                                {Object.entries(s3UploadStates).filter(([key]) => key.startsWith('resume_files_')).map(([uploadKey, state]) => (
                                    <div key={uploadKey} className="space-y-2">
                                        {state.uploading && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-green-600">Uploading resume to S3...</span>
                                                    <span className="text-green-600">{state.progress}%</span>
                                                </div>
                                                <div className="w-full bg-green-100 rounded-full h-2">
                                                    <div
                                                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${state.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {state.error && (
                                            <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                                                <span>❌</span>
                                                <span>{state.error}</span>
                                            </div>
                                        )}

                                        {state.success && (
                                            <div className="flex items-center space-x-2 text-green-600 text-sm bg-green-50 p-2 rounded">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Resume file uploaded successfully!</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {uploadedFiles.resume_files.length > 0 && (
                                    <div className="space-y-2">
                                        {uploadedFiles.resume_files.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between bg-green-50 p-3 rounded-md">
                                                <div className="flex items-center">
                                                    <FileText className="w-4 h-4 mr-2 text-green-600" />
                                                    <span className="text-sm text-gray-700">{file.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeFile('resume_files', index)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Licensing Documents Upload */}
                            <div className="space-y-2">
                                <Label htmlFor="licensing_docs" className="flex items-center">
                                    <Award className="w-4 h-4 mr-2" />
                                    Licensing Documents
                                </Label>
                                <input
                                    id="licensing_docs"
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    onChange={(e) => handleFileUpload('licensing_docs', e.target.files)}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                                />
                                {errors.licensing_docs && <p className="mt-1 text-sm text-red-500">{errors.licensing_docs}</p>}

                                {/* S3 Upload Progress for Licensing Documents */}
                                {Object.entries(s3UploadStates).filter(([key]) => key.startsWith('licensing_docs_')).map(([uploadKey, state]) => (
                                    <div key={uploadKey} className="space-y-2">
                                        {state.uploading && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-yellow-600">Uploading licensing document to S3...</span>
                                                    <span className="text-yellow-600">{state.progress}%</span>
                                                </div>
                                                <div className="w-full bg-yellow-100 rounded-full h-2">
                                                    <div
                                                        className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${state.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {state.error && (
                                            <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                                                <span>❌</span>
                                                <span>{state.error}</span>
                                            </div>
                                        )}

                                        {state.success && (
                                            <div className="flex items-center space-x-2 text-green-600 text-sm bg-green-50 p-2 rounded">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Licensing document uploaded successfully!</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {uploadedFiles.licensing_docs.length > 0 && (
                                    <div className="space-y-2">
                                        {uploadedFiles.licensing_docs.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between bg-yellow-50 p-3 rounded-md">
                                                <div className="flex items-center">
                                                    <Award className="w-4 h-4 mr-2 text-yellow-600" />
                                                    <span className="text-sm text-gray-700">{file.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeFile('licensing_docs', index)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Certificates Upload */}
                            <div className="space-y-2">
                                <Label htmlFor="certificates" className="flex items-center">
                                    <Award className="w-4 h-4 mr-2" />
                                    Certificates & Credentials
                                </Label>
                                <input
                                    id="certificates"
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    onChange={(e) => handleFileUpload('certificates', e.target.files)}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                />
                                {errors.certificates && <p className="mt-1 text-sm text-red-500">{errors.certificates}</p>}

                                {/* S3 Upload Progress for Certificates */}
                                {Object.entries(s3UploadStates).filter(([key]) => key.startsWith('certificates_')).map(([uploadKey, state]) => (
                                    <div key={uploadKey} className="space-y-2">
                                        {state.uploading && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-purple-600">Uploading certificate to S3...</span>
                                                    <span className="text-purple-600">{state.progress}%</span>
                                                </div>
                                                <div className="w-full bg-purple-100 rounded-full h-2">
                                                    <div
                                                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${state.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {state.error && (
                                            <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                                                <span>❌</span>
                                                <span>{state.error}</span>
                                            </div>
                                        )}

                                        {state.success && (
                                            <div className="flex items-center space-x-2 text-green-600 text-sm bg-green-50 p-2 rounded">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Certificate uploaded successfully!</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {uploadedFiles.certificates.length > 0 && (
                                    <div className="space-y-2">
                                        {uploadedFiles.certificates.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between bg-purple-50 p-3 rounded-md">
                                                <div className="flex items-center">
                                                    <Award className="w-4 h-4 mr-2 text-purple-600" />
                                                    <span className="text-sm text-gray-700">{file.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeFile('certificates', index)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex gap-4">
                            <Button type="button" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing || pendingSubmit} size="save">
                                {processing ? 'Saving...' : pendingSubmit ? 'Confirming...' : practitioner ? 'Update Practitioner' : 'Create Practitioner'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Wellovis Network Disclaimer Dialog */}
            <Dialog open={showDisclaimerDialog} onOpenChange={setShowDisclaimerDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Info className="mr-2 h-5 w-5 text-blue-600" />
                            Wellovis Network Information Sharing
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            {practitioner ? (
                                <>By updating this practitioner's information, you acknowledge that their professional information will be shared throughout the <strong>Wellovis network</strong> to enable collaboration and facilitate healthcare provider discovery across the network.</>
                            ) : (
                                <>By creating this practitioner record, you acknowledge that the practitioner's professional information will be shared throughout the <strong>Wellovis network</strong> to enable collaboration and facilitate healthcare provider discovery across the network.</>
                            )}
                        </p>
                        <div className="bg-blue-50 p-3 rounded-md">
                            <p className="text-xs text-blue-700">
                                <strong>Information shared includes:</strong> Name, Title, Professional Contact Information, Bio, and other professional credentials necessary for provider identification and healthcare collaboration.
                            </p>
                        </div>
                        <p className="text-sm text-gray-600">
                            Do you want to proceed with {practitioner ? 'updating' : 'creating'} this practitioner record?
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDisclaimerCancel}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="button" 
                            onClick={handleDisclaimerAccept}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Yes, Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
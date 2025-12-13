import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { router, useForm, usePage, Head } from '@inertiajs/react';
import { AlertCircle, CheckCircle, Info, ArrowLeft, Edit, Plus, Trash2, Search, Users, X, Upload, FileText, Award, User, Stethoscope } from 'lucide-react';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useS3Upload } from '@/hooks/use-s3-upload';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Edit Profile',
        href: '/practitioner-details',
    },
];

const TABS = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'professional', label: 'Professional Details' },
];

const CREDENTIALS = [
    'MD', 'PhD', 'PsyD', 'MA', 'MS', 'MSW', 'LCSW', 'LMFT', 'LPC', 'LCPC', 'LPCC', 'LMHC', 'RN', 'NP', 'PA', 'Other'
];

const YEARS_OF_EXPERIENCE = [
    '0-1 years', '2-5 years', '6-10 years', '11-15 years', '16-20 years', '20+ years'
];

const SPECIALTIES = [
    'Anxiety Disorders', 'Depression', 'Trauma & PTSD', 'Addiction', 'Eating Disorders',
    'Bipolar Disorder', 'OCD', 'ADHD', 'Autism Spectrum', 'Grief & Loss', 'Relationship Issues',
    'Family Therapy', 'Child & Adolescent', 'Geriatric', 'LGBTQ+ Issues', 'Cultural Issues'
];

const THERAPEUTIC_MODALITIES = [
    'CBT', 'DBT', 'EMDR', 'Psychodynamic', 'Humanistic', 'Mindfulness-Based',
    'Solution-Focused', 'Narrative Therapy', 'Art Therapy', 'Play Therapy', 'Group Therapy'
];

const CLIENT_TYPES = [
    'Children (5-12)', 'Adolescents (13-17)', 'Adults (18-64)', 'Seniors (65+)',
    'Couples', 'Families', 'Groups'
];

const LANGUAGES = [
    'English', 'French', 'Spanish', 'Mandarin', 'Cantonese', 'Arabic', 'Hindi', 'Punjabi', 'Other'
];

interface PractitionerEditProps {
    practitioner: any;
}

export default function Edit({ practitioner: practitionerProp }: PractitionerEditProps) {
    const pageProps = usePage().props as any;
    const { flash } = pageProps;

    // Try both prop access patterns
    const practitioner = practitionerProp || pageProps.practitioner;

    // Debug logging to see what data we receive
    useEffect(() => {
        console.log('=== PractitionerDetails/Edit Component Mounted ===');
        console.log('All page props:', pageProps);
        console.log('Practitioner from direct prop:', practitionerProp);
        console.log('Practitioner from usePage:', pageProps.practitioner);
        console.log('Practitioner (resolved):', practitioner);
        console.log('Practitioner data:', {
            id: practitioner?.id,
            first_name: practitioner?.first_name,
            last_name: practitioner?.last_name,
            email: practitioner?.email,
            user: practitioner?.user,
            hasData: !!practitioner
        });
    }, []);

    const [activeTab, setActiveTab] = useState('basic');
    const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);

    // S3 upload hook
    const { uploadFile, uploading: s3Uploading, progress, error: s3Error, uploadedFile, reset: resetS3 } = useS3Upload();

    const [uploadedFiles, setUploadedFiles] = useState<{
        profile_picture?: File;
        resume_files: File[];
        licensing_documents: File[];
        certificates: File[];
    }>({
        resume_files: [],
        licensing_documents: [],
        certificates: [],
    });

    const [showResultAlert, setShowResultAlert] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [resultType, setResultType] = useState<'success' | 'error'>('success');

    const { data, setData, post, processing, errors } = useForm({
        practitioner_id: practitioner?.id || null,
        current_tab: 'basic',
        first_name: practitioner?.first_name || '',
        last_name: practitioner?.last_name || '',
        title: practitioner?.title || '',
        email: practitioner?.user?.email || practitioner?.email || '',
        phone_number: practitioner?.phone_number || '',
        extension: practitioner?.extension || '',
        gender: practitioner?.gender || '',
        pronoun: practitioner?.pronoun || '',
        is_active: practitioner?.is_active ?? true,
        short_bio: practitioner?.short_bio || '',
        full_bio: practitioner?.full_bio || '',
        profile_picture: null as File | null,
        profile_picture_s3_key: practitioner?.profile_picture_s3_key || '',
        profile_picture_url: practitioner?.profile_picture_url || '',

        credentials: practitioner?.credentials || [],
        years_of_experience: practitioner?.years_of_experience || '',
        license_number: practitioner?.license_number || '',
        professional_associations: practitioner?.professional_associations || [],
        primary_specialties: practitioner?.primary_specialties || [],
        therapeutic_modalities: practitioner?.therapeutic_modalities || [],
        client_types_served: practitioner?.client_types_served || [],
        languages_spoken: practitioner?.languages_spoken || [],
        resume_files: practitioner?.resume_files || [],
        licensing_documents: practitioner?.licensing_documents || [],
        certificates: practitioner?.certificates || [],
    });

    // Handle file upload with S3
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fileType: keyof typeof uploadedFiles) => {
        console.log('PractitionerEdit: handleFileUpload called', { fileType, event });

        const files = Array.from(event.target.files || []);
        console.log('PractitionerEdit: Files selected', { filesCount: files.length, files });

        if (fileType === 'profile_picture' && files[0]) {
            const file = files[0];

            console.log('PractitionerEdit: Starting profile picture S3 upload', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                practitionerId: practitioner?.id
            });

            // Validate file
            if (!file.type.startsWith('image/')) {
                setResultType('error');
                setResultMessage('Please select an image file.');
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);
                return;
            }

            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setResultType('error');
                setResultMessage('File size must be less than 5MB.');
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);
                return;
            }

            // Create preview immediately
            const reader = new FileReader();
            reader.onload = (e) => setProfilePicturePreview(e.target?.result as string);
            reader.readAsDataURL(file);

            try {
                // Reset previous S3 upload state
                resetS3();

                // Upload to S3 with organized path
                const s3Key = `practitioners/${practitioner?.id || 'new'}/profile/avatar.${file.name.split('.').pop()}`;

                const response = await uploadFile(file, {
                    key: s3Key,
                    expiresMinutes: 1440, // 24 hours for profile pictures
                    onProgress: (progress) => {
                        console.log('PractitionerEdit: Profile picture upload progress', { progress });
                    },
                    onSuccess: (response) => {
                        console.log('PractitionerEdit: Profile picture uploaded successfully to S3', {
                            key: response.key,
                            signed_url_length: response.signed_url?.length || 0
                        });
                    },
                    onError: (error) => {
                        console.error('PractitionerEdit: Profile picture upload failed', { error });
                    }
                });

                // Store ONLY S3 key (not the signed URL)
                setData('profile_picture_s3_key', response.key);
                // DO NOT store signed URL - it will be generated on demand when needed
                setUploadedFiles(prev => ({ ...prev, profile_picture: file }));

                setResultType('success');
                setResultMessage('Profile picture uploaded successfully to S3!');
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);

            } catch (error) {
                console.error('PractitionerEdit: S3 upload error', { error });
                setResultType('error');
                setResultMessage(`Failed to upload profile picture: ${error instanceof Error ? error.message : 'Unknown error'}`);
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);
            }
        } else if (fileType !== 'profile_picture') {
            // For document uploads, also use S3
            const filesToUpload = files;

            try {
                const uploadPromises = filesToUpload.map(async (file, index) => {
                    const s3Key = `practitioners/${practitioner?.id || 'new'}/${fileType}/${Date.now()}_${file.name}`;

                    console.log(`PractitionerEdit: Uploading ${fileType} file ${index + 1}/${filesToUpload.length} to S3`, {
                        fileName: file.name,
                        s3Key
                    });

                    return await uploadFile(file, {
                        key: s3Key,
                        expiresMinutes: 1440
                    });
                });

                const responses = await Promise.all(uploadPromises);
                console.log(`PractitionerEdit: All ${fileType} files uploaded to S3`, { responses });

                // Store the uploaded files locally for form submission
                setUploadedFiles(prev => ({
                    ...prev,
                    [fileType]: [...(prev[fileType] as File[]), ...files]
                }));

                setResultType('success');
                setResultMessage(`${filesToUpload.length} file(s) uploaded successfully to S3!`);
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);

            } catch (error) {
                console.error(`PractitionerEdit: ${fileType} S3 upload error`, { error });
                setResultType('error');
                setResultMessage(`Failed to upload ${fileType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);
            }
        }
    };

    // Remove file
    const removeFile = (fileType: keyof typeof uploadedFiles, index?: number) => {
        if (fileType === 'profile_picture') {
            setUploadedFiles(prev => ({ ...prev, profile_picture: undefined }));
            setData('profile_picture', null);
            setProfilePicturePreview(null);
        } else if (typeof index === 'number') {
            setUploadedFiles(prev => ({
                ...prev,
                [fileType]: (prev[fileType] as File[]).filter((_, i) => i !== index)
            }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        console.log('PractitionerEdit: handleSubmit function called!', {
            event: e,
            processing: processing,
            activeTab: activeTab
        });

        e.preventDefault();

        if (activeTab === 'basic') {
            // For basic tab, just move to next tab without saving
            setActiveTab('professional');
            setData('current_tab', 'professional');
            return;
        }

        setData('current_tab', activeTab);

        const formData = new FormData();

        // Add all form data
        Object.keys(data).forEach(key => {
            const value = data[key as keyof typeof data];
            if (key === 'profile_picture' && value instanceof File) {
                // Skip raw file if we have S3 key
                if (!data.profile_picture_s3_key) {
                    formData.append(key, value);
                }
            } else if (Array.isArray(value)) {
                // Skip document array fields - they'll be handled separately below
                if (key === 'resume_files' || key === 'licensing_documents' || key === 'certificates') {
                    return;
                }
                // For other arrays (credentials, specialties, etc.), append as indexed entries
                if (value.length > 0) {
                    value.forEach((item, index) => {
                        formData.append(`${key}[${index}]`, String(item));
                    });
                }
                // Skip empty arrays - backend validation handles them as nullable
            } else if (value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        });

        // Submit S3 key only (not signed URL)
        if (data.profile_picture_s3_key) {
            formData.append('profile_picture_s3_key', data.profile_picture_s3_key);
            // DO NOT send signed URL - backend will generate fresh URLs on demand
            console.log('PractitionerEdit: Submitting S3 profile picture key', {
                s3Key: data.profile_picture_s3_key
            });
        }

        // Add file uploads (should be replaced with S3 keys in future)
        uploadedFiles.resume_files.forEach((file, index) => {
            formData.append(`resume_files[${index}]`, file);
        });
        uploadedFiles.licensing_documents.forEach((file, index) => {
            formData.append(`licensing_documents[${index}]`, file);
        });
        uploadedFiles.certificates.forEach((file, index) => {
            formData.append(`certificates[${index}]`, file);
        });

        console.log('PractitionerEdit: About to submit form', {
            hasS3Key: !!data.profile_picture_s3_key,
            s3Key: data.profile_picture_s3_key,
            route: route('practitioner-details.update'),
            formDataKeys: Array.from(formData.keys())
        });

        router.post(route('practitioner-details.update'), formData, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => {
                console.log('PractitionerEdit: Form submission started');
            },
            onSuccess: () => {
                console.log('PractitionerEdit: Form submission successful');
                setResultType('success');
                setResultMessage('Profile updated successfully!');
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);
            },
            onError: (errors) => {
                console.error('PractitionerEdit: Form submission failed', errors);
                setResultType('error');
                setResultMessage('Failed to update profile. Please check your information and try again.');
                setShowResultAlert(true);
                setTimeout(() => setShowResultAlert(false), 5000);
            },
            onFinish: () => {
                console.log('PractitionerEdit: Form submission finished');
            }
        });
    };

    const toggleArrayValue = (array: string[], value: string, setter: (key: string, value: any) => void, key: string) => {
        const newArray = array.includes(value)
            ? array.filter(item => item !== value)
            : [...array, value];
        setter(key, newArray);
    };

    const removeArrayItem = (array: string[], index: number, setter: (key: string, value: any) => void, key: string) => {
        const newArray = array.filter((_, i) => i !== index);
        setter(key, newArray);
    };

    // Add null/empty state handling
    if (!practitioner || !practitioner.id) {
        return (
            <>
                <Head title="Edit Profile" />
                <div className="space-y-6">
                    <Alert className="border-2 border-red-500 bg-red-50">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-800">No Practitioner Data</AlertTitle>
                        </div>
                        <AlertDescription className="text-red-700">
                            <p>Unable to load practitioner data. Please check the browser console for details.</p>
                            <p className="mt-2 text-sm">Practitioner object: {JSON.stringify(practitioner)}</p>
                        </AlertDescription>
                    </Alert>
                    <div className="flex justify-center">
                        <Button onClick={() => router.get(route('dashboard'))}>
                            Return to Dashboard
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Edit Profile" />

            <div className="space-y-6">
                {/* Backend Flash Messages */}
                {flash?.success && (
                    <Alert className="border-2 border-green-500 bg-green-50">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Success</AlertTitle>
                        </div>
                        <AlertDescription className="text-green-700">
                            {flash.success}
                        </AlertDescription>
                    </Alert>
                )}

                {flash?.error && (
                    <Alert className="border-2 border-red-500 bg-red-50">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-800">Error</AlertTitle>
                        </div>
                        <AlertDescription className="text-red-700">
                            {flash.error}
                        </AlertDescription>
                    </Alert>
                )}

                {flash?.info && (
                    <Alert className="border-2 border-blue-500 bg-blue-50">
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">Info</AlertTitle>
                        </div>
                        <AlertDescription className="text-blue-700">
                            {flash.info}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Frontend Result Alert */}
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

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-full p-3">
                            <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
                            <p className="text-gray-600">Update your professional information</p>
                        </div>
                    </div>
                </div>

                {/* Main Form */}
                <form onSubmit={(e) => {
                    console.log('PractitionerEdit: Form onSubmit triggered', {
                        processing: processing,
                        formValid: e.currentTarget.checkValidity()
                    });
                    handleSubmit(e);
                }}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2">
                            {TABS.map(tab => (
                                <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
                            ))}
                        </TabsList>

                        {/* Basic Info Tab */}
                        <TabsContent value="basic">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Basic Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Profile Picture */}
                                    <div className="flex items-start gap-6">
                                        <div className="flex flex-col items-center gap-3">
                                            <Avatar className="w-24 h-24">
                                                <AvatarImage src={profilePicturePreview || practitioner?.profile_picture_url} />
                                                <AvatarFallback className="text-lg">
                                                    {data.first_name?.[0]}{data.last_name?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex gap-2">
                                                <Label htmlFor="profile_picture" className="cursor-pointer">
                                                    <Button type="button" variant="outline" size="sm" className="h-8" disabled={s3Uploading}>
                                                        <Upload className="w-4 h-4 mr-1" />
                                                        {s3Uploading ? `Uploading ${progress}%` : 'Upload to S3'}
                                                    </Button>
                                                </Label>
                                                {profilePicturePreview && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => removeFile('profile_picture')}
                                                        disabled={s3Uploading}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            {s3Uploading && (
                                                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                                    <div
                                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                            )}
                                            {s3Error && (
                                                <p className="text-red-500 text-xs mt-1">{s3Error}</p>
                                            )}
                                            {uploadedFile && !s3Uploading && (
                                                <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    ✓ Uploaded to S3
                                                </p>
                                            )}
                                            <input
                                                id="profile_picture"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, 'profile_picture')}
                                            />
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="first_name">First Name *</Label>
                                                <Input
                                                    id="first_name"
                                                    value={data.first_name}
                                                    onChange={(e) => setData('first_name', e.target.value)}
                                                    className={errors.first_name ? 'border-red-500' : ''}
                                                />
                                                {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
                                            </div>

                                            <div>
                                                <Label htmlFor="last_name">Last Name *</Label>
                                                <Input
                                                    id="last_name"
                                                    value={data.last_name}
                                                    onChange={(e) => setData('last_name', e.target.value)}
                                                    className={errors.last_name ? 'border-red-500' : ''}
                                                />
                                                {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="title">Title *</Label>
                                            <Select value={data.title} onValueChange={(value) => setData('title', value)}>
                                                <SelectTrigger className={errors.title ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder="Select a title" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Dr.">Dr.</SelectItem>
                                                    <SelectItem value="Mr.">Mr.</SelectItem>
                                                    <SelectItem value="Ms.">Ms.</SelectItem>
                                                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                                        </div>

                                        <div>
                                            <Label htmlFor="email">Email *</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={data.email}
                                                onChange={(e) => setData('email', e.target.value)}
                                                className={errors.email ? 'border-red-500' : ''}
                                            />
                                            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <Label htmlFor="phone_number">Phone Number *</Label>
                                            <Input
                                                id="phone_number"
                                                value={data.phone_number}
                                                onChange={(e) => setData('phone_number', e.target.value)}
                                                className={errors.phone_number ? 'border-red-500' : ''}
                                            />
                                            {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>}
                                        </div>

                                        <div>
                                            <Label htmlFor="extension">Extension *</Label>
                                            <Select value={data.extension} onValueChange={(value) => setData('extension', value)}>
                                                <SelectTrigger className={errors.extension ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder="Select Extension" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="101">101</SelectItem>
                                                    <SelectItem value="102">102</SelectItem>
                                                    <SelectItem value="103">103</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.extension && <p className="text-red-500 text-sm mt-1">{errors.extension}</p>}
                                        </div>

                                        <div>
                                            <Label htmlFor="gender">Gender *</Label>
                                            <Select value={data.gender} onValueChange={(value) => setData('gender', value)}>
                                                <SelectTrigger className={errors.gender ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder="Select gender" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="male">Male</SelectItem>
                                                    <SelectItem value="female">Female</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="pronoun">Pronounce *</Label>
                                            <Input
                                                id="pronoun"
                                                value={data.pronoun}
                                                onChange={(e) => setData('pronoun', e.target.value)}
                                                placeholder="Enter pronouns"
                                                className={errors.pronoun ? 'border-red-500' : ''}
                                            />
                                            {errors.pronoun && <p className="text-red-500 text-sm mt-1">{errors.pronoun}</p>}
                                        </div>

                                        <div className="flex items-center space-x-2 pt-6">
                                            <Switch
                                                id="is_active"
                                                checked={data.is_active}
                                                onCheckedChange={(checked) => setData('is_active', checked)}
                                            />
                                            <Label htmlFor="is_active">Active Profile</Label>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="short_bio">Short Bio</Label>
                                        <Textarea
                                            id="short_bio"
                                            placeholder="Brief professional summary (2-3 sentences)"
                                            value={data.short_bio}
                                            onChange={(e) => setData('short_bio', e.target.value)}
                                            className="min-h-[80px]"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="full_bio">Full Biography</Label>
                                        <Textarea
                                            id="full_bio"
                                            placeholder="Detailed professional background, experience, and approach"
                                            value={data.full_bio}
                                            onChange={(e) => setData('full_bio', e.target.value)}
                                            className="min-h-[120px]"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Professional Details Tab */}
                        <TabsContent value="professional">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Stethoscope className="w-5 h-5" />
                                        Professional Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Credentials */}
                                    <div>
                                        <Label>Credentials *</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                                            {CREDENTIALS.map(credential => (
                                                <div key={credential} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`credential-${credential}`}
                                                        checked={data.credentials.includes(credential)}
                                                        onCheckedChange={() =>
                                                            toggleArrayValue(data.credentials, credential, setData, 'credentials')
                                                        }
                                                    />
                                                    <Label htmlFor={`credential-${credential}`} className="text-sm">
                                                        {credential}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {errors.credentials && <p className="text-red-500 text-sm mt-1">{errors.credentials}</p>}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="years_of_experience">Years of Experience *</Label>
                                            <Select
                                                value={data.years_of_experience}
                                                onValueChange={(value) => setData('years_of_experience', value)}
                                            >
                                                <SelectTrigger className={errors.years_of_experience ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder="Select year of experience" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {YEARS_OF_EXPERIENCE.map(range => (
                                                        <SelectItem key={range} value={range}>{range}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.years_of_experience && <p className="text-red-500 text-sm mt-1">{errors.years_of_experience}</p>}
                                        </div>

                                        <div>
                                            <Label htmlFor="license_number">License Number / Registration ID *</Label>
                                            <Input
                                                id="license_number"
                                                value={data.license_number}
                                                onChange={(e) => setData('license_number', e.target.value)}
                                                placeholder="Enter license number"
                                                className={errors.license_number ? 'border-red-500' : ''}
                                            />
                                            {errors.license_number && <p className="text-red-500 text-sm mt-1">{errors.license_number}</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <Label>Professional Associations *</Label>
                                        <Select onValueChange={(value) => toggleArrayValue(data.professional_associations, value, setData, 'professional_associations')}>
                                            <SelectTrigger className={errors.professional_associations ? 'border-red-500' : ''}>
                                                <SelectValue placeholder="Select professional association" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="APA">American Psychological Association</SelectItem>
                                                <SelectItem value="CPA">Canadian Psychological Association</SelectItem>
                                                <SelectItem value="NASW">National Association of Social Workers</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {(Array.isArray(data.professional_associations) ? data.professional_associations : []).map((assoc: any, index: number) => (
                                                <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm flex items-center gap-1">
                                                    {assoc}
                                                    <button onClick={() => removeArrayItem(data.professional_associations, index, setData, 'professional_associations')}>×</button>
                                                </span>
                                            ))}
                                        </div>
                                        {errors.professional_associations && <p className="text-red-500 text-sm mt-1">{errors.professional_associations}</p>}
                                    </div>

                                    {/* Primary Specialties */}
                                    <div>
                                        <Label>Primary Specialities *</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded p-2">
                                            {SPECIALTIES.map(specialty => (
                                                <div key={specialty} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`specialty-${specialty}`}
                                                        checked={data.primary_specialties.includes(specialty)}
                                                        onCheckedChange={() =>
                                                            toggleArrayValue(data.primary_specialties, specialty, setData, 'primary_specialties')
                                                        }
                                                    />
                                                    <Label htmlFor={`specialty-${specialty}`} className="text-sm">
                                                        {specialty}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {errors.primary_specialties && <p className="text-red-500 text-sm mt-1">{errors.primary_specialties}</p>}
                                    </div>

                                    {/* Therapeutic Modalities */}
                                    <div>
                                        <Label>Therapeutic Modalities *</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded p-2">
                                            {THERAPEUTIC_MODALITIES.map(modality => (
                                                <div key={modality} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`modality-${modality}`}
                                                        checked={data.therapeutic_modalities.includes(modality)}
                                                        onCheckedChange={() =>
                                                            toggleArrayValue(data.therapeutic_modalities, modality, setData, 'therapeutic_modalities')
                                                        }
                                                    />
                                                    <Label htmlFor={`modality-${modality}`} className="text-sm">
                                                        {modality}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {errors.therapeutic_modalities && <p className="text-red-500 text-sm mt-1">{errors.therapeutic_modalities}</p>}
                                    </div>

                                    {/* Client Types */}
                                    <div>
                                        <Label>Client Types Served *</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                                            {CLIENT_TYPES.map(clientType => (
                                                <div key={clientType} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`client-${clientType}`}
                                                        checked={data.client_types_served.includes(clientType)}
                                                        onCheckedChange={() =>
                                                            toggleArrayValue(data.client_types_served, clientType, setData, 'client_types_served')
                                                        }
                                                    />
                                                    <Label htmlFor={`client-${clientType}`} className="text-sm">
                                                        {clientType}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {errors.client_types_served && <p className="text-red-500 text-sm mt-1">{errors.client_types_served}</p>}
                                    </div>

                                    {/* Languages */}
                                    <div>
                                        <Label>Languages Spoken *</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                                            {LANGUAGES.map(language => (
                                                <div key={language} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`language-${language}`}
                                                        checked={data.languages_spoken.includes(language)}
                                                        onCheckedChange={() =>
                                                            toggleArrayValue(data.languages_spoken, language, setData, 'languages_spoken')
                                                        }
                                                    />
                                                    <Label htmlFor={`language-${language}`} className="text-sm">
                                                        {language}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {errors.languages_spoken && <p className="text-red-500 text-sm mt-1">{errors.languages_spoken}</p>}
                                    </div>

                                    {/* File Uploads */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Resume Files */}
                                        <div>
                                            <Label>Resume/CV</Label>
                                            <div className="mt-2 space-y-2">
                                                <Label htmlFor="resume_files" className="cursor-pointer">
                                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50">
                                                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                                                        <p className="mt-2 text-sm text-gray-600">Click to upload resume</p>
                                                    </div>
                                                </Label>
                                                <input
                                                    id="resume_files"
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.doc,.docx"
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(e, 'resume_files')}
                                                />
                                                {uploadedFiles.resume_files.map((file, index) => (
                                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                        <span className="text-sm truncate">{file.name}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeFile('resume_files', index)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* License Documents */}
                                        <div>
                                            <Label>License Documents</Label>
                                            <div className="mt-2 space-y-2">
                                                <Label htmlFor="licensing_documents" className="cursor-pointer">
                                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50">
                                                        <FileText className="mx-auto h-8 w-8 text-gray-400" />
                                                        <p className="mt-2 text-sm text-gray-600">Click to upload licenses</p>
                                                    </div>
                                                </Label>
                                                <input
                                                    id="licensing_documents"
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(e, 'licensing_documents')}
                                                />
                                                {uploadedFiles.licensing_documents.map((file, index) => (
                                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                        <span className="text-sm truncate">{file.name}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeFile('licensing_documents', index)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Certificates */}
                                        <div>
                                            <Label>Certificates</Label>
                                            <div className="mt-2 space-y-2">
                                                <Label htmlFor="certificates" className="cursor-pointer">
                                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50">
                                                        <Award className="mx-auto h-8 w-8 text-gray-400" />
                                                        <p className="mt-2 text-sm text-gray-600">Click to upload certificates</p>
                                                    </div>
                                                </Label>
                                                <input
                                                    id="certificates"
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(e, 'certificates')}
                                                />
                                                {uploadedFiles.certificates.map((file, index) => (
                                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                        <span className="text-sm truncate">{file.name}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeFile('certificates', index)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-4 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.get(route('dashboard'))}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing}
                            onClick={(e) => {
                                console.log('PractitionerEdit: Submit button clicked!', {
                                    processing: processing,
                                    buttonType: e.currentTarget.type,
                                    disabled: e.currentTarget.disabled
                                });
                            }}
                        >
                            {activeTab === 'basic'
                                ? 'Next'
                                : (processing ? 'Updating...' : 'Update Profile')
                            }
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}

Edit.layout = (page: React.ReactElement) => <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>;
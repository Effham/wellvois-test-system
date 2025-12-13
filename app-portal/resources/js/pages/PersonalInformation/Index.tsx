import React, { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInitials } from '@/hooks/use-initials';
import { useS3Upload } from '@/hooks/use-s3-upload';
import {
    User,
    Mail,
    Phone,
    MapPin,
    Stethoscope,
    AlertCircle,
    CheckCircle,
    Edit,
    Save,
    X,
    FileText,
    Building2,
    Calendar,
    ArrowLeft,
    Upload,
} from 'lucide-react';

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

interface Practitioner {
    id: number;
    user_id: number;
    first_name: string;
    last_name: string;
    title?: string;
    email: string;
    phone?: string;
    phone_number?: string;
    extension?: string;
    gender?: string;
    pronoun?: string;
    is_active?: boolean;
    short_bio?: string;
    full_bio?: string;
    specialization?: string;
    license_number?: string;
    bio?: string;
    credentials?: string[];
    years_of_experience?: string;
    professional_associations?: string[];
    primary_specialties?: string[];
    therapeutic_modalities?: string[];
    client_types_served?: string[];
    languages_spoken?: string[];
    resume_s3_key?: string;
    licensing_documents_s3_key?: string;
    certificates_s3_key?: string;
    licensing_documents?: any[];
    certificates?: any[];
    profile_picture_s3_key?: string;
    profile_picture_url?: string;
    user: {
        id: number;
        name: string;
        email: string;
        avatar?: string;
    };
}

interface Props {
    practitioner: Practitioner;
    [key: string]: any;
}

export default function PersonalInformation() {
    const pageProps = usePage<Props>().props;
    const { practitioner: practitionerProp } = pageProps;

    // Fix: The practitioner data comes wrapped in a 'data' property from the Resource
    // Access either practitionerProp directly OR practitionerProp.data, whichever has the actual data
    const practitioner = (practitionerProp as any)?.data || practitionerProp;

    const getInitials = useInitials();
    const [activeTab, setActiveTab] = useState('basic');
    const [isEditing, setIsEditing] = useState(false);

    // Debug logging to see what data we receive
    React.useEffect(() => {
        console.log('=== PersonalInformation Component Mounted ===');
        console.log('All page props:', pageProps);
        console.log('Practitioner prop (original):', practitionerProp);
        console.log('Practitioner (resolved):', practitioner);
        console.log('Practitioner details:', {
            id: practitioner?.id,
            first_name: practitioner?.first_name,
            last_name: practitioner?.last_name,
            email: practitioner?.email,
            user: practitioner?.user,
            hasData: !!practitioner,
            keys: practitioner ? Object.keys(practitioner) : []
        });
    }, []);

    // S3 upload hook
    const { uploadFile, uploading: s3Uploading, progress, error: s3Error, uploadedFile, reset: resetS3 } = useS3Upload();

    // Profile picture state
    const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [profilePictureS3Key, setProfilePictureS3Key] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        // Basic Info - Required fields
        first_name: practitioner?.first_name || '',
        last_name: practitioner?.last_name || '',
        title: practitioner?.title || '',
        email: practitioner?.email || practitioner?.user?.email || '',
        phone_number: practitioner?.phone_number || '',
        extension: practitioner?.extension || '',
        gender: practitioner?.gender || '',
        pronoun: practitioner?.pronoun || '',
        is_active: practitioner?.is_active ?? true,
        short_bio: practitioner?.short_bio || '',
        full_bio: practitioner?.full_bio || '',
        
        
        // Professional Info - Required fields
        credentials: practitioner?.credentials || [],
        years_of_experience: practitioner?.years_of_experience || '',
        license_number: practitioner?.license_number || '',
        professional_associations: practitioner?.professional_associations || [],
        primary_specialties: practitioner?.primary_specialties || [],
        therapeutic_modalities: practitioner?.therapeutic_modalities || [],
        client_types_served: practitioner?.client_types_served || [],
        languages_spoken: practitioner?.languages_spoken || [],
        
        // Document fields
        resume_s3_key: practitioner?.resume_s3_key || '',
        licensing_documents_s3_key: practitioner?.licensing_documents_s3_key || '',
        certificates_s3_key: practitioner?.certificates_s3_key || '',
        licensing_documents: practitioner?.licensing_documents || [],
        certificates: practitioner?.certificates || [],
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Personal Information', href: '/central/personal-information' },
    ];

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
            // Basic Info - Required fields
            first_name: practitioner?.first_name || '',
            last_name: practitioner?.last_name || '',
            title: practitioner?.title || '',
            email: practitioner?.email || practitioner?.user?.email || '',
            phone_number: practitioner?.phone_number || '',
            extension: practitioner?.extension || '',
            gender: practitioner?.gender || '',
            pronoun: practitioner?.pronoun || '',
            is_active: practitioner?.is_active ?? true,
            short_bio: practitioner?.short_bio || '',
            full_bio: practitioner?.full_bio || '',
            
            
            // Professional Info - Required fields
            credentials: practitioner?.credentials || [],
            years_of_experience: practitioner?.years_of_experience || '',
            license_number: practitioner?.license_number || '',
            professional_associations: practitioner?.professional_associations || [],
            primary_specialties: practitioner?.primary_specialties || [],
            therapeutic_modalities: practitioner?.therapeutic_modalities || [],
            client_types_served: practitioner?.client_types_served || [],
            languages_spoken: practitioner?.languages_spoken || [],
            
            // Document fields
            resume_s3_key: practitioner?.resume_s3_key || '',
            licensing_documents_s3_key: practitioner?.licensing_documents_s3_key || '',
            certificates_s3_key: practitioner?.certificates_s3_key || '',
            licensing_documents: practitioner?.licensing_documents || [],
            certificates: practitioner?.certificates || [],
        });
    };

    const handleSave = () => {
        // Prepare data for submission - don't use FormData for arrays
        const submitData: any = { ...formData };
        
        // Add S3 key if uploaded (check both hook state and local state)
        if (profilePictureS3Key) {
            submitData.profile_picture_s3_key = profilePictureS3Key;
            console.log('PersonalInformation: Including S3 key in form submission', {
                s3Key: profilePictureS3Key
            });
        } else if (uploadedFile?.key) {
            submitData.profile_picture_s3_key = uploadedFile.key;
            console.log('PersonalInformation: Including S3 key from hook in form submission', {
                s3Key: uploadedFile.key
            });
        } else {
            console.log('PersonalInformation: No S3 key to include in form submission');
        }

        // Convert boolean to proper boolean (not string)
        submitData.is_active = Boolean(submitData.is_active);

        router.post(route('practitioner-details.update'), submitData, {
            onSuccess: () => {
                setIsEditing(false);
            }
        });
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const addArrayItem = (field: string, value: string) => {
        const fieldValue = formData[field as keyof typeof formData] as string[];
        if (value && Array.isArray(fieldValue) && !fieldValue.includes(value)) {
            setFormData(prev => ({
                ...prev,
                [field]: [...(prev[field as keyof typeof prev] as string[]), value]
            }));
        }
    };

    const removeArrayItem = (field: string, index: number) => {
        setFormData(prev => ({
            ...prev,
            [field]: (prev[field as keyof typeof prev] as string[]).filter((_, i) => i !== index)
        }));
    };

    const removeDocumentItem = (field: string, index: number) => {
        setFormData(prev => {
            const currentValue = prev[field as keyof typeof prev];
            const arrayValue = Array.isArray(currentValue) ? currentValue : [];
            return {
                ...prev,
                [field]: arrayValue.filter((_, i) => i !== index)
            };
        });
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Upload to S3 for each file
        for (const file of Array.from(files)) {
            try {
                console.log(`PersonalInformation: Starting ${documentType} upload to S3`, {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type
                });

                // Upload to S3 with organized path
                const response = await uploadFile(file, {
                    onProgress: (progress: any) => {
                        console.log(`PersonalInformation: ${documentType} upload progress`, { progress });
                    },
                    onSuccess: (result: any) => {
                        console.log(`PersonalInformation: ${documentType} uploaded successfully to S3`, {
                            s3Key: result?.key,
                            fileName: file.name
                        });
                    },
                    onError: (error: any) => {
                        console.error(`PersonalInformation: ${documentType} upload failed`, { error });
                    }
                });

                if (response?.key) {
                    // For resume, store in dedicated S3 key field
                    if (documentType === 'resume') {
                        setFormData(prev => ({
                            ...prev,
                            resume_s3_key: response.key
                        }));
                    } else if (documentType === 'licensing_documents') {
                        // Store S3 key in dedicated field and document metadata in JSON field
                        setFormData(prev => ({
                            ...prev,
                            licensing_documents_s3_key: response.key,
                            [documentType]: [...(Array.isArray(prev[documentType as keyof typeof prev]) ? prev[documentType as keyof typeof prev] as any[] : []), {
                                s3_key: response.key,
                                original_filename: file.name,
                                mime_type: file.type,
                                file_size: file.size
                            }]
                        }));
                    } else if (documentType === 'certificates') {
                        // Store S3 key in dedicated field and document metadata in JSON field
                        setFormData(prev => ({
                            ...prev,
                            certificates_s3_key: response.key,
                            [documentType]: [...(Array.isArray(prev[documentType as keyof typeof prev]) ? prev[documentType as keyof typeof prev] as any[] : []), {
                                s3_key: response.key,
                                original_filename: file.name,
                                mime_type: file.type,
                                file_size: file.size
                            }]
                        }));
                    }

                    console.log(`PersonalInformation: ${documentType} S3 upload completed`, {
                        s3Key: response.key,
                        fileName: file.name
                    });
                }
            } catch (error) {
                console.error(`PersonalInformation: ${documentType} S3 upload error`, { error });
                alert(`Failed to upload ${documentType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Clear the input
        e.target.value = '';
    };

    const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            console.log('PersonalInformation: Profile picture file selected', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                practitionerId: practitioner?.id
            });

            // Validate file
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file.');
                return;
            }

            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert('File size must be less than 5MB.');
                return;
            }

            // Create preview immediately
            const reader = new FileReader();
            reader.onload = (e) => setProfilePicturePreview(e.target?.result as string);
            reader.readAsDataURL(file);

            try {
                // Reset previous S3 upload state
                resetS3();
                setUploadSuccess(false);

                // Upload to S3 with organized path
                const s3Key = `practitioners/${practitioner?.id}/profile/avatar.${file.name.split('.').pop()}`;

                console.log('PersonalInformation: Starting S3 profile picture upload', {
                    fileName: file.name,
                    s3Key,
                    practitionerId: practitioner?.id
                });

                const response = await uploadFile(file, {
                    key: s3Key,
                    expiresMinutes: 1440, // 24 hours for profile pictures
                    onProgress: (progress) => {
                        console.log('PersonalInformation: Profile picture upload progress', { progress });
                    },
                    onSuccess: (response) => {
                        console.log('PersonalInformation: Profile picture uploaded successfully to S3', {
                            key: response.key,
                            signed_url_length: response.signed_url?.length || 0
                        });
                    },
                    onError: (error) => {
                        console.error('PersonalInformation: Profile picture upload failed', { error });
                    }
                });

                setUploadSuccess(true);
                console.log('PersonalInformation: Profile picture S3 upload completed', {
                    s3Key: response.key,
                    signedUrl: response.signed_url,
                    uploadedFileState: uploadedFile,
                    responseForFormSubmission: response
                });

                // Store S3 key for form submission
                setProfilePictureS3Key(response.key);
                console.log('PersonalInformation: S3 key stored for form submission', {
                    s3Key: response.key,
                    willBeIncludedInForm: true
                });

                // Here you could also update the practitioner's profile picture in the database
                // by making an API call to save the S3 key and signed URL

                setTimeout(() => setUploadSuccess(false), 5000);

            } catch (error) {
                console.error('PersonalInformation: S3 upload error', { error });
                alert(`Failed to upload profile picture: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    const renderBasicInfo = () => (
        <div className="space-y-6">
            {/* Profile Picture */}
            <div className="flex flex-col items-center space-y-2">
                <div className="relative">
                    <Avatar className="w-24 h-24">
                        <AvatarImage
                            src={profilePicturePreview || practitioner?.profile_picture_url || practitioner?.user?.avatar}
                            alt={practitioner?.user?.name}
                        />
                        <AvatarFallback className="text-lg font-semibold">
                            {getInitials(practitioner?.user?.name || `${practitioner?.first_name} ${practitioner?.last_name}`)}
                        </AvatarFallback>
                    </Avatar>

                    {/* Upload Button */}
                    {isEditing && (
                        <div className="absolute -bottom-2 -right-2">
                            <label
                                htmlFor="profile-picture-upload"
                                className="cursor-pointer rounded-full w-8 h-8 p-0 bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 shadow-sm"
                            >
                                <Upload className="w-4 h-4" />
                            </label>
                            <input
                                id="profile-picture-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleProfilePictureUpload}
                                className="hidden"
                            />
                        </div>
                    )}
                </div>

                {/* S3 Upload Progress */}
                {s3Uploading && (
                    <div className="space-y-2 w-full max-w-xs">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-600">Uploading...</span>
                            <span className="text-blue-600">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Success Message */}
                {uploadSuccess && (
                    <div className="text-green-600 text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Profile picture uploaded successfully!
                    </div>
                )}

                {/* Error Messages */}
                {s3Error && (
                    <div className="text-red-600 text-sm">
                        Upload Error: {s3Error}
                    </div>
                )}
            </div>

            {/* Basic Information Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
                    <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => handleInputChange('first_name', e.target.value)}
                        disabled={!isEditing}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name <span className="text-red-500">*</span></Label>
                    <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => handleInputChange('last_name', e.target.value)}
                        disabled={!isEditing}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                    {isEditing ? (
                        <Select value={formData.title} onValueChange={(value) => handleInputChange('title', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a title" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Dr.">Dr.</SelectItem>
                                <SelectItem value="Mr.">Mr.</SelectItem>
                                <SelectItem value="Ms.">Ms.</SelectItem>
                                <SelectItem value="Mrs.">Mrs.</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input value={formData.title} disabled />
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                    <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={!isEditing}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number <span className="text-red-500">*</span></Label>
                    <Input
                        id="phone_number"
                        value={formData.phone_number}
                        onChange={(e) => handleInputChange('phone_number', e.target.value)}
                        disabled={!isEditing}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="extension">Extension <span className="text-red-500">*</span></Label>
                    {isEditing ? (
                        <Select value={formData.extension} onValueChange={(value) => handleInputChange('extension', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Extension" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="101">101</SelectItem>
                                <SelectItem value="102">102</SelectItem>
                                <SelectItem value="103">103</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input value={formData.extension} disabled />
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                    {isEditing ? (
                        <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input value={formData.gender} disabled />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pronoun">Pronounce <span className="text-red-500">*</span></Label>
                    <Input
                        id="pronoun"
                        value={formData.pronoun}
                        onChange={(e) => handleInputChange('pronoun', e.target.value)}
                        placeholder="Enter pronouns"
                        disabled={!isEditing}
                    />
                </div>
                <div className="space-y-2 flex items-center pt-6">
                    <Label htmlFor="is_active">Active Status</Label>
                    {/* Active status display - this is typically managed by admin, not self-editable */}
                    <Badge variant={formData.is_active ? "default" : "secondary"} className="ml-2">
                        {formData.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="short_bio">Short Bio</Label>
                    <Textarea
                        id="short_bio"
                        rows={3}
                        value={formData.short_bio}
                        onChange={(e) => handleInputChange('short_bio', e.target.value)}
                        disabled={!isEditing}
                        placeholder="Brief professional summary (2-3 sentences)"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="full_bio">Full Biography</Label>
                    <Textarea
                        id="full_bio"
                        rows={3}
                        value={formData.full_bio}
                        onChange={(e) => handleInputChange('full_bio', e.target.value)}
                        disabled={!isEditing}
                        placeholder="Detailed professional background, experience, and approach"
                    />
                </div>
            </div>


        </div>
    );

    const renderProfessionalDetails = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Credentials */}
                <div>
                    <Label>Credentials <span className="text-red-500">*</span></Label>
                    {isEditing ? (
                        <>
                            <Select onValueChange={(value) => addArrayItem('credentials', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your credentials" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CREDENTIALS.map(cred => (
                                        <SelectItem key={cred} value={cred}>{cred}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {(formData.credentials || []).map((cred: string, index: number) => (
                                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                        {cred}
                                        <button 
                                            onClick={() => removeArrayItem('credentials', index)}
                                            className="ml-1 text-red-500 hover:text-red-700"
                                        >
                                            ×
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(formData.credentials || []).map((cred: string, index: number) => (
                                <Badge key={index} variant="secondary">{cred}</Badge>
                            ))}
                            {(!formData.credentials || formData.credentials.length === 0) && (
                                <span className="text-gray-500 italic">No credentials added</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Years of Experience */}
                <div>
                    <Label>Years of Experience <span className="text-red-500">*</span></Label>
                    {isEditing ? (
                        <Select 
                            value={formData.years_of_experience} 
                            onValueChange={(value) => handleInputChange('years_of_experience', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select year of experience" />
                            </SelectTrigger>
                            <SelectContent>
                                {YEARS_OF_EXPERIENCE.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="mt-2">
                            <span className={formData.years_of_experience ? '' : 'text-gray-500 italic'}>
                                {formData.years_of_experience || 'Not specified'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* License Number */}
                <div className="space-y-2">
                    <Label htmlFor="license_number">License Number / Registration ID <span className="text-red-500">*</span></Label>
                    <Input
                        id="license_number"
                        value={formData.license_number}
                        onChange={(e) => handleInputChange('license_number', e.target.value)}
                        disabled={!isEditing}
                        placeholder="Enter license number"
                    />
                </div>

            </div>

            {/* Primary Specialties */}
            <div>
                <Label>Primary Specialities <span className="text-red-500">*</span></Label>
                {isEditing ? (
                    <>
                        <Select onValueChange={(value) => addArrayItem('primary_specialties', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select primary specialties" />
                            </SelectTrigger>
                            <SelectContent>
                                {SPECIALTIES.map(specialty => (
                                    <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(formData.primary_specialties || []).map((specialty: string, index: number) => (
                                <Badge key={index} variant="outline" className="flex items-center gap-1">
                                    {specialty}
                                    <button
                                        onClick={() => removeArrayItem('primary_specialties', index)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(formData.primary_specialties || []).map((specialty: string, index: number) => (
                            <Badge key={index} variant="outline">{specialty}</Badge>
                        ))}
                        {(!formData.primary_specialties || formData.primary_specialties.length === 0) && (
                            <span className="text-gray-500 italic">No specialties added</span>
                        )}
                    </div>
                )}
            </div>

            {/* Professional Associations */}
            <div>
                <Label>Professional Associations <span className="text-red-500">*</span></Label>
                {isEditing ? (
                    <>
                        <Select onValueChange={(value) => addArrayItem('professional_associations', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select professional association" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="APA">American Psychological Association</SelectItem>
                                <SelectItem value="CPA">Canadian Psychological Association</SelectItem>
                                <SelectItem value="NASW">National Association of Social Workers</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(formData.professional_associations || []).map((assoc: string, index: number) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                    {assoc}
                                    <button 
                                        onClick={() => removeArrayItem('professional_associations', index)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(formData.professional_associations || []).map((assoc: string, index: number) => (
                            <Badge key={index} variant="secondary">{assoc}</Badge>
                        ))}
                        {(!formData.professional_associations || formData.professional_associations.length === 0) && (
                            <span className="text-gray-500 italic">No associations added</span>
                        )}
                    </div>
                )}
            </div>

            {/* Therapeutic Modalities */}
            <div>
                <Label>Therapeutic Modalities <span className="text-red-500">*</span></Label>
                {isEditing ? (
                    <>
                        <Select onValueChange={(value) => addArrayItem('therapeutic_modalities', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select your modalities" />
                            </SelectTrigger>
                            <SelectContent>
                                {THERAPEUTIC_MODALITIES.map(modality => (
                                    <SelectItem key={modality} value={modality}>{modality}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(formData.therapeutic_modalities || []).map((modality: string, index: number) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                    {modality}
                                    <button 
                                        onClick={() => removeArrayItem('therapeutic_modalities', index)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(formData.therapeutic_modalities || []).map((modality: string, index: number) => (
                            <Badge key={index} variant="secondary">{modality}</Badge>
                        ))}
                        {(!formData.therapeutic_modalities || formData.therapeutic_modalities.length === 0) && (
                            <span className="text-gray-500 italic">No modalities added</span>
                        )}
                    </div>
                )}
            </div>

            {/* Client Types Served */}
            <div>
                <Label>Client Types Served <span className="text-red-500">*</span></Label>
                {isEditing ? (
                    <>
                        <Select onValueChange={(value) => addArrayItem('client_types_served', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select client types" />
                            </SelectTrigger>
                            <SelectContent>
                                {CLIENT_TYPES.map(clientType => (
                                    <SelectItem key={clientType} value={clientType}>{clientType}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(formData.client_types_served || []).map((clientType: string, index: number) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                    {clientType}
                                    <button 
                                        onClick={() => removeArrayItem('client_types_served', index)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(formData.client_types_served || []).map((clientType: string, index: number) => (
                            <Badge key={index} variant="secondary">{clientType}</Badge>
                        ))}
                        {(!formData.client_types_served || formData.client_types_served.length === 0) && (
                            <span className="text-gray-500 italic">No client types added</span>
                        )}
                    </div>
                )}
            </div>

            {/* Languages Spoken */}
            <div>
                <Label>Languages Spoken <span className="text-red-500">*</span></Label>
                {isEditing ? (
                    <>
                        <Select onValueChange={(value) => addArrayItem('languages_spoken', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select languages" />
                            </SelectTrigger>
                            <SelectContent>
                                {LANGUAGES.map(language => (
                                    <SelectItem key={language} value={language}>{language}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(formData.languages_spoken || []).map((language: string, index: number) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                    {language}
                                    <button 
                                        onClick={() => removeArrayItem('languages_spoken', index)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                    >
                                        ×
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(formData.languages_spoken || []).map((language: string, index: number) => (
                            <Badge key={index} variant="secondary">{language}</Badge>
                        ))}
                        {(!formData.languages_spoken || formData.languages_spoken.length === 0) && (
                            <span className="text-gray-500 italic">No languages added</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const renderDocuments = () => (
        <div className="space-y-6">
            {/* Resume Upload */}
            <div>
                <Label>Resume <span className="text-red-500">*</span></Label>
                <div className="mt-2">
                    {formData.resume_s3_key ? (
                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="font-medium">Resume.pdf</p>
                                    <p className="text-sm text-gray-500">Uploaded</p>
                                </div>
                            </div>
                            {isEditing && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleInputChange('resume_s3_key', '')}
                                >
                                    <X className="h-4 w-4" />
                                    Remove
                                </Button>
                            )}
                        </div>
                    ) : (
                        isEditing && (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                                <div className="text-center">
                                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                    <div className="mt-4">
                                        <label htmlFor="resume-upload" className="cursor-pointer">
                                            <span className="mt-2 block text-sm font-medium text-gray-900">
                                                Upload your resume
                                            </span>
                                            <span className="mt-1 block text-sm text-gray-500">
                                                PDF, DOC, or DOCX up to 10MB
                                            </span>
                                        </label>
                                        <input
                                            id="resume-upload"
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.doc,.docx"
                                            onChange={(e) => handleDocumentUpload(e, 'resume')}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Licensing Documents */}
            <div>
                <Label>Licensing Documents <span className="text-red-500">*</span></Label>
                <div className="mt-2 space-y-2">
                    {(Array.isArray(formData.licensing_documents) ? formData.licensing_documents : []).map((doc: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-green-600" />
                                <div>
                                    <p className="font-medium">{doc.original_filename || `License Document ${index + 1}`}</p>
                                    <p className="text-sm text-gray-500">Uploaded</p>
                                </div>
                            </div>
                            {isEditing && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeDocumentItem('licensing_documents', index)}
                                >
                                    <X className="h-4 w-4" />
                                    Remove
                                </Button>
                            )}
                        </div>
                    ))}
                    {isEditing && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <div className="text-center">
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="mt-4">
                                    <label htmlFor="licensing-upload" className="cursor-pointer">
                                        <span className="mt-2 block text-sm font-medium text-gray-900">
                                            Upload licensing documents
                                        </span>
                                        <span className="mt-1 block text-sm text-gray-500">
                                            PDF, JPG, PNG up to 10MB each
                                        </span>
                                    </label>
                                    <input
                                        id="licensing-upload"
                                        type="file"
                                        className="hidden"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => handleDocumentUpload(e, 'licensing_documents')}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Certificates */}
            <div>
                <Label>Certificates <span className="text-red-500">*</span></Label>
                <div className="mt-2 space-y-2">
                    {(Array.isArray(formData.certificates) ? formData.certificates : []).map((cert: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-purple-600" />
                                <div>
                                    <p className="font-medium">{cert.original_filename || `Certificate ${index + 1}`}</p>
                                    <p className="text-sm text-gray-500">Uploaded</p>
                                </div>
                            </div>
                            {isEditing && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeDocumentItem('certificates', index)}
                                >
                                    <X className="h-4 w-4" />
                                    Remove
                                </Button>
                            )}
                        </div>
                    ))}
                    {isEditing && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <div className="text-center">
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="mt-4">
                                    <label htmlFor="certificates-upload" className="cursor-pointer">
                                        <span className="mt-2 block text-sm font-medium text-gray-900">
                                            Upload certificates
                                        </span>
                                        <span className="mt-1 block text-sm text-gray-500">
                                            PDF, JPG, PNG up to 10MB each
                                        </span>
                                    </label>
                                    <input
                                        id="certificates-upload"
                                        type="file"
                                        className="hidden"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => handleDocumentUpload(e, 'certificates')}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (!practitioner) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Personal Information" />
                <div className="space-y-6">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Practitioner profile not found. Please contact your administrator.
                        </AlertDescription>
                    </Alert>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Personal Information" />
            
            <div className="space-y-6">
                {/* Header */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.get(route('dashboard'))}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                Personal Information
                            </CardTitle>
                            
                            <div className="flex space-x-2">
                                {!isEditing ? (
                                    <Button onClick={handleEdit} className="gap-2">
                                        <Edit className="h-4 w-4" />
                                        Edit Information
                                    </Button>
                                ) : (
                                    <>
                                        <Button variant="outline" onClick={handleCancel} className="gap-2">
                                            <X className="h-4 w-4" />
                                            Cancel
                                        </Button>
                                        <Button onClick={handleSave} className="gap-2">
                                            <Save className="h-4 w-4" />
                                            Save Changes
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                                <TabsTrigger value="professional">Professional Details</TabsTrigger>
                                <TabsTrigger value="documents">Documents</TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="mt-6 space-y-6">
                                {renderBasicInfo()}
                            </TabsContent>

                            <TabsContent value="professional" className="mt-6 space-y-6">
                                {renderProfessionalDetails()}
                            </TabsContent>

                            <TabsContent value="documents" className="mt-6 space-y-6">
                                {renderDocuments()}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
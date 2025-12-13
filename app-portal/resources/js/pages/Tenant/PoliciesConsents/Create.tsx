import React, { useState, useEffect } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { 
    ArrowLeft, 
    Plus, 
    FileText, 
    Shield, 
    Users, 
    UserCheck,
    CheckCircle,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ExistingConsent {
    id: number;
    title: string;
    key: string;
    entity_type: string;
}

interface Version {
    id: number;
    version: number;
    status: string;
    created_at: string;
}

interface TitleCheckResponse {
    exists: boolean;
    suggested_key?: string;
    consent?: ExistingConsent;
    versions?: Version[];
}

interface Props {
    existingConsentId?: number;
    existingConsent?: any;
}

export default function Create({ existingConsentId, existingConsent: existingConsentProp }: Props) {
    const [titleCheckResponse, setTitleCheckResponse] = useState<TitleCheckResponse | null>(null);
    const [isCheckingTitle, setIsCheckingTitle] = useState(false);
    const [isNewVersion, setIsNewVersion] = useState(!!existingConsentId);
    const [existingConsent, setExistingConsent] = useState<ExistingConsent | null>(existingConsentProp || null);

    const { data, setData, errors, processing, reset } = useForm({
        title: existingConsentProp?.title || '',
        entity_type: existingConsentProp?.entity_type || 'PRACTITIONER',
        consent_body: {} as Record<string, any>,
        is_new_version: !!existingConsentId,
        existing_consent_id: existingConsentId || null,
        is_required: false,
        trigger_points: {} as Record<string, string[]>,
    });

    // If we're creating a new version, use the existing consent data from props
    useEffect(() => {
        if (existingConsentId && existingConsentProp) {
            setExistingConsent(existingConsentProp);
            setIsNewVersion(true);
            setData((prevData) => ({
                ...prevData,
                is_new_version: true,
                existing_consent_id: existingConsentId,
                title: existingConsentProp.title,
                entity_type: existingConsentProp.entity_type,
            }));
        }
    }, [existingConsentId, existingConsentProp]);

    const checkTitle = async (title: string) => {
        if (!title.trim()) {
            setTitleCheckResponse(null);
            return;
        }

        setIsCheckingTitle(true);
        try {
            const response = await fetch(route('policies-consents.check-title'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ title }),
            });

            const result = await response.json();
            setTitleCheckResponse(result);
            
            if (result.exists) {
                setIsNewVersion(true);
                setExistingConsent(result.consent);
                setData((prevData) => ({
                    ...prevData,
                    is_new_version: true,
                    existing_consent_id: result.consent.id,
                    title: result.consent.title,
                    entity_type: result.consent.entity_type,
                }));
            } else {
                setIsNewVersion(false);
                setExistingConsent(null);
                setData((prevData) => ({
                    ...prevData,
                    is_new_version: false,
                    existing_consent_id: null,
                    entity_type: prevData.entity_type,
                }));
            }
        } catch (error) {
            console.error('Error checking title:', error);
        } finally {
            setIsCheckingTitle(false);
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value;
        setData('title', title);
        
        // Debounce the title check
        const timeoutId = setTimeout(() => {
            checkTitle(title);
        }, 500);

        return () => clearTimeout(timeoutId);
    };

    const handleConsentBodyChange = (content: string) => {
        // Parse the HTML content and create a structured consent body
        const body: Record<string, any> = {
            content: content,
            heading: data.title,
            description: `Consent document for ${data.title}`,
        };

        // Add checkbox text based on the content
        if (content.includes('I agree') || content.includes('I consent') || content.includes('I acknowledge')) {
            // Extract the first sentence that contains agreement language
            const sentences = content.split(/[.!?]+/);
            const agreementSentence = sentences.find(sentence => 
                sentence.includes('I agree') || 
                sentence.includes('I consent') || 
                sentence.includes('I acknowledge')
            );
            if (agreementSentence) {
                body.checkbox_text = agreementSentence.trim() + '.';
            }
        }

        setData('consent_body', body);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route('policies-consents.store'), data);
    };

    const getEntityTypeIcon = (entityType: string) => {
        switch (entityType) {
            case 'PRACTITIONER':
                return <Shield className="h-4 w-4 text-blue-600" />;
            case 'PATIENT':
                return <Users className="h-4 w-4 text-green-600" />;
            case 'USER':
                return <UserCheck className="h-4 w-4 text-purple-600" />;
            default:
                return <FileText className="h-4 w-4 text-gray-600" />;
        }
    };

    const getEntityTypeLabel = (entityType: string) => {
        switch (entityType) {
            case 'PRACTITIONER':
                return 'Practitioner';
            case 'PATIENT':
                return 'Patient';
            case 'USER':
                return 'User';
            default:
                return entityType;
        }
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: route('dashboard') },
                { title: 'Policies & Consents', href: route('policies-consents.index') },
                { title: 'Create', href: route('policies-consents.create') },
            ]}
        >
            <Head title="Create Consent - Policies & Consents" />

            <div className="p-6 md:p-6 page-content-mobile">
                <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href={route('policies-consents.index')}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Consents
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {isNewVersion ? 'Create New Version' : 'Create New Consent'}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {isNewVersion 
                                ? `Create a new version of "${existingConsent?.title}"`
                                : 'Create a new consent document for your organization'
                            }
                        </p>
                    </div>
                </div>

                {/* Title Check Alert */}
                {titleCheckResponse && (
                    <Alert variant={titleCheckResponse.exists ? "default" : "success"}>
                        <div className="flex items-center gap-2">
                            {titleCheckResponse.exists ? (
                                <AlertCircle className="h-4 w-4" />
                            ) : (
                                <CheckCircle className="h-4 w-4" />
                            )}
                            <AlertDescription>
                                {titleCheckResponse.exists ? (
                                    <div>
                                        <p className="font-medium">Consent with this title already exists.</p>
                                        <p className="text-sm mt-1">
                                            You can create a new version of "{titleCheckResponse.consent?.title}" 
                                            or choose a different title for a new consent.
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-medium">Title is available.</p>
                                        <p className="text-sm mt-1">
                                            Suggested key: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                                {titleCheckResponse.suggested_key}
                                            </code>
                                        </p>
                                    </div>
                                )}
                            </AlertDescription>
                        </div>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                            <CardDescription>
                                {isNewVersion 
                                    ? 'This information will be inherited from the original consent.'
                                    : 'Enter the basic information for this consent document.'
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Title */}
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <div className="relative">
                                    <Input
                                        id="title"
                                        value={data.title}
                                        onChange={handleTitleChange}
                                        placeholder="Enter consent title..."
                                        disabled={isNewVersion}
                                        className={errors.title ? 'border-red-500' : ''}
                                    />
                                    {isCheckingTitle && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                {errors.title && (
                                    <p className="text-sm text-red-600">{errors.title}</p>
                                )}
                            </div>

                            {/* Key (read-only) */}
                            <div className="space-y-2">
                                <Label htmlFor="key">Key</Label>
                                <Input
                                    id="key"
                                    value={isNewVersion ? existingConsent?.key : titleCheckResponse?.suggested_key || ''}
                                    disabled
                                    className="bg-gray-50 dark:bg-gray-800"
                                />
                                <p className="text-xs text-gray-500">
                                    Auto-generated from title. Used internally to identify this consent.
                                </p>
                            </div>

                            {/* Entity Type */}
                            <div className="space-y-2">
                                <Label htmlFor="entity_type">Entity Type</Label>
                                <Select
                                    value={data.entity_type}
                                    onValueChange={(value) => setData('entity_type', value)}
                                    disabled={isNewVersion}
                                >
                                    <SelectTrigger className={errors.entity_type ? 'border-red-500' : ''}>
                                        <SelectValue placeholder="Select entity type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PRACTITIONER">
                                            <div className="flex items-center gap-2">
                                                {getEntityTypeIcon('PRACTITIONER')}
                                                {getEntityTypeLabel('PRACTITIONER')}
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="PATIENT">
                                            <div className="flex items-center gap-2">
                                                {getEntityTypeIcon('PATIENT')}
                                                {getEntityTypeLabel('PATIENT')}
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="USER">
                                            <div className="flex items-center gap-2">
                                                {getEntityTypeIcon('USER')}
                                                {getEntityTypeLabel('USER')}
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.entity_type && (
                                    <p className="text-sm text-red-600">{errors.entity_type}</p>
                                )}
                            </div>

                            {/* Is Required Toggle */}
                            {!isNewVersion && (
                                <div className="flex items-center justify-between space-x-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="is_required" className="text-base">
                                            Required Consent
                                        </Label>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Required consents must be accepted by users and cannot be revoked.
                                        </p>
                                    </div>
                                    <Switch
                                        id="is_required"
                                        checked={data.is_required}
                                        onCheckedChange={(checked) => setData('is_required', checked)}
                                    />
                                </div>
                            )}

                            {/* Trigger Points */}
                            {!isNewVersion && (
                                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Trigger Points</Label>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Select when this consent should be sent to users
                                        </p>
                                    </div>

                                    {/* Patient Triggers */}
                                    {data.entity_type === 'PATIENT' && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-sm font-medium">Patient Triggers</Label>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="trigger_patient_creation"
                                                    checked={data.trigger_points?.patient?.includes('creation') || false}
                                                    onCheckedChange={(checked) => {
                                                        const triggers = data.trigger_points || {};
                                                        const patientTriggers = triggers.patient || [];
                                                        setData('trigger_points', {
                                                            ...triggers,
                                                            patient: checked
                                                                ? [...patientTriggers.filter(t => t !== 'creation'), 'creation']
                                                                : patientTriggers.filter(t => t !== 'creation')
                                                        });
                                                    }}
                                                />
                                                <Label htmlFor="trigger_patient_creation" className="text-sm font-normal cursor-pointer">
                                                    On Patient Creation
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="trigger_appointment_creation"
                                                    checked={data.trigger_points?.patient?.includes('appointment_creation') || false}
                                                    onCheckedChange={(checked) => {
                                                        const triggers = data.trigger_points || {};
                                                        const patientTriggers = triggers.patient || [];
                                                        setData('trigger_points', {
                                                            ...triggers,
                                                            patient: checked
                                                                ? [...patientTriggers.filter(t => t !== 'appointment_creation'), 'appointment_creation']
                                                                : patientTriggers.filter(t => t !== 'appointment_creation')
                                                        });
                                                    }}
                                                />
                                                <Label htmlFor="trigger_appointment_creation" className="text-sm font-normal cursor-pointer">
                                                    On Appointment Creation
                                                </Label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Practitioner Triggers */}
                                    {data.entity_type === 'PRACTITIONER' && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-sm font-medium">Practitioner Triggers</Label>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="trigger_practitioner_creation"
                                                    checked={data.trigger_points?.practitioner?.includes('creation') || false}
                                                    onCheckedChange={(checked) => {
                                                        setData('trigger_points', {
                                                            practitioner: checked ? ['creation'] : []
                                                        });
                                                    }}
                                                />
                                                <Label htmlFor="trigger_practitioner_creation" className="text-sm font-normal cursor-pointer">
                                                    On Practitioner Creation
                                                </Label>
                                            </div>
                                        </div>
                                    )}

                                    {/* User Triggers */}
                                    {data.entity_type === 'USER' && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-sm font-medium">User Triggers</Label>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="trigger_user_creation"
                                                    checked={data.trigger_points?.user?.includes('creation') || false}
                                                    onCheckedChange={(checked) => {
                                                        setData('trigger_points', {
                                                            user: checked ? ['creation'] : []
                                                        });
                                                    }}
                                                />
                                                <Label htmlFor="trigger_user_creation" className="text-sm font-normal cursor-pointer">
                                                    On User Creation
                                                </Label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Version Info (for new versions) */}
                            {isNewVersion && titleCheckResponse?.versions && (
                                <div className="space-y-2">
                                    <Label>Current Versions</Label>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            This consent has {titleCheckResponse.versions.length} version(s):
                                        </p>
                                        <div className="space-y-1">
                                            {titleCheckResponse.versions.map((version) => (
                                                <div key={version.id} className="flex items-center gap-2 text-sm">
                                                    <span className="font-medium">v{version.version}</span>
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        version.status === 'ACTIVE' 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {version.status}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        {new Date(version.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Consent Body */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Consent Content</CardTitle>
                            <CardDescription>
                                Write the content for this consent document. Use the rich text editor to format your content.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Label htmlFor="consent_body">Content</Label>
                                <RichTextEditor
                                    content={data.consent_body.content || ''}
                                    onChange={handleConsentBodyChange}
                                    placeholder="Write your consent content here..."
                                />
                                {errors.consent_body && (
                                    <p className="text-sm text-red-600">{errors.consent_body}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit Buttons */}
                    <div className="flex items-center justify-end gap-4">
                        <Link href={route('policies-consents.index')}>
                            <Button variant="outline" type="button">
                                Cancel
                            </Button>
                        </Link>
                        <Button 
                            type="submit" 
                            disabled={processing || !data.title.trim() || !data.consent_body.content}
                        >
                            {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isNewVersion ? 'Create New Version' : 'Create Consent'}
                        </Button>
                    </div>
                </form>
                </div>
            </div>
        </AppLayout>
    );
}

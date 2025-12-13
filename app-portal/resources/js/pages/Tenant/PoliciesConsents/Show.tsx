import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
    ArrowLeft, 
    Plus, 
    ChevronDown, 
    ChevronRight, 
    Eye, 
    Calendar,
    Shield,
    Users,
    UserCheck,
    FileText,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConsentVersion {
    id: number;
    version: number;
    status: string;
    consent_body: Record<string, any>;
    created_at: string;
    updated_at: string;
}

interface Consent {
    id: number;
    title: string;
    key: string;
    entity_type: string;
    is_required: boolean;
    trigger_points: Record<string, string[]> | null;
    created_at: string;
    updated_at: string;
    versions: ConsentVersion[];
}

interface Props {
    consent: Consent;
}

export default function Show({ consent }: Props) {
    const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

    const toggleVersionExpansion = (versionId: number) => {
        const newExpanded = new Set(expandedVersions);
        if (newExpanded.has(versionId)) {
            newExpanded.delete(versionId);
        } else {
            newExpanded.add(versionId);
        }
        setExpandedVersions(newExpanded);
    };

    const handleVersionToggle = async (versionId: number, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        
        try {
            await router.post(route('policies-consents.versions.toggle', versionId), {
                status: newStatus
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    // The page will be refreshed with updated data
                },
                onError: (errors) => {
                    console.error('Failed to toggle version status:', errors);
                    // Show error message to user
                    alert(errors.message || 'Failed to toggle version status. Please try again.');
                }
            });
        } catch (error) {
            console.error('Failed to toggle version status:', error);
            alert('An error occurred while toggling version status. Please try again.');
        }
    };

    const getEntityTypeIcon = (entityType: string) => {
        switch (entityType) {
            case 'PRACTITIONER':
                return <Shield className="h-5 w-5 text-blue-600" />;
            case 'PATIENT':
                return <Users className="h-5 w-5 text-green-600" />;
            case 'USER':
                return <UserCheck className="h-5 w-5 text-purple-600" />;
            default:
                return <FileText className="h-5 w-5 text-gray-600" />;
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTriggerPoint = (trigger: string) => {
        switch (trigger) {
            case 'creation':
                return 'Creation';
            case 'appointment_creation':
                return 'Appointment Creation';
            default:
                return trigger.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
    };

    const getTriggerPoints = () => {
        if (!consent.trigger_points) return null;

        const entityType = consent.entity_type.toLowerCase();
        const triggers = consent.trigger_points[entityType];

        if (!triggers || triggers.length === 0) return null;

        return triggers.map(trigger => formatTriggerPoint(trigger)).join(', ');
    };

    const renderConsentBody = (body: Record<string, any>) => {
        return (
            <div className="space-y-4">
                {body.heading && (
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {body.heading}
                    </h3>
                )}
                {body.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {body.description}
                    </p>
                )}
                {body.content && (
                    <div 
                        className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
                        dangerouslySetInnerHTML={{ __html: body.content }}
                    />
                )}
                {body.checkbox_text && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Checkbox Text:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {body.checkbox_text}
                        </p>
                    </div>
                )}
                {body.important_notice && (
                    <Alert>
                        <AlertDescription className="text-sm">
                            <strong>Important Notice:</strong> {body.important_notice}
                        </AlertDescription>
                    </Alert>
                )}
                {body.legal_principle && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            Legal Principle:
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                            {body.legal_principle}
                        </p>
                    </div>
                )}
                {body.security_notice && (
                    <Alert variant="warning">
                        <AlertDescription className="text-sm">
                            <strong>Security Notice:</strong> {body.security_notice}
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        );
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: route('dashboard') },
                { title: 'Policies & Consents', href: route('policies-consents.index') },
                { title: consent.title, href: route('policies-consents.show', consent.id) },
            ]}
        >
            <Head title={`${consent.title} - Policies & Consents`} />

            <div className="p-6 md:p-6 page-content-mobile">
                <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('policies-consents.index')}>
                            <Button variant="outline" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Consents
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                {consent.title}
                            </h1>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2">
                                    {getEntityTypeIcon(consent.entity_type)}
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {getEntityTypeLabel(consent.entity_type)}
                                    </span>
                                </div>
                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                    {consent.key}
                                </code>
                            </div>
                        </div>
                    </div>
                    <Link href={route('policies-consents.create', { 
                        existing_consent_id: consent.id 
                    })}>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Version
                        </Button>
                    </Link>
                </div>

                {/* Consent Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Consent Information</CardTitle>
                        <CardDescription>
                            Basic information about this consent document
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Title
                                </label>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">
                                    {consent.title}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Key
                                </label>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">
                                    <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                        {consent.key}
                                    </code>
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Entity Type
                                </label>
                                <div className="flex items-center gap-2 mt-1">
                                    {getEntityTypeIcon(consent.entity_type)}
                                    <span className="text-sm text-gray-900 dark:text-white">
                                        {getEntityTypeLabel(consent.entity_type)}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Total Versions
                                </label>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">
                                    {consent.versions.length}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Required
                                </label>
                                <p className="text-sm text-gray-900 dark:text-white mt-1">
                                    {consent.is_required ? (
                                        <Badge className="bg-red-100 text-red-800">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Required
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">
                                            Optional
                                        </Badge>
                                    )}
                                </p>
                            </div>
                            {getTriggerPoints() && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Trigger Points
                                    </label>
                                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                                        {getTriggerPoints()}
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Versions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Versions</CardTitle>
                        <CardDescription>
                            Manage different versions of this consent document
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {consent.versions.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    No versions found
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Create the first version of this consent document.
                                </p>
                                <Link href={route('policies-consents.create', { 
                                    existing_consent_id: consent.id 
                                })}>
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create First Version
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {consent.versions.map((version) => (
                                    <Card key={version.id} className="border-l-4 border-l-blue-500">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline">
                                                            v{version.version}
                                                        </Badge>
                                                        {version.status === 'ACTIVE' ? (
                                                            <Badge className="bg-green-100 text-green-800">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Active
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline">
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                        <Calendar className="h-4 w-4" />
                                                        {formatDate(version.created_at)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                            Active:
                                                        </span>
                                                        <Switch
                                                            checked={version.status === 'ACTIVE'}
                                                            onCheckedChange={() => handleVersionToggle(version.id, version.status)}
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleVersionExpansion(version.id)}
                                                    >
                                                        {expandedVersions.has(version.id) ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <Collapsible 
                                            open={expandedVersions.has(version.id)}
                                            onOpenChange={() => toggleVersionExpansion(version.id)}
                                        >
                                            <CollapsibleContent>
                                                <CardContent className="pt-0">
                                                    {renderConsentBody(version.consent_body)}
                                                </CardContent>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                </div>
            </div>
        </AppLayout>
    );
}

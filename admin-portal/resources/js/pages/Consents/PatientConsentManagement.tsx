import { Head, router, useForm } from '@inertiajs/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { CheckCircle, XCircle, AlertCircle, Calendar, FileText, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Consent {
    id: number;
    key: string;
    title: string;
    version_id: number;
    version: number;
    is_required: boolean;
    body: {
        heading?: string;
        description?: string;
        content?: string;
        checkbox_text?: string;
        important_notice?: string;
    };
    accepted_at?: string;
}

interface Props {
    patient: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    pendingConsents: Consent[];
    acceptedConsents: Consent[];
    flash?: {
        success?: string;
        error?: string;
    };
}

export default function PatientConsentManagement({ patient, pendingConsents, acceptedConsents, flash }: Props) {
    const [acceptedAll, setAcceptedAll] = useState(false);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const handleAcceptAll = () => {
        if (!acceptedAll) {
            toast.error('Please check the box to confirm you have read and accept all consents.');
            return;
        }

        const consentVersionIds = pendingConsents.map((consent) => consent.version_id);

        router.post(
            route('patient.consents.accept-all'),
            {
                patient_id: patient.id,
                consent_version_ids: consentVersionIds,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Consents accepted successfully.');
                    setAcceptedAll(false);
                },
                onError: (errors) => {
                    toast.error('Failed to accept consents. Please try again.');
                    console.error('Error:', errors);
                },
            }
        );
    };

    const handleRevoke = (versionId: number) => {
        if (!confirm('Are you sure you want to revoke this consent? This action cannot be undone.')) {
            return;
        }

        router.post(
            route('patient.consents.revoke', { consentVersion: versionId }),
            {
                patient_id: patient.id,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Consent revoked successfully.');
                },
                onError: () => {
                    toast.error('Failed to revoke consent. Please try again.');
                },
            }
        );
    };

    const breadcrumbs = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Consents', href: '' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Consent Management" />

            <div className="mx-auto max-w-6xl p-4 sm:p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">Consent Management</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Review and manage your consent preferences for this clinic.
                    </p>
                </div>

                <Alert className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Your Privacy Matters:</strong> You have the right to accept or revoke any consent at any time. Changes to your consent preferences may affect access to certain services.
                    </AlertDescription>
                </Alert>

                <div className="space-y-6">
                    {/* Pending Consents */}
                    {pendingConsents.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-orange-600" />
                                    Pending Consents ({pendingConsents.length})
                                </CardTitle>
                                <CardDescription>
                                    Please review and accept the following consents to access certain features.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {pendingConsents.map((consent) => (
                                    <Card
                                        key={consent.version_id}
                                        className="border-l-4 border-l-orange-500"
                                    >
                                        <CardContent className="pt-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-base font-semibold">
                                                        {consent.title}
                                                    </Label>
                                                    {consent.is_required && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Required
                                                        </Badge>
                                                    )}
                                                </div>
                                                {consent.body.description && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {consent.body.description}
                                                    </p>
                                                )}
                                                {consent.body.content && (
                                                    <div
                                                        className="text-sm text-muted-foreground mt-2 p-3 bg-muted rounded"
                                                        dangerouslySetInnerHTML={{ __html: consent.body.content }}
                                                    />
                                                )}
                                                {consent.body.checkbox_text && (
                                                    <p className="text-sm font-medium mt-2">
                                                        {consent.body.checkbox_text}
                                                    </p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                <div className="pt-4 border-t space-y-4">
                                    {/* Single Accept All Checkbox */}
                                    <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <Checkbox
                                            id="accept-all-patient"
                                            checked={acceptedAll}
                                            onCheckedChange={(checked) => setAcceptedAll(checked as boolean)}
                                        />
                                        <div className="flex-1">
                                            <Label
                                                htmlFor="accept-all-patient"
                                                className="text-sm font-semibold cursor-pointer text-blue-900 dark:text-blue-100"
                                            >
                                                I have read and accept all {pendingConsents.length} consent{pendingConsents.length !== 1 ? 's' : ''}
                                            </Label>
                                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                                By checking this box, you confirm that you have read and agree to all {pendingConsents.length} consent form{pendingConsents.length !== 1 ? 's' : ''} listed above.
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleAcceptAll}
                                        disabled={!acceptedAll}
                                        className="w-full"
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Accept All & Continue
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Accepted Consents */}
                    {acceptedConsents.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                    Accepted Consents ({acceptedConsents.length})
                                </CardTitle>
                                <CardDescription>
                                    You have accepted the following consents. You may revoke them at any time.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {acceptedConsents.map((consent) => (
                                    <Card
                                        key={consent.version_id}
                                        className="border-l-4 border-l-green-500"
                                    >
                                        <CardContent className="pt-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Label className="text-base font-semibold">
                                                                {consent.title}
                                                            </Label>
                                                            {consent.is_required && (
                                                                <Badge variant="destructive" className="text-xs">
                                                                    Required
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                <CheckCircle className="mr-1 h-3 w-3" />
                                                                Accepted
                                                            </Badge>
                                                            {consent.accepted_at && (
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {new Date(consent.accepted_at).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {consent.body.description && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {consent.body.description}
                                                        </p>
                                                    )}
                                                    {consent.body.content && (
                                                        <div
                                                            className="text-sm text-muted-foreground mt-2 p-3 bg-muted rounded"
                                                            dangerouslySetInnerHTML={{ __html: consent.body.content }}
                                                        />
                                                    )}
                                                    {!consent.is_required && (
                                                        <div className="flex gap-2 mt-3">
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleRevoke(consent.version_id)}
                                                            >
                                                                <XCircle className="mr-2 h-4 w-4" />
                                                                Revoke Consent
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* No Consents State */}
                    {pendingConsents.length === 0 && acceptedConsents.length === 0 && (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                                <p className="text-sm text-muted-foreground text-center">
                                    No consents available at this time.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}


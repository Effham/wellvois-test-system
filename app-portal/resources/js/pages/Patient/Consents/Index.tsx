import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { withAppLayout } from '@/utils/layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

interface Consent {
    id: number;
    key: string;
    title: string;
    activeVersion: {
        id: number;
        consent_body: {
            heading?: string;
            description?: string;
            content?: string;
            important_notice?: string;
            checkbox_text?: string;
        };
    };
}

interface Props {
    patient: {
        id: number;
        first_name: string;
        last_name: string;
        preferred_name?: string;
    };
    pendingConsents: Consent[];
}

function PatientConsentsPage({ patient, pendingConsents }: Props) {
    const [acceptedConsentIds, setAcceptedConsentIds] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    
    console.log('Component rendered with:', {
        pendingConsentsCount: pendingConsents.length,
        pendingConsents: pendingConsents,
        patient
    });
    
    const handleConsentToggle = (versionId: number) => {
        setAcceptedConsentIds(prev => {
            const newIds = prev.includes(versionId)
                ? prev.filter(id => id !== versionId)
                : [...prev, versionId];
            console.log('handleConsentToggle:', { versionId, prev, newIds });
            return newIds;
        });
    };
    
    const validConsents = pendingConsents.filter(consent => consent.activeVersion);
    const allConsentsAccepted = validConsents.length > 0 && validConsents.every(consent => 
        acceptedConsentIds.includes(consent.activeVersion!.id)
    );
    
    console.log('Consent Page Debug:', {
        validConsentsCount: validConsents.length,
        acceptedConsentIdsLength: acceptedConsentIds.length,
        allConsentsAccepted,
        acceptedConsentIds,
        validConsentIds: validConsents.map(c => c.activeVersion!.id),
        buttonDisabled: !allConsentsAccepted || isSubmitting || validConsents.length === 0
    });
    
    const handleAccept = async () => {
        console.log('handleAccept called', { allConsentsAccepted, acceptedConsentIdsLength: acceptedConsentIds.length, validConsentsLength: validConsents.length });
        
        if (!allConsentsAccepted) {
            setError('Please accept all required consents to continue.');
            return;
        }
        
        if (acceptedConsentIds.length !== validConsents.length) {
            setError(`Please select all ${validConsents.length} consents.`);
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            const response = await axios.post('/patient/consents/accept', {
                consent_version_ids: acceptedConsentIds
            });
            
            if (response.data.success) {
                setSuccess(true);
                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    router.visit(route('central.patient-dashboard'));
                }, 2000);
            } else {
                setError(response.data.message || 'Failed to accept consents. Please try again.');
            }
        } catch (error: any) {
            console.error('Error accepting consents:', error);
            setError(error.response?.data?.message || 'An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <>
            <Head title="Required Consents" />

            <div className="py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Card className="w-full">
                <CardHeader className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Shield className="h-8 w-8 text-blue-600" />
                        <CardTitle className="text-3xl font-bold">Required Consents</CardTitle>
                    </div>
                    <CardDescription className="text-lg">
                        Hello {patient.preferred_name ?? patient.first_name},
                    </CardDescription>
                    <CardDescription>
                        Before you can access your patient dashboard, please review and accept the following consents.
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                    {success && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Success!</AlertTitle>
                            <AlertDescription className="text-green-700">
                                All consents have been accepted successfully. Redirecting to your dashboard...
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    
                    <div className="space-y-4">
                        {pendingConsents.filter(consent => consent.activeVersion).map((consent) => {
                            if (!consent.activeVersion) return null;
                            
                            const isAccepted = acceptedConsentIds.includes(consent.activeVersion.id);
                            const consentBody = consent.activeVersion.consent_body;
                            
                            return (
                                <div 
                                    key={consent.id} 
                                    className="border-2 rounded-lg p-4 transition-colors"
                                    style={{
                                        borderColor: isAccepted ? '#10b981' : '#e5e7eb',
                                        backgroundColor: isAccepted ? '#f0fdf4' : 'white'
                                    }}
                                >
                                    <div className="flex items-start space-x-3">
                                        <Checkbox
                                            id={`consent_${consent.activeVersion.id}`}
                                            checked={isAccepted}
                                            onCheckedChange={(checked) => {
                                                console.log('Checkbox clicked:', { checked, versionId: consent.activeVersion.id });
                                                handleConsentToggle(consent.activeVersion.id);
                                            }}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <Label 
                                                    htmlFor={`consent_${consent.activeVersion.id}`}
                                                    className="text-base font-semibold text-gray-900 cursor-pointer"
                                                >
                                                    {consent.title}
                                                </Label>
                                                {consentBody.description && (
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {consentBody.description}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            {consentBody.content && (
                                                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                                                    <p className="whitespace-pre-wrap">{consentBody.content}</p>
                                                </div>
                                            )}
                                            
                                            {consentBody.important_notice && (
                                                <Alert variant="warning">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertTitle>Important</AlertTitle>
                                                    <AlertDescription>
                                                        {consentBody.important_notice}
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    {validConsents.length === 0 && (
                        <Alert>
                            <AlertTitle>No Consents Required</AlertTitle>
                            <AlertDescription>You can proceed to your dashboard.</AlertDescription>
                        </Alert>
                    )}
                    
                    <div className="flex justify-end space-x-2 pt-4 border-t">
                        {validConsents.length > 0 ? (
                            <Button 
                                onClick={handleAccept} 
                                disabled={!allConsentsAccepted || isSubmitting || validConsents.length === 0}
                                size="lg"
                            >
                                {isSubmitting ? 'Processing...' : 'Accept All Consents & Continue'}
                            </Button>
                        ) : (
                            <Button 
                                onClick={() => router.visit(route('central.patient-dashboard'))} 
                                size="lg"
                            >
                                Continue to Dashboard
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
                </div>
            </div>
        </>
    );
}

export default withAppLayout(PatientConsentsPage, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Patients', href: route('patients.index') },
        { title: 'Required Consents' }
    ]
});


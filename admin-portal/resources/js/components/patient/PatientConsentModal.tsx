import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { route } from 'ziggy-js';
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

interface PatientConsentModalProps {
    open: boolean;
    onAccept: () => void;
    patientId: number;
    pendingConsents: Consent[];
    acceptedConsents: Consent[];
}

export default function PatientConsentModal({ 
    open, 
    onAccept,
    patientId,
    pendingConsents,
    acceptedConsents
}: PatientConsentModalProps) {
    const [acceptedConsentIds, setAcceptedConsentIds] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleConsentToggle = (versionId: number) => {
        setAcceptedConsentIds(prev => 
            prev.includes(versionId)
                ? prev.filter(id => id !== versionId)
                : [...prev, versionId]
        );
    };
    
    const allConsentsAccepted = pendingConsents.every(consent => 
        acceptedConsentIds.includes(consent.activeVersion.id)
    );
    
    const handleAccept = async () => {
        if (allConsentsAccepted && acceptedConsentIds.length === pendingConsents.length) {
            setIsSubmitting(true);
            setError(null);
            
            try {
                const response = await axios.post(route('consents.accept'), {
                    patient_id: patientId,
                    consent_version_ids: acceptedConsentIds
                });
                
                if (response.data.success) {
                    onAccept();
                } else {
                    setError(response.data.message || 'Failed to accept consents. Please try again.');
                }
            } catch (error: any) {
                console.error('Error accepting consents:', error);
                setError(error.response?.data?.message || 'An error occurred. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={() => { /* Prevent closing */ }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-blue-600" />
                        Required Consents for Treatment
                    </DialogTitle>
                    <DialogDescription>
                        Please review and accept the following consents to continue
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    
                    {/* Required Consents */}
                    {pendingConsents.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Required Consents ({pendingConsents.length})
                            </h3>
                            
                            {pendingConsents.map((consent) => {
                                const isAccepted = acceptedConsentIds.includes(consent.activeVersion.id);
                                const consentBody = consent.activeVersion.consent_body;
                                
                                return (
                                    <div 
                                        key={consent.id} 
                                        className="border-2 rounded-lg p-4 transition-colors"
                                        style={{
                                            borderColor: isAccepted ? '#10b981' : '#e5e7eb',
                                            backgroundColor: isAccepted ? '#f0fdf4' : 'transparent'
                                        }}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <Checkbox
                                                id={`consent_${consent.activeVersion.id}`}
                                                checked={isAccepted}
                                                onCheckedChange={() => handleConsentToggle(consent.activeVersion.id)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 space-y-3">
                                                <div>
                                                    <Label 
                                                        htmlFor={`consent_${consent.activeVersion.id}`}
                                                        className="text-base font-semibold text-gray-900 dark:text-gray-100 cursor-pointer"
                                                    >
                                                        {consent.title}
                                                    </Label>
                                                    {consentBody.description && (
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            {consentBody.description}
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                {consentBody.content && (
                                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
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
                    )}
                    
                    {/* Previously Accepted Consents */}
                    {acceptedConsents.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Already Accepted ({acceptedConsents.length})
                            </h3>
                            
                            {acceptedConsents.map((consent) => (
                                <div 
                                    key={consent.id}
                                    className="border-2 border-green-400 bg-green-50 dark:bg-green-950/20 rounded-lg p-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                                            {consent.title}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {pendingConsents.length === 0 && (
                        <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>All Consents Accepted</AlertTitle>
                            <AlertDescription>
                                You have already accepted all required consents.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                
                <div className="flex justify-end space-x-2 pt-4 border-t">
                    {pendingConsents.length > 0 && (
                        <Button 
                            onClick={handleAccept} 
                            disabled={!allConsentsAccepted || isSubmitting}
                            size="lg"
                        >
                            {isSubmitting ? 'Processing...' : 'Accept All Consents & Continue'}
                        </Button>
                    )}
                    {pendingConsents.length === 0 && (
                        <Button onClick={onAccept}>
                            Continue to Dashboard
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

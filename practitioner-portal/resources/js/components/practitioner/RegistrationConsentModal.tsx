import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, AlertTriangle } from 'lucide-react';

interface RegistrationConsentModalProps {
    open: boolean;
    onAccept: () => void;
    onCancel: () => void;
    practitionerName: string;
    tenantName: string;
}

export default function RegistrationConsentModal({ 
    open, 
    onAccept, 
    onCancel, 
    practitionerName,
    tenantName 
}: RegistrationConsentModalProps) {
    const [consentAccepted, setConsentAccepted] = useState(false);

    const handleAccept = () => {
        if (consentAccepted) {
            onAccept();
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => { /* Prevent closing without action */ }}>
            <DialogContent className="sm:max-w-[600px] p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
                        <Shield className="h-6 w-6 text-blue-600" /> Administrative Access Consent
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
                        Required for {tenantName} EMR Platform Access
                    </DialogDescription>
                </DialogHeader>
                
                <div className="mt-4 space-y-4 text-sm text-gray-700 dark:text-gray-300">
                    {/* Practitioner Info */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <p><strong>Practitioner:</strong> {practitionerName}</p>
                        <p><strong>Organization:</strong> {tenantName}</p>
                    </div>

                    {/* Important Notice */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-blue-900 dark:text-blue-100">Important Notice</h4>
                                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                                    This consent is legally binding and required for your access to the Wellovis EMR platform. 
                                    Please read carefully and ensure you understand all obligations before accepting.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Consent Content */}
                    <div className="space-y-3">
                        <p>
                            By checking this box, I acknowledge and agree that authorized administrative staff of Wellovis may view and manage my availability, locations, and appointment metadata (date, time, service) for the exclusive purposes of platform maintenance, technical support, and operational management. This access adheres to the legal principle of "Minimum Necessary" use of health information and is required for my use of the Wellovis EMR platform.
                        </p>
                    </div>

                    {/* Consent Checkbox */}
                    <div className="flex items-start space-x-3 mt-4">
                        <Checkbox
                            id="registration_consent"
                            checked={consentAccepted}
                            onCheckedChange={(checked) => setConsentAccepted(checked as boolean)}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <Label htmlFor="registration_consent" className="text-sm font-medium">
                                I consent to the limited, necessary administrative access to my professional profile and data by Wellovis personnel.
                            </Label>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleAccept} disabled={!consentAccepted}>
                        Agree and Continue
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

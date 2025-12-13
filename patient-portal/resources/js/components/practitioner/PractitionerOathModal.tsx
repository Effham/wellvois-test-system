import React, { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PractitionerOathModalProps {
    open: boolean;
    onAccept: () => void;
    onCancel: () => void;
}

export default function PractitionerOathModal({ 
    open, 
    onAccept, 
    onCancel 
}: PractitionerOathModalProps) {
    const [oathAccepted, setOathAccepted] = useState(false);
    
    const handleAccept = () => {
        if (oathAccepted) {
            onAccept();
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onCancel}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-blue-600" />
                        Practitioner's Oath of Confidentiality
                    </DialogTitle>
                    <DialogDescription>
                        Required for access to the tenant dashboard
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    {/* Important Notice */}
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Important Notice</AlertTitle>
                        <AlertDescription>
                            As a healthcare practitioner, you will have access to sensitive patient information. 
                            This oath is legally binding and required for your access to the Wellovis EMR platform.
                        </AlertDescription>
                    </Alert>
                    
                    {/* Oath Content */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            <p>
                                I confirm that I understand my role as a Health Information Custodian (HIC) or Agent thereof, 
                                and I commit to maintaining the strictest privacy and security of all patient data (PHI). 
                                I will use and disclose patient information only for the purpose of treatment, payment, 
                                or as explicitly permitted by applicable Canadian privacy laws (e.g., PIPEDA, PHIPA). 
                                I agree to implement all necessary safeguards and immediately report any known or suspected privacy breach.
                            </p>
                        </div>
                    </div>
                    
                    {/* Consent Checkbox */}
                    <div className="flex items-start space-x-3">
                        <Checkbox
                            id="practitioner_oath"
                            checked={oathAccepted}
                            onCheckedChange={(checked) => setOathAccepted(checked as boolean)}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <Label htmlFor="practitioner_oath" className="text-sm font-medium">
                                I agree to uphold the Wellovis Practitioner's Oath of Confidentiality.
                            </Label>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleAccept} disabled={!oathAccepted}>
                        Accept & Continue
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

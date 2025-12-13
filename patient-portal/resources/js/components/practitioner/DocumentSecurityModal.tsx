import React, { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { route } from 'ziggy-js';
import { usePage } from '@inertiajs/react';

interface DocumentSecurityModalProps {
    open: boolean;
    onAccept: () => void;
    onCancel: () => void;
    patientName?: string;
    documentName?: string;
}

export default function DocumentSecurityModal({ 
    open, 
    onAccept, 
    onCancel,
    patientName,
    documentName 
}: DocumentSecurityModalProps) {
    const [securityAccepted, setSecurityAccepted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const pageProps = usePage().props;
    const practitionerId = pageProps.auth?.user?.practitioner_id;
    
    const handleAccept = async () => {
        if (securityAccepted) {
            setIsSubmitting(true);
            
            try {
                const response = await fetch(route('policies-consents.document-upload.accept'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({}),
                });
                
                const result = await response.json();
                
                if (result.success) {
                    onAccept();
                } else {
                    console.error('Failed to accept document upload consent:', result.message);
                    // Still call onAccept to proceed with upload
                    onAccept();
                }
            } catch (error) {
                console.error('Error accepting document upload consent:', error);
                // Still call onAccept to proceed with upload
                onAccept();
            } finally {
                setIsSubmitting(false);
            }
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={() => { /* Prevent closing without action */ }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-blue-600" />
                        Document Security Consent
                    </DialogTitle>
                    <DialogDescription>
                        Required before uploading documents
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    {patientName && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Patient:</strong> {patientName}
                            </p>
                        </div>
                    )}
                    
                    {documentName && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                <strong>Document:</strong> {documentName}
                            </p>
                        </div>
                    )}
                    
                    {/* Security Warning */}
                    <Alert variant="warning">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Security Notice</AlertTitle>
                        <AlertDescription>
                            This document will be accessible to the patient and may be downloaded to their personal device.
                        </AlertDescription>
                    </Alert>
                    
                    {/* Consent Content */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            <p>
                                I acknowledge that when I download my Personal Health Information (PHI) from the secure Wellovis EMR to my personal device, 
                                the security and privacy of those files become my sole responsibility. I understand that Wellovis and my Practitioner cannot 
                                control or protect the downloaded files and will not be liable for any unauthorized access that occurs once the files have 
                                left the secure platform.
                            </p>
                        </div>
                    </div>
                    
                    {/* Consent Checkbox */}
                    <div className="flex items-start space-x-3">
                        <Checkbox
                            id="document_security"
                            checked={securityAccepted}
                            onCheckedChange={(checked) => setSecurityAccepted(checked as boolean)}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <Label htmlFor="document_security" className="text-sm font-medium">
                                I confirm I understand the security risks of downloading my health documents from Wellovis.
                            </Label>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleAccept} disabled={!securityAccepted || isSubmitting}>
                        {isSubmitting ? 'Processing...' : 'Confirm & Upload'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

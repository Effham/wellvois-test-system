import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PendingConsent {
    id: number;
    key: string;
    title: string;
    activeVersion: {
        id: number;
        version: number;
        status: string;
        consent_body: {
            heading: string;
            description?: string;
            content?: string;
            important_notice?: string;
        };
    };
}

interface Props {
    open: boolean;
    patientId: number | null;
    pendingConsents: PendingConsent[];
    onSuccess: () => void;
}

export default function PublicPortalConsentModal({ open, patientId, pendingConsents, onSuccess }: Props) {
    console.log('PublicPortalConsentModal rendered:', { open, patientId, pendingConsentsCount: pendingConsents?.length });
    
    const [acceptAll, setAcceptAll] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAccept = async () => {
        if (!acceptAll) {
            return;
        }

        if (!patientId) {
            setError('Patient ID is missing. Please refresh and try again.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // Get all consent version IDs
            const consentVersionIds = pendingConsents.map(consent => consent.activeVersion.id);

            const response = await fetch('/consents/accept-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    patient_id: patientId,
                    consent_version_ids: consentVersionIds,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Consents accepted successfully!', {
                    description: 'Redirecting to your dashboard...',
                });
                onSuccess();
            } else {
                setError(data.message || 'Failed to accept consents. Please try again.');
            }
        } catch (err) {
            console.error('Error accepting consents:', err);
            setError('An error occurred while accepting consents. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => {}}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        Review and Accept Consents
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {pendingConsents.length === 0 ? (
                        <p className="text-gray-600 text-center py-8">
                            No pending consents to accept.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600 mb-4">
                                Please review the following required consents before proceeding to your dashboard.
                            </p>

                            {pendingConsents.map((consent) => (
                                <div
                                    key={consent.id}
                                    className="border border-gray-200 rounded-lg p-4 space-y-2"
                                >
                                    <h3 className="font-semibold text-gray-900 text-lg">
                                        {consent.title}
                                    </h3>
                                    {consent.activeVersion.consent_body.description && (
                                        <p className="text-sm text-gray-600">
                                            {consent.activeVersion.consent_body.description}
                                        </p>
                                    )}
                                    {consent.activeVersion.consent_body.content && (
                                        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                                            {consent.activeVersion.consent_body.content}
                                        </div>
                                    )}
                                    {consent.activeVersion.consent_body.important_notice && (
                                        <p className="text-sm text-amber-700 font-medium">
                                            ⚠️ {consent.activeVersion.consent_body.important_notice}
                                        </p>
                                    )}
                                </div>
                            ))}

                            {/* Single checkbox at bottom */}
                            <div className="mt-6 pt-4 border-t-2 border-gray-200">
                                <div className="flex items-start space-x-3">
                                    <Checkbox
                                        id="acceptAll"
                                        checked={acceptAll}
                                        onCheckedChange={(checked) => setAcceptAll(checked as boolean)}
                                        disabled={isSubmitting}
                                        className="mt-1"
                                    />
                                    <Label
                                        htmlFor="acceptAll"
                                        className="text-base font-semibold text-gray-900 cursor-pointer"
                                    >
                                        I have read and accept all required consents listed above
                                    </Label>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="mt-6">
                    <Button
                        onClick={handleAccept}
                        disabled={!acceptAll || isSubmitting || pendingConsents.length === 0}
                        className="w-full"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving Consents...
                            </>
                        ) : (
                            'Accept and Continue to Dashboard'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


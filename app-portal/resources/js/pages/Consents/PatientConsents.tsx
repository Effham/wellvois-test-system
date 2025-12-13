import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import ConsentCard from '@/components/patient/ConsentCard';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/general/PageHeader';

interface PendingConsent {
    id: number;
    key: string;
    title: string;
    version: number;
    body: {
        heading: string;
        description?: string;
        content: string;
        checkbox_text: string;
        important_notice?: string;
    };
}

interface PatientConsentsProps {
    patient: {
        id: number;
        first_name: string;
        last_name: string;
    };
    pendingConsents: PendingConsent[];
}

export default function PatientConsents({ patient, pendingConsents }: PatientConsentsProps) {
    const [checkedConsents, setCheckedConsents] = useState<Set<number>>(new Set());
    const [processing, setProcessing] = useState(false);

    const handleConsentChange = (consentId: number, checked: boolean) => {
        setCheckedConsents((prev) => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(consentId);
            } else {
                newSet.delete(consentId);
            }
            return newSet;
        });
    };

    const handleSubmit = () => {
        if (checkedConsents.size !== pendingConsents.length) {
            return;
        }

        setProcessing(true);

        const consentVersionIds = pendingConsents
            .filter((c) => checkedConsents.has(c.id))
            .map((c) => c.id);

        router.post(
            route('patient.consents.accept-all'),
            {
                patient_id: patient.id,
                consent_version_ids: consentVersionIds,
            },
            {
                onSuccess: () => {
                    router.visit(route('dashboard'));
                },
                onFinish: () => {
                    setProcessing(false);
                },
            }
        );
    };

    const allChecked = checkedConsents.size === pendingConsents.length && pendingConsents.length > 0;

    return (
        <AppLayout>
            <Head title="Required Consents" />

            <PageHeader
                title="Required Consents"
                description="Please review and accept all required consents to access your patient portal"
            />

            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                        <strong>Important:</strong> These consents are required by law (HIPAA and privacy
                        regulations) to ensure you understand how your health information is used and protected.
                        Please review each consent carefully before accepting.
                    </p>
                </div>

                <div className="space-y-4">
                    {pendingConsents.map((consent) => (
                        <ConsentCard
                            key={consent.id}
                            consent={consent}
                            isChecked={checkedConsents.has(consent.id)}
                            onCheckedChange={(checked) => handleConsentChange(consent.id, checked)}
                        />
                    ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-gray-600">
                        {checkedConsents.size} of {pendingConsents.length} consents accepted
                    </div>
                    <Button
                        onClick={handleSubmit}
                        disabled={!allChecked || processing}
                        size="lg"
                        className="min-w-[200px]"
                    >
                        {processing ? 'Processing...' : 'Accept All & Continue to Dashboard'}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}



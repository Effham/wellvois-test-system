import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusPageProps {
    tenantId?: string;
    registrationUuid?: string;
}

export default function TenantCreationStatus({ tenantId, registrationUuid }: StatusPageProps) {
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (isComplete) {
            return;
        }

        const pollStatus = async () => {
            try {
                const params = new URLSearchParams();
                if (tenantId) {
                    params.append('tenant_id', tenantId);
                }
                if (registrationUuid) {
                    params.append('registration_uuid', registrationUuid);
                }

                const response = await fetch(`/api/tenant-creation-status?${params.toString()}`, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to check status');
                }

                const data = await response.json();

                if (data.is_complete) {
                    setIsComplete(true);
                    setShowSuccess(true);
                    // Wait 1.5 seconds before redirecting
                    setTimeout(() => {
                        router.visit('/onboarding');
                    }, 1500);
                } else if (data.error) {
                    setError(data.error);
                }
            } catch (err) {
                console.error('Error polling status:', err);
                setError('Failed to check tenant creation status. Please refresh the page.');
            }
        };

        // Poll immediately, then every 2.5 seconds
        pollStatus();
        const interval = setInterval(pollStatus, 2500);

        return () => clearInterval(interval);
    }, [tenantId, registrationUuid, isComplete]);

    return (
        <>
            <Head title="Creating Your Workspace" />
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
                <div className="max-w-md w-full">
                    <div className="bg-white rounded-lg shadow-xl p-8 text-center">
                        {error ? (
                            <>
                                <div className="flex justify-center mb-6">
                                    <AlertCircle className="w-16 h-16 text-red-500" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                    Error
                                </h1>
                                <p className="text-gray-600 mb-6">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    Retry
                                </button>
                            </>
                        ) : showSuccess ? (
                            <>
                                <div className="flex justify-center mb-6">
                                    <CheckCircle2 className="w-16 h-16 text-green-500 animate-pulse" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                    Workspace Created!
                                </h1>
                                <p className="text-gray-600 mb-6">
                                    Your workspace has been successfully created. Redirecting to onboarding...
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-center mb-6">
                                    <div className="relative">
                                        <Loader2 className="w-16 h-16 text-primary animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-8 h-8 border-4 border-primary/20 rounded-full animate-ping"></div>
                                        </div>
                                    </div>
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                    Creating Your Workspace
                                </h1>
                                <p className="text-gray-600 mb-6">
                                    Please wait while we set up your workspace. This may take a few moments...
                                </p>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }}></div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}


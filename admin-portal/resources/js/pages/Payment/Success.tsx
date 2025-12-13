import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface PaymentSuccessProps {
    sessionId: string;
    email: string;
    companyName: string;
    registrationUuid: string;
    tenantExists?: boolean;
}

export default function PaymentSuccess({ sessionId, email, companyName, registrationUuid, tenantExists = false }: PaymentSuccessProps) {
    const handleContinue = () => {
        // Redirect to tenant creation page with session ID and registration UUID
        // This page will check if tenant exists and authenticate user if ready
        router.visit(route('billing.tenant-creation', {
            session_id: sessionId,
            registration_uuid: registrationUuid
        }));
    };

    return (
        <>
            <Head title="Payment Successful" />

            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="max-w-md w-full">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                        {/* Success Icon */}
                        <div className="flex justify-center mb-6">
                            <CheckCircle className="w-16 h-16 text-green-500" />
                        </div>

                        {/* Success Message */}
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Payment Successful!
                        </h1>

                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Thank you for subscribing. Your payment has been processed successfully.
                        </p>

                        {/* Account Details */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6 text-left">
                            <div className="space-y-2">
                                <div>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        Company:
                                    </span>
                                    <p className="text-gray-900 dark:text-white font-medium">
                                        {companyName}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        Email:
                                    </span>
                                    <p className="text-gray-900 dark:text-white font-medium">
                                        {email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Continue Button */}
                        <Button
                            onClick={handleContinue}
                            className="w-full"
                            size="lg"
                        >
                            Continue to Set Up Your Account
                        </Button>

                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                            We're preparing your workspace. This will only take a moment.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

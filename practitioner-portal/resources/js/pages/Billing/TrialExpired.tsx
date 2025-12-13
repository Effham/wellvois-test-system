import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { router, usePage } from '@inertiajs/react';
import { AlertCircle, CreditCard, Calendar, Mail } from 'lucide-react';

type Plan = {
    id: number;
    name: string;
    price: string;
    formatted_price: string;
    billing_cycle: string;
};

type Tenant = {
    id: string;
    name: string;
};

type TrialExpiredProps = {
    tenant: Tenant;
    plan: Plan;
    trial_ended_at: string;
    checkoutUrl: string;
    resubscribeUrl: string;
    hasPaymentMethod: boolean;
    paymentMethodLast4?: string | null;
    planId: number;
};

export default function TrialExpired({ tenant, plan, trial_ended_at, checkoutUrl, resubscribeUrl, hasPaymentMethod, paymentMethodLast4, planId }: TrialExpiredProps) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string; warning?: string } };

    const handleSubscribe = () => {
        // If payment method exists, use resubscribe (no checkout needed)
        // Otherwise, use checkout to collect new payment method
        const url = hasPaymentMethod ? resubscribeUrl : checkoutUrl;
        router.post(url, {
            plan_id: planId,
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="mb-4 flex justify-center">
                        <div className="rounded-full bg-red-100 p-4">
                            <AlertCircle className="w-12 h-12 text-red-600" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Trial Period Ended
                    </h1>
                    <p className="text-lg text-gray-600">
                        Your free trial for <strong>{tenant?.name || 'your account'}</strong> has ended
                    </p>
                </div>

                {/* Warning Alert */}
                {flash?.warning && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-yellow-800">{flash.warning}</p>
                        </div>
                    </div>
                )}

                {/* Error Alert */}
                {flash?.error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{flash.error}</p>
                        </div>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Trial Information Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-orange-500" />
                                Trial Information
                            </CardTitle>
                            <CardDescription>Your trial period details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="text-sm text-gray-600 mb-1">Trial Ended</div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {trial_ended_at || 'N/A'}
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <h4 className="font-semibold text-gray-900 mb-2">
                                        What happens next?
                                    </h4>
                                    <ul className="space-y-2 text-sm text-gray-600">
                                        <li className="flex items-start gap-2">
                                            <span className="font-semibold text-gray-700">•</span>
                                            <span>Your trial period has ended</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="font-semibold text-gray-700">•</span>
                                            <span>Subscribe now to continue using all features</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="font-semibold text-gray-700">•</span>
                                            <span>Your data is safe and will be restored once you subscribe</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Subscription Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-blue-500" />
                                Subscription Plan
                            </CardTitle>
                            <CardDescription>Continue with your selected plan</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {plan ? (
                                <>
                                    <div className="p-4 bg-purple-50 rounded-lg">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {plan.name}
                                        </h3>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-bold text-purple-600">
                                                {plan.formatted_price}
                                            </span>
                                            <span className="text-gray-600">
                                                / {plan.billing_cycle.toLowerCase()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {hasPaymentMethod && paymentMethodLast4 && (
                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="w-5 h-5 text-green-600" />
                                                    <div className="text-sm">
                                                        <p className="font-semibold text-gray-900">
                                                            Saved Payment Method
                                                        </p>
                                                        <p className="text-gray-600">
                                                            Card ending in {paymentMethodLast4} will be used
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <Button
                                            onClick={handleSubscribe}
                                            className="w-full h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white font-semibold hover:opacity-90"
                                        >
                                            <CreditCard className="mr-2 h-5 w-5" />
                                            {hasPaymentMethod ? 'Activate Subscription' : 'Subscribe Now'}
                                        </Button>
                                        
                                        {!hasPaymentMethod && (
                                            <p className="text-xs text-center text-gray-500">
                                                You'll be redirected to secure checkout to enter payment details
                                            </p>
                                        )}

                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                                <div className="text-sm text-gray-600">
                                                    <p className="font-semibold text-gray-900 mb-1">
                                                        Email Sent
                                                    </p>
                                                    <p>
                                                        We've sent you an email with a payment link. 
                                                        You can also subscribe directly using the button above.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-4 text-center text-gray-600">
                                    <p>Unable to load subscription plan. Please contact support.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Footer Note */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>
                        Need help? Contact our support team for assistance with your subscription.
                    </p>
                </div>
            </div>
        </div>
    );
}


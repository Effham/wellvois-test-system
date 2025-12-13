import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertCircle, CreditCard, Lock, LoaderCircle, Shield } from 'lucide-react';
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import { toast } from 'sonner';

type Plan = {
    id: number;
    name: string;
    price: number;
    formatted_price: string;
    billing_cycle: string;
};

type Tenant = {
    id: string;
    company_name: string;
};

type Subscription = {
    id: number;
    stripe_id: string;
    stripe_status: string;
    ends_at: string | null;
    canceled: boolean;
};

type AccessBlockedProps = {
    tenant: Tenant;
    subscription: Subscription | null;
    plan: Plan | null;
    isAdmin: boolean;
    stripeKey: string;
};

// Stripe will be initialized with the key from props
let stripePromise: Promise<any> | null = null;

const getStripe = (publishableKey: string) => {
    if (!stripePromise) {
        stripePromise = loadStripe(publishableKey);
    }
    return stripePromise;
};

// Card Form Component for updating payment method
function PaymentMethodForm({ tenant, plan }: { tenant: Tenant; plan: Plan | null }) {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            // Step 1: Create Setup Intent
            const setupIntentResponse = await axios.post(route('billing.setup-intent.create'), {
                tenant_id: tenant.id,
                plan_id: plan?.id,
            });

            const { client_secret } = setupIntentResponse.data;

            if (!client_secret) {
                throw new Error('Failed to create setup intent');
            }

            // Step 2: Get card element
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) {
                throw new Error('Card element not found');
            }

            // Step 3: Confirm Setup Intent (verifies card without charging)
            const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(client_secret, {
                payment_method: {
                    card: cardElement,
                },
            });

            if (confirmError) {
                setError(confirmError.message || 'Card verification failed');
                setProcessing(false);
                return;
            }

            if (!setupIntent?.payment_method) {
                throw new Error('Payment method not created');
            }

            // Extract payment method ID
            const paymentMethodId = typeof setupIntent.payment_method === 'string'
                ? setupIntent.payment_method
                : setupIntent.payment_method.id || setupIntent.payment_method;

            if (!paymentMethodId) {
                throw new Error('Payment method ID not found');
            }

            // Step 4: Update payment method and charge immediately
            router.post(route('billing.update-payment-method'), {
                payment_method_id: paymentMethodId,
            }, {
                onSuccess: () => {
                    toast.success('Payment method updated and subscription reactivated!');
                },
                onError: (errors) => {
                    toast.error(errors.error || 'Failed to update payment method');
                    setProcessing(false);
                },
            });
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to update payment method. Please try again.');
            setProcessing(false);
        }
    };

    const cardElementOptions = {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
            },
            invalid: {
                color: '#9e2146',
            },
        },
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 border border-gray-300 rounded-lg bg-white">
                <CardElement options={cardElementOptions} />
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            <Button
                type="submit"
                disabled={!stripe || processing}
                className="w-full h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {processing ? (
                    <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Processing Payment...
                    </>
                ) : (
                    <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Update Card & Reactivate Subscription
                    </>
                )}
            </Button>
        </form>
    );
}

export default function AccessBlocked({ tenant, subscription, plan, isAdmin, stripeKey }: AccessBlockedProps) {
    return (
        <>
            <Head title="Access Blocked - Subscription Required" />
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
                <div className="w-full max-w-3xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <div className="rounded-full bg-red-100 p-4">
                                <Lock className="h-12 w-12 text-red-600" />
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Access Temporarily Blocked
                        </h1>
                        <p className="text-lg text-gray-600">
                            Your subscription has ended. Please update your payment information to continue accessing your EMR system.
                        </p>
                    </div>

                    {/* Alert Card */}
                    <Card className="mb-6 border-red-200 bg-red-50">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-red-900 mb-1">Subscription Status</h3>
                                    <p className="text-sm text-red-800">
                                        {subscription?.canceled
                                            ? 'Your subscription has been canceled. To restore access to your Electronic Medical Records system, please update your payment method below.'
                                            : 'Your subscription payment could not be processed. Please update your payment information to reactivate your account and regain access to all EMR features.'}
                                    </p>
                                    {subscription?.ends_at && (
                                        <p className="text-xs text-red-700 mt-2">
                                            Subscription ended on: {new Date(subscription.ends_at).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Admin Payment Update Section */}
                    {isAdmin && plan && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Plan Summary Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-blue-500" />
                                        Current Plan
                                    </CardTitle>
                                    <CardDescription>Your subscription plan details</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {plan.name}
                                        </h3>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-bold text-blue-600">
                                                {plan.formatted_price}
                                            </span>
                                            <span className="text-gray-600">
                                                / {plan.billing_cycle.toLowerCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-gray-200">
                                        <p className="text-sm text-gray-600">
                                            As an administrator, you can update the payment method and reactivate the subscription immediately.
                                            Your account will be charged for the current billing period upon successful payment.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Payment Update Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-green-500" />
                                        Update Payment Method
                                    </CardTitle>
                                    <CardDescription>Enter new card information to reactivate</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                                            Important Information
                                        </h4>
                                        <ul className="space-y-2 text-sm text-gray-600 mt-3">
                                            <li className="flex items-start gap-2">
                                                <span className="font-semibold text-yellow-600">•</span>
                                                <span>Your card will be charged <strong>{plan.formatted_price}</strong> immediately upon successful payment</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="font-semibold text-yellow-600">•</span>
                                                <span>Your subscription will be reactivated immediately</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="font-semibold text-yellow-600">•</span>
                                                <span>Full access to all EMR features will be restored</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="font-semibold text-yellow-600">•</span>
                                                <span>Your billing cycle will continue from today</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {stripeKey && (
                                        <Elements stripe={getStripe(stripeKey)}>
                                            <PaymentMethodForm tenant={tenant} plan={plan} />
                                        </Elements>
                                    )}

                                    <p className="text-xs text-center text-gray-500">
                                        Powered by <span className="font-semibold">Stripe</span> - Your payment
                                        information is secure and encrypted.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Non-Admin Message */}
                    {!isAdmin && (
                        <Card>
                            <CardContent className="p-6 text-center">
                                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Administrator Action Required
                                </h3>
                                <p className="text-gray-600">
                                    Only administrators can update payment information. Please contact your organization's administrator
                                    to restore access to the EMR system.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Footer Note */}
                    <div className="mt-6 text-center text-sm text-gray-500">
                        <p>
                            If you have any questions or need assistance, please contact our support team.
                            <br />
                            Your patient data is secure and will be available once your subscription is reactivated.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}


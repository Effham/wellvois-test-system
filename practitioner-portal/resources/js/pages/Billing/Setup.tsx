import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, usePage } from '@inertiajs/react';
import { CheckCircle2, CreditCard, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { imageAsset } from '@/utils/asset';
import axios from 'axios';

type Plan = {
    id: number;
    name: string;
    price: number;
    formatted_price: string;
    billing_cycle: string;
    description: string;
    features: string[];
};

type Tenant = {
    id: string;
    name: string;
};

type SetupProps = {
    tenant: Tenant | null;
    plan: Plan | null;
    stripeKey: string;
    trialDays?: number;
    isReturningUser?: boolean;
    error?: string;
    pendingRegistration?: boolean;
    registrationData?: {
        company_name: string;
        domain: string;
    };
};

export default function Setup({ tenant, plan, stripeKey, trialDays, isReturningUser, error, pendingRegistration, registrationData }: SetupProps) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [processing, setProcessing] = useState(false);
    
    // Get error from either prop or flash message
    const displayError = error || flash?.error;

    const handleStartCheckout = () => {
        if (!plan) {
            return;
        }

        setProcessing(true);

        // Create checkout session via backend
        // For pending registration, don't send tenant_id (backend will use session data)
        const requestData: { plan_id: number; tenant_id?: string } = {
            plan_id: plan.id,
        };

        // Only include tenant_id if tenant exists (existing flow)
        if (tenant) {
            requestData.tenant_id = tenant.id;
        }

        // Use axios directly since we need to handle JSON response and external redirect
        axios.post(route('billing.checkout-session.create'), requestData)
            .then((response) => {
                if (response.data?.checkout_url) {
                    // Redirect to Stripe checkout
                    window.location.href = response.data.checkout_url;
                } else {
                    setProcessing(false);
                    console.error('No checkout URL in response');
                }
            })
            .catch((error) => {
                setProcessing(false);
                console.error('Failed to create checkout session:', error);
                if (error.response?.data?.message) {
                    // Handle error message from backend
                    alert(error.response.data.message);
                }
            });
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Head title={isReturningUser ? 'Welcome Back - Complete Subscription' : 'Complete Your Subscription'} />

            {/* Header with Logo */}
            <div className="flex-shrink-0 flex items-center justify-center p-3 sm:p-6">
                <img
                    src={`${imageAsset('/brand/images/mainLogo.png')}`}
                    alt="Logo"
                    className="h-7 w-auto"
                />
            </div>

            {/* Main Content Container */}
            <div className="flex-1 flex flex-col rounded-2xl sm:rounded-[32px] bg-gradient-to-br from-[#faf5ff] to-[#e0e7ff] mx-5 sm:mx-8 mb-3 sm:mb-6 overflow-hidden">
                {/* Content */}
                <div className="flex-1 flex items-center justify-center p-5 sm:p-6 xl:p-8">
                    <div className="w-full max-w-6xl">
                        {/* Welcome Section */}
                        <div className="mb-6 sm:mb-8 text-center">
                            <CardTitle className="mb-2 text-2xl sm:text-3xl xl:text-4xl font-bold text-gray-900">
                                {isReturningUser ? 'Welcome Back!' : 'Complete Your Subscription'}
                            </CardTitle>
                            <CardDescription className="text-gray-600 text-sm sm:text-base">
                                {isReturningUser 
                                    ? "We noticed you didn't complete your payment. Let's finish setting up your account!"
                                    : `One last step to activate your ${tenant?.name || registrationData?.company_name || 'account'} account`
                                }
                            </CardDescription>
                        </div>

                        {/* Form Container */}
                        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm px-5 sm:px-6 xl:px-8 py-6 sm:py-8">
                            <Card className="border-0 bg-transparent shadow-none">
                                <CardContent className="p-0">
                                    <div className="flex flex-col space-y-6">
                                        {/* Error Alert */}
                                        {displayError && (
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-6 h-6 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-red-900 mb-1">Setup Error</h3>
                                                        <p className="text-sm text-red-800 whitespace-pre-wrap wrap-break-word">{displayError}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Returning User Alert */}
                                        {isReturningUser && !displayError && (
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <div>
                                                        <h3 className="font-semibold text-yellow-900 mb-1">Payment Required</h3>
                                                        <p className="text-sm text-yellow-800">
                                                            Your account is ready, but you need to complete payment to access your workspace. 
                                                            Don't worry, your data is safe and waiting for you!
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {plan ? (
                                            <div className="grid md:grid-cols-2 gap-6">
                                                {/* Plan Summary Card */}
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                            Selected Plan
                                                        </CardTitle>
                                                        <CardDescription>Your subscription details</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
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

                                                        <div>
                                                            <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                                                            <ul className="space-y-2">
                                                                {plan.features.map((feature, index) => (
                                                                    <li key={index} className="flex items-start gap-2 text-sm">
                                                                        <svg
                                                                            className="w-5 h-5 text-green-500 shrink-0 mt-0.5"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth={2}
                                                                                d="M5 13l4 4L19 7"
                                                                            />
                                                                        </svg>
                                                                        {feature}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        {/* Change Plan Button */}
                                                        <div className="pt-4 border-t border-gray-200">
                                                            {tenant && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        console.log('[DEBUG] Change Plan button clicked');
                                                                        console.log('[DEBUG] Tenant ID:', tenant.id);
                                                                        console.log('[DEBUG] Plan ID:', plan.id);
                                                                        
                                                                        const queryParams = new URLSearchParams({
                                                                            from: 'billing',
                                                                            tenant_id: tenant.id.toString(),
                                                                            plan_id: plan.id.toString(),
                                                                        });
                                                                        
                                                                        const url = `/change-plan?${queryParams.toString()}`;
                                                                        console.log('[DEBUG] Navigating to:', url);
                                                                        console.log('[DEBUG] Current location:', window.location.href);
                                                                        
                                                                        try {
                                                                            router.visit(url, {
                                                                                onStart: () => {
                                                                                    console.log('[DEBUG] Navigation started');
                                                                                },
                                                                                onProgress: () => {
                                                                                    console.log('[DEBUG] Navigation in progress');
                                                                                },
                                                                                onFinish: () => {
                                                                                    console.log('[DEBUG] Navigation finished');
                                                                                },
                                                                                onCancel: () => {
                                                                                    console.log('[DEBUG] Navigation cancelled');
                                                                                },
                                                                                onError: (errors) => {
                                                                                    console.error('[DEBUG] Navigation error:', errors);
                                                                                },
                                                                            });
                                                                        } catch (error) {
                                                                            console.error('[DEBUG] Exception during navigation:', error);
                                                                            // Fallback to window.location
                                                                            console.log('[DEBUG] Falling back to window.location.href');
                                                                            window.location.href = url;
                                                                        }
                                                                    }}
                                                                    className="w-full"
                                                                >
                                                                    Change Plan
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                {/* Payment Card */}
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <CreditCard className="w-5 h-5 text-blue-500" />
                                                            Card Verification
                                                        </CardTitle>
                                                        <CardDescription>$0 today — card verification only</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-6">
                                                        <div className="space-y-4">
                                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                                <p className="text-sm text-gray-700 mb-3">
                                                                    We'll run a quick verification to confirm your card is real. No charge will be made right now.
                                                                </p>
                                                                <p className="text-sm text-gray-700">
                                                                    Enjoy full access for {trialDays || 35} days. We'll notify you before your trial ends.
                                                                </p>
                                                            </div>

                                                            <Button
                                                                onClick={handleStartCheckout}
                                                                disabled={!plan || processing}
                                                                className="w-full h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {processing ? (
                                                                    <>
                                                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                                                        Redirecting to Stripe...
                                                                    </>
                                                                ) : (
                                                                    `Start Trial`
                                                                )}
                                                            </Button>

                                                            <p className="text-xs text-center text-gray-500">
                                                                Billing starts after trial.
                                                            </p>
                                                        </div>

                                                        {/* Trust Badges */}
                                                        <div className="pt-4 border-t border-gray-200">
                                                            <div className="flex items-center justify-center gap-4 text-gray-400">
                                                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                                                </svg>
                                                                <span className="text-xs">256-bit SSL Encrypted</span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        ) : (
                                            <Card>
                                                <CardContent className="p-6 text-center">
                                                    <p className="text-gray-600">
                                                        Unable to load subscription plan. Please contact support for assistance.
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* Footer Note */}
                                        <div className="text-center text-sm text-gray-500">
                                            <p>
                                                By proceeding, you agree to our Terms of Service and Privacy Policy.
                                                <br />
                                                You can cancel or change your plan anytime from your billing settings.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


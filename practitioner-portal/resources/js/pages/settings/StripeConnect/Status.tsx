import { Head, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import SettingsLayout from '@/layouts/settings-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertCircle, Wallet, ExternalLink } from 'lucide-react';

interface Props {
    tenant: any;
    stripeRequirements: any;
    isOnboardingComplete: boolean;
    canAcceptPayments: boolean;
    canReceivePayouts: boolean;
}

export default function StripeConnectStatus({ 
    tenant, 
    stripeRequirements,
    isOnboardingComplete,
    canAcceptPayments,
    canReceivePayouts 
}: Props) {
    const { flash } = usePage().props as any;

    return (
        <SettingsLayout activeSection="stripe-connect" title="Payment Setup">
            <Head title="Payment Setup" />
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Payment Setup</h2>
                    <p className="text-muted-foreground mt-1">
                        Manage your payment account and accept payments from your customers
                    </p>
                </div>

                {/* Flash Messages */}
                {flash?.success && (
                    <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            {flash.success}
                        </AlertDescription>
                    </Alert>
                )}

                {flash?.error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{flash.error}</AlertDescription>
                    </Alert>
                )}

                {/* Status Overview */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5" />
                            Account Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!tenant.stripe_account_id ? (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Your payment account is being created. Please refresh the page in a moment.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3 p-4 border rounded-lg">
                                    {isOnboardingComplete ? (
                                        <CheckCircle className="h-8 w-8 text-green-500" />
                                    ) : (
                                        <XCircle className="h-8 w-8 text-gray-300" />
                                    )}
                                    <div>
                                        <div className="font-medium">Onboarding</div>
                                        <div className="text-sm text-muted-foreground">
                                            {isOnboardingComplete ? 'Complete' : 'Incomplete'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 border rounded-lg">
                                    {canAcceptPayments ? (
                                        <CheckCircle className="h-8 w-8 text-green-500" />
                                    ) : (
                                        <XCircle className="h-8 w-8 text-gray-300" />
                                    )}
                                    <div>
                                        <div className="font-medium">Accept Payments</div>
                                        <div className="text-sm text-muted-foreground">
                                            {canAcceptPayments ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 border rounded-lg">
                                    {canReceivePayouts ? (
                                        <CheckCircle className="h-8 w-8 text-green-500" />
                                    ) : (
                                        <XCircle className="h-8 w-8 text-gray-300" />
                                    )}
                                    <div>
                                        <div className="font-medium">Receive Payouts</div>
                                        <div className="text-sm text-muted-foreground">
                                            {canReceivePayouts ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Main Action Card */}
                {tenant.stripe_account_id && (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {isOnboardingComplete ? 'Update Account Information' : 'Complete Payment Setup'}
                            </CardTitle>
                            <CardDescription>
                                {isOnboardingComplete 
                                    ? 'Update your payment account information through Stripe\'s secure portal.'
                                    : 'Complete your payment account setup through Stripe\'s secure portal.'
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <a
                                href={route('stripe-connect.redirect')}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                            >
                                {isOnboardingComplete ? 'Update Account Information' : 'Complete Setup'}
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </CardContent>
                    </Card>
                )}

                {/* Success Message */}
                {isOnboardingComplete && canAcceptPayments && canReceivePayouts && (
                    <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                                <CheckCircle className="h-5 w-5" />
                                Account Ready!
                            </CardTitle>
                            <CardDescription className="text-green-600 dark:text-green-400">
                                Your account is fully set up and ready to accept payments and receive payouts.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </div>
        </SettingsLayout>
    );
}

import { useForm } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Save } from 'lucide-react';
import { toast } from 'sonner';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Payment Attempts', href: '/billing/payment-attempts' },
];

interface PaymentAttemptsProps {
    maxPaymentAttempts: number;
    trialDays: number;
}

export default function PaymentAttempts({ maxPaymentAttempts, trialDays }: PaymentAttemptsProps) {
    const { data, setData, put, processing, errors } = useForm({
        max_payment_attempts: maxPaymentAttempts,
        trial_days: trialDays,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('billing.settings.payment.update'), {
            onSuccess: () => {
                toast.success('Payment attempts configuration updated successfully!');
            },
            onError: () => {
                toast.error('Failed to update configuration. Please try again.');
            },
        });
    };

    return (
        <>
            <Head title="Payment Settings" />

            <div className="max-w-4xl">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            <CardTitle>Payment Attempts Configuration</CardTitle>
                        </div>
                        <CardDescription>
                            Configure how many payment attempts Stripe should make before changing the subscription status.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="max_payment_attempts">
                                    Maximum Payment Attempts
                                </Label>
                                <Input
                                    id="max_payment_attempts"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={data.max_payment_attempts}
                                    onChange={(e) => setData('max_payment_attempts', parseInt(e.target.value, 10))}
                                    className={errors.max_payment_attempts ? 'border-red-500' : ''}
                                />
                                {errors.max_payment_attempts && (
                                    <p className="text-sm text-red-500">{errors.max_payment_attempts}</p>
                                )}
                                <p className="text-sm text-gray-500">
                                    Number of times Stripe will attempt to charge the payment method before marking the subscription as past_due or canceled.
                                    Recommended: 3 attempts
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="trial_days">
                                    Trial Period (Days)
                                </Label>
                                <Input
                                    id="trial_days"
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={data.trial_days}
                                    onChange={(e) => setData('trial_days', parseInt(e.target.value, 10))}
                                    className={errors.trial_days ? 'border-red-500' : ''}
                                />
                                {errors.trial_days && (
                                    <p className="text-sm text-red-500">{errors.trial_days}</p>
                                )}
                                <p className="text-sm text-gray-500">
                                    Number of days for the free trial period. Default: 30 days
                                </p>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="bg-gradient-to-r from-[#A100FF] to-[#0500C9]"
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    {processing ? 'Saving...' : 'Save Configuration'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>How It Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Payment Attempts</h4>
                            <p className="text-sm text-gray-600">
                                When a subscription payment fails, Stripe will automatically retry the payment based on your configured retry schedule.
                                After the maximum number of attempts is reached, Stripe will mark the subscription status accordingly.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Trial Period</h4>
                            <p className="text-sm text-gray-600">
                                The trial period determines how long new tenants can use the system for free before their subscription begins.
                                During the trial, no charges are made. After the trial expires, Stripe will automatically attempt to charge the saved payment method.
                            </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> These settings are managed by Stripe's billing engine. 
                                Stripe handles payment retries automatically according to their retry schedule.
                                The maximum attempts setting here is used for reference and may be used by your application logic.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}


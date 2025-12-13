import { useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, CreditCard, DollarSign, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const breadcrumbs = (tenantId: string): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Tenants', href: '/tenants/v2' },
    { title: tenantId, href: `/tenants/${tenantId}` },
];

type TenantShowProps = {
    tenant: {
        id: string;
        company_name: string;
        stripe_id: string | null;
        billing_status: string;
        on_trial: boolean;
        trial_ends_at: string | null;
        requires_billing_setup: boolean;
        billing_completed_at: string | null;
        subscribed_at: string | null;
        created_at: string;
        domains: Array<{ domain: string }>;
    };
    plan: {
        id: number;
        name: string;
        price: number;
        formatted_price: string;
        billing_cycle: string;
    } | null;
    subscription: {
        id: number;
        stripe_id: string;
        stripe_status: string;
        trial_ends_at: string | null;
        ends_at: string | null;
        on_trial: boolean;
        active: boolean;
        canceled: boolean;
    } | null;
    subscriptionHistory: Array<{
        id: string;
        status: string;
        current_period_start: string;
        current_period_end: string;
        trial_start: string | null;
        trial_end: string | null;
        canceled_at: string | null;
        created: string;
    }>;
    invoices: Array<{
        id: string;
        number: string | null;
        amount_due: number;
        amount_paid: number;
        status: string;
        created: string;
        paid_at: string | null;
        subscription: string | null;
    }>;
};

export default function Show() {
    const { tenant, plan, subscription, subscriptionHistory, invoices }: TenantShowProps = usePage().props as any;
    const [extendTrialDialogOpen, setExtendTrialDialogOpen] = useState(false);
    
    const { data, setData, post, processing, errors } = useForm({
        days: 30,
    });

    const handleExtendTrial = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('tenants.extend-trial', tenant.id), {
            onSuccess: () => {
                toast.success('Trial period extended successfully!');
                setExtendTrialDialogOpen(false);
            },
            onError: () => {
                toast.error('Failed to extend trial period.');
            },
        });
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
            active: { variant: 'default', label: 'Active' },
            trialing: { variant: 'default', label: 'Trialing' },
            past_due: { variant: 'destructive', label: 'Past Due' },
            canceled: { variant: 'secondary', label: 'Canceled' },
            unpaid: { variant: 'destructive', label: 'Unpaid' },
            incomplete: { variant: 'outline', label: 'Incomplete' },
            incomplete_expired: { variant: 'destructive', label: 'Expired' },
            pending: { variant: 'outline', label: 'Pending' },
            trial: { variant: 'default', label: 'Trial' },
        };

        const config = statusConfig[status] || { variant: 'outline' as const, label: status };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs(tenant.id)}>
            <Head title={`Tenant: ${tenant.company_name}`} />

            <div className="container mx-auto p-6 space-y-6">
                {/* Tenant Info Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-6 w-6" />
                                <div>
                                    <CardTitle>{tenant.company_name}</CardTitle>
                                    <CardDescription>Tenant ID: {tenant.id}</CardDescription>
                                </div>
                            </div>
                            {getStatusBadge(tenant.billing_status)}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-xs text-gray-500">Stripe Customer ID</Label>
                                <p className="text-sm font-mono">{tenant.stripe_id || 'N/A'}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Created</Label>
                                <p className="text-sm">{formatDate(tenant.created_at)}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Billing Completed</Label>
                                <p className="text-sm">{formatDate(tenant.billing_completed_at)}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Subscribed</Label>
                                <p className="text-sm">{formatDate(tenant.subscribed_at)}</p>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Domains</Label>
                            <div className="flex gap-2 mt-1">
                                {tenant.domains.map((domain, idx) => (
                                    <Badge key={idx} variant="outline">{domain.domain}</Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Current Subscription Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                <CardTitle>Current Subscription</CardTitle>
                            </div>
                            {(subscription || tenant.on_trial) && (
                                <Button
                                    onClick={() => setExtendTrialDialogOpen(true)}
                                    variant="outline"
                                    size="sm"
                                >
                                    <Clock className="h-4 w-4 mr-2" />
                                    {(subscription?.on_trial || tenant.on_trial) ? 'Extend Trial' : 'Add Trial'}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {plan ? (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-xs text-gray-500">Plan</Label>
                                        <p className="text-sm font-semibold">{plan.name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Price</Label>
                                        <p className="text-sm font-semibold">{plan.formatted_price} / {plan.billing_cycle}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Billing Status</Label>
                                        <div className="mt-1">
                                            {subscription ? getStatusBadge(subscription.stripe_status) : getStatusBadge(tenant.billing_status)}
                                        </div>
                                    </div>
                                </div>
                                {subscription && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                                        <div>
                                            <Label className="text-xs text-gray-500">Subscription Status</Label>
                                            <p className="text-sm">{subscription.active ? 'Active' : subscription.canceled ? 'Canceled' : 'Inactive'}</p>
                                        </div>
                                        {subscription.trial_ends_at && (
                                            <div>
                                                <Label className="text-xs text-gray-500">Trial Ends</Label>
                                                <p className="text-sm">{formatDate(subscription.trial_ends_at)}</p>
                                            </div>
                                        )}
                                        {subscription.ends_at && (
                                            <div>
                                                <Label className="text-xs text-gray-500">Ends At</Label>
                                                <p className="text-sm">{formatDate(subscription.ends_at)}</p>
                                            </div>
                                        )}
                                        <div>
                                            <Label className="text-xs text-gray-500">On Trial</Label>
                                            <p className="text-sm">
                                                {subscription.on_trial ? (
                                                    <span className="flex items-center gap-1 text-green-600">
                                                        <CheckCircle2 className="h-4 w-4" /> Yes
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-gray-500">
                                                        <XCircle className="h-4 w-4" /> No
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-gray-500">No subscription plan assigned.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Subscription History */}
                <Card>
                    <CardHeader>
                        <CardTitle>Subscription History</CardTitle>
                        <CardDescription>All subscriptions from Stripe for this tenant</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {subscriptionHistory.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Subscription ID</th>
                                            <th className="text-left p-2">Status</th>
                                            <th className="text-left p-2">Created</th>
                                            <th className="text-left p-2">Current Period</th>
                                            <th className="text-left p-2">Trial Period</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subscriptionHistory.map((sub) => (
                                            <tr key={sub.id} className="border-b hover:bg-gray-50">
                                                <td className="p-2 font-mono text-xs">{sub.id}</td>
                                                <td className="p-2">{getStatusBadge(sub.status)}</td>
                                                <td className="p-2">{formatDate(sub.created)}</td>
                                                <td className="p-2">
                                                    <div className="text-xs">
                                                        <div>Start: {formatDate(sub.current_period_start)}</div>
                                                        <div>End: {formatDate(sub.current_period_end)}</div>
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    {sub.trial_start && sub.trial_end ? (
                                                        <div className="text-xs">
                                                            <div>Start: {formatDate(sub.trial_start)}</div>
                                                            <div>End: {formatDate(sub.trial_end)}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">No trial</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No subscription history found.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Invoice History */}
                <Card>
                    <CardHeader>
                        <CardTitle>Invoice History</CardTitle>
                        <CardDescription>Payment invoices from Stripe</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {invoices.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Invoice #</th>
                                            <th className="text-left p-2">Amount</th>
                                            <th className="text-left p-2">Status</th>
                                            <th className="text-left p-2">Created</th>
                                            <th className="text-left p-2">Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((invoice) => (
                                            <tr key={invoice.id} className="border-b hover:bg-gray-50">
                                                <td className="p-2 font-mono text-xs">{invoice.number || invoice.id}</td>
                                                <td className="p-2">
                                                    ${invoice.amount_paid > 0 ? invoice.amount_paid.toFixed(2) : invoice.amount_due.toFixed(2)}
                                                </td>
                                                <td className="p-2">{getStatusBadge(invoice.status)}</td>
                                                <td className="p-2">{formatDate(invoice.created)}</td>
                                                <td className="p-2">{formatDate(invoice.paid_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No invoices found.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Extend Trial Dialog */}
                <Dialog open={extendTrialDialogOpen} onOpenChange={setExtendTrialDialogOpen}>
                    <DialogContent>
                        <form onSubmit={handleExtendTrial}>
                            <DialogHeader>
                                <DialogTitle>Extend Trial Period</DialogTitle>
                                <DialogDescription>
                                    {(subscription?.on_trial || tenant.on_trial)
                                        ? `Extend the trial period for ${tenant.company_name}. This will update the subscription directly in Stripe.`
                                        : `Add a trial period for ${tenant.company_name}. This will update the subscription directly in Stripe.`
                                    }
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="days">Number of Days</Label>
                                    <Input
                                        id="days"
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={data.days}
                                        onChange={(e) => setData('days', parseInt(e.target.value, 10))}
                                        required
                                    />
                                    {errors.days && (
                                        <p className="text-sm text-red-500">{errors.days}</p>
                                    )}
                                    <p className="text-xs text-gray-500">
                                        {subscription?.trial_ends_at || tenant.trial_ends_at ? (
                                            <>
                                                Current trial ends: {formatDate(subscription?.trial_ends_at || tenant.trial_ends_at)}
                                                <br />
                                                New trial will end: {(() => {
                                                    const currentEnd = subscription?.trial_ends_at || tenant.trial_ends_at;
                                                    if (!currentEnd) return 'N/A';
                                                    const currentDate = new Date(currentEnd);
                                                    const newDate = new Date(currentDate.getTime() + (data.days * 24 * 60 * 60 * 1000));
                                                    return formatDate(newDate.toISOString());
                                                })()}
                                            </>
                                        ) : (
                                            `Trial will end: ${(() => {
                                                const newDate = new Date(Date.now() + (data.days * 24 * 60 * 60 * 1000));
                                                return formatDate(newDate.toISOString());
                                            })()}`
                                        )}
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setExtendTrialDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Extending...' : 'Extend Trial'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}


import { useState } from 'react';
import { Head, router, usePage, useForm } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SettingsLayout from '@/layouts/settings-layout';
import { CheckCircle, XCircle, AlertCircle, Wallet, ExternalLink, Key, UserPlus, X, CreditCard, Users } from 'lucide-react';

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    has_license?: boolean;
    license_id?: number;
}

interface License {
    id: number;
    license_key: string;
    status: 'available' | 'assigned' | 'revoked';
}

interface SubscriptionPlan {
    id: number;
    name: string;
    slug: string;
    price: number;
    currency: string;
    billing_interval: string;
    billing_interval_count: number;
    description?: string;
    features?: string[];
}

interface SubscriptionProps {
    // Payment Setup props
    tenant?: any;
    stripeRequirements?: any;
    isOnboardingComplete?: boolean;
    canAcceptPayments?: boolean;
    canReceivePayouts?: boolean;
    subscriptionPlan?: SubscriptionPlan;
    numberOfSeats?: number;
    // Practitioners for billing tab
    allPractitioners?: Practitioner[];
    // Licenses for seat allocation
    availableLicenses?: License[];
}

export default function Subscription({
    tenant,
    stripeRequirements,
    isOnboardingComplete,
    canAcceptPayments,
    canReceivePayouts,
    subscriptionPlan,
    numberOfSeats = 0,
    allPractitioners = [],
    availableLicenses = [],
}: SubscriptionProps) {
    const { flash } = usePage().props as any;
    
    // Get current main tab from URL or default to 'billing'
    const getCurrentTab = () => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('tab') || 'billing';
        }
        return 'billing';
    };

    // Get current billing sub-tab from URL or default to 'overview'
    const getCurrentBillingTab = () => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('billingTab') || 'overview';
        }
        return 'overview';
    };

    const [activeTab, setActiveTab] = useState(getCurrentTab());
    const [activeBillingTab, setActiveBillingTab] = useState(getCurrentBillingTab());
    
    // Seat allocation state
    const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        license_id: '',
        notes: '',
    });

    // Update URL when main tab changes
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', value);
            if (value === 'billing') {
                url.searchParams.set('billingTab', activeBillingTab);
            } else {
                url.searchParams.delete('billingTab');
            }
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    // Update URL when billing sub-tab changes
    const handleBillingTabChange = (value: string) => {
        setActiveBillingTab(value);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('billingTab', value);
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    // Handle assign license
    const handleAssignLicense = (practitioner: Practitioner) => {
        setSelectedPractitioner(practitioner);
        reset();
        setAssignDialogOpen(true);
    };

    const submitAssignLicense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPractitioner || !data.license_id) return;

        post(route('settings.licenses.attach', data.license_id), {
            practitioner_id: selectedPractitioner.id,
            notes: data.notes,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setAssignDialogOpen(false);
                reset();
                setSelectedPractitioner(null);
            },
        });
    };

    // Handle remove license
    const handleRemoveLicense = (practitioner: Practitioner) => {
        if (!practitioner.license_id) return;
        setSelectedPractitioner(practitioner);
        setRemoveDialogOpen(true);
    };

    const confirmRemoveLicense = () => {
        if (!selectedPractitioner || !selectedPractitioner.license_id) return;

        router.delete(route('settings.licenses.detach', [selectedPractitioner.license_id, selectedPractitioner.id]), {
            preserveScroll: true,
            onSuccess: () => {
                setRemoveDialogOpen(false);
                setSelectedPractitioner(null);
            },
        });
    };

    return (
        <SettingsLayout activeSection="subscription" title="Subscription">
            <Head title="Subscription" />
            <div className="space-y-6">
                <Card className="border-none shadow-none">
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                        <div className="px-6 pb-0">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger 
                                    value="billing"
                                    className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-800"
                                >
                                    Billing
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="payment-setup"
                                    className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-800"
                                >
                                    Payment Setup
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="billing" className="mt-0">
                            <div className="px-6">
                                <Tabs value={activeBillingTab} onValueChange={handleBillingTabChange} className="w-full">
                                    <div className="pb-0">
                                        <TabsList className="grid w-full grid-cols-3">
                                            <TabsTrigger 
                                                value="overview"
                                                className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-800"
                                            >
                                                Overview
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="seat-allocation"
                                                className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-800"
                                            >
                                                Seat Allocation
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="invoicing"
                                                className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-800"
                                            >
                                                Invoicing
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    {/* Overview Tab */}
                                    <TabsContent value="overview" className="mt-6">
                                        <div className="space-y-6">
                                            {/* Current Plan Card - Enhanced Design */}
                                            {subscriptionPlan ? (
                                                <Card className="border-2 border-primary/20 bg-linear-to-br from-primary/5 via-white to-primary/5 shadow-lg">
                                                    <CardHeader>
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                                                                    {subscriptionPlan.name}
                                                                </CardTitle>
                                                                <CardDescription className="text-base">
                                                                    {subscriptionPlan.description || 'Your active subscription plan'}
                                                                </CardDescription>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-4xl font-bold text-primary">
                                                                    ${subscriptionPlan.price.toFixed(2)}
                                                                </div>
                                                                <div className="text-sm text-gray-600 mt-1">
                                                                    {subscriptionPlan.billing_interval_count > 1
                                                                        ? `Every ${subscriptionPlan.billing_interval_count} ${subscriptionPlan.billing_interval}s`
                                                                        : `Per ${subscriptionPlan.billing_interval}`
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium text-gray-700">Allowed Seats</span>
                                                                    <span className="text-2xl font-bold text-gray-900">{numberOfSeats}</span>
                                                                </div>
                                                                <p className="text-xs text-gray-500">Total seats available in your plan</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium text-gray-700">Used Seats</span>
                                                                    <span className="text-2xl font-bold text-gray-900">{allPractitioners.length}</span>
                                                                </div>
                                                                <p className="text-xs text-gray-500">Practitioners currently using seats</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-6 pt-6 border-t">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <span className="text-sm font-semibold text-gray-700">Seat Usage</span>
                                                                <span className="text-sm font-bold text-gray-900">
                                                                    {allPractitioners.length} / {numberOfSeats}
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                                                <div 
                                                                    className={`h-3 rounded-full transition-all duration-500 ${
                                                                        numberOfSeats === 0 
                                                                            ? 'bg-gray-300'
                                                                            : (allPractitioners.length / numberOfSeats) >= 1 
                                                                            ? 'bg-red-500' 
                                                                            : (allPractitioners.length / numberOfSeats) >= 0.8
                                                                            ? 'bg-yellow-500'
                                                                            : 'bg-green-500'
                                                                    }`}
                                                                    style={{ 
                                                                        width: numberOfSeats === 0 
                                                                            ? '0%'
                                                                            : `${Math.min((allPractitioners.length / numberOfSeats) * 100, 100)}%` 
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                                                                <span>
                                                                    {numberOfSeats - allPractitioners.length > 0 
                                                                        ? `${numberOfSeats - allPractitioners.length} seats remaining`
                                                                        : 'All seats in use'
                                                                    }
                                                                </span>
                                                                <span>
                                                                    {numberOfSeats > 0 
                                                                        ? `${Math.round((allPractitioners.length / numberOfSeats) * 100)}% utilized`
                                                                        : '0% utilized'
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ) : (
                                                <Card>
                                                    <CardContent className="py-12">
                                                        <div className="text-center">
                                                            <p className="text-gray-600">No active subscription plan found.</p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* Seat Allocation Tab */}
                                    <TabsContent value="seat-allocation" className="mt-6">
                                        <div className="space-y-6">
                                            <div>
                                                <h2 className="text-2xl font-bold tracking-tight">Seat Allocation</h2>
                                                <p className="text-muted-foreground mt-1">
                                                    Assign and manage licenses for your practitioners
                                                </p>
                                            </div>

                                            {/* Flash Messages */}
                                            {flash?.success && (
                                                <Alert className="border-green-200 bg-green-50">
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                    <AlertDescription className="text-green-800">
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

                                            {/* Practitioners List */}
                                            <Card>
                                                <CardContent>
                                                    {allPractitioners.length === 0 ? (
                                                        <div className="text-center py-12">
                                                            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                                            <p className="text-gray-600">No practitioners found.</p>
                                                            <p className="text-sm text-gray-500 mt-2">
                                                                Add practitioners to start assigning licenses.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Name</TableHead>
                                                                        <TableHead>Email</TableHead>
                                                                        <TableHead>License Status</TableHead>
                                                                        <TableHead>Actions</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {allPractitioners.map((practitioner) => (
                                                                        <TableRow key={practitioner.id}>
                                                                            <TableCell className="font-medium">
                                                                                {practitioner.first_name} {practitioner.last_name}
                                                                            </TableCell>
                                                                            <TableCell>{practitioner.email}</TableCell>
                                                                            <TableCell>
                                                                                {practitioner.has_license ? (
                                                                                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                                                                                        <Key className="h-3 w-3 mr-1" />
                                                                                        Licensed
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <Badge variant="outline" className="text-gray-600">
                                                                                        No License
                                                                                    </Badge>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <div className="flex items-center gap-2">
                                                                                    {!practitioner.has_license ? (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => handleAssignLicense(practitioner)}
                                                                                            disabled={availableLicenses.length === 0}
                                                                                        >
                                                                                            <UserPlus className="h-4 w-4 mr-1" />
                                                                                            Assign License
                                                                                        </Button>
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => handleRemoveLicense(practitioner)}
                                                                                        >
                                                                                            <X className="h-4 w-4 mr-1" />
                                                                                            Remove License
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>

                                    {/* Invoicing Tab */}
                                    <TabsContent value="invoicing" className="mt-6">
                                        <div className="space-y-6">
                                            <div>
                                                <h2 className="text-2xl font-bold tracking-tight">Invoicing</h2>
                                                <p className="text-muted-foreground mt-1">
                                                    View and manage your subscription invoices
                                                </p>
                                            </div>

                                            <Card>
                                                <CardContent className="py-12">
                                                    <div className="text-center">
                                                        <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                                        <p className="text-gray-600">Invoicing feature coming soon.</p>
                                                        <p className="text-sm text-gray-500 mt-2">
                                                            You'll be able to view and download your invoices here.
                                                        </p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </TabsContent>

                        <TabsContent value="payment-setup" className="mt-0">
                            <div className="space-y-6 px-6">
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
                                        {!tenant?.stripe_account_id ? (
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
                                {tenant?.stripe_account_id && (
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
                        </TabsContent>
                    </Tabs>
                </Card>
            </div>

            {/* Assign License Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign License</DialogTitle>
                        <DialogDescription>
                            Assign a license to <span className="font-semibold">{selectedPractitioner?.first_name} {selectedPractitioner?.last_name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitAssignLicense}>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="license_id">Available License *</Label>
                                {availableLicenses.length === 0 ? (
                                    <div className="mt-2 p-4 border border-gray-200 rounded-md bg-gray-50">
                                        <p className="text-sm text-gray-600">
                                            No available licenses found. All licenses are currently assigned.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <Select
                                            value={data.license_id}
                                            onValueChange={(value) => setData('license_id', value)}
                                        >
                                            <SelectTrigger id="license_id">
                                                <SelectValue placeholder="Select a license" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableLicenses.map((license) => (
                                                    <SelectItem key={license.id} value={license.id.toString()}>
                                                        {license.license_key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.license_id && (
                                            <p className="text-sm text-red-500 mt-1">{errors.license_id}</p>
                                        )}
                                    </>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    placeholder="Add any notes about this license assignment..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setAssignDialogOpen(false);
                                    reset();
                                    setSelectedPractitioner(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing || availableLicenses.length === 0}>
                                {processing ? 'Assigning...' : 'Assign License'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Remove License Dialog */}
            <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove License</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove the license from <span className="font-semibold">{selectedPractitioner?.first_name} {selectedPractitioner?.last_name}</span>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setRemoveDialogOpen(false);
                                setSelectedPractitioner(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="button"
                            variant="destructive"
                            onClick={confirmRemoveLicense}
                        >
                            Remove License
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SettingsLayout>
    );
}

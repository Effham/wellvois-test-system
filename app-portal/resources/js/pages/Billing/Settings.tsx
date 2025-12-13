import { useState, useEffect } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Settings } from 'lucide-react';
import PlansIndex from '../Plans/Index';
import PaymentAttempts from './PaymentAttempts';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Billing Settings', href: '/billing/settings' },
];

interface BillingSettingsProps {
    activeTab?: string;
    plans?: any;
    filters?: any;
    maxPaymentAttempts?: number;
    trialDays?: number;
}

export default function BillingSettings({ activeTab: initialTab, plans, filters, maxPaymentAttempts, trialDays }: BillingSettingsProps) {
    const { url } = usePage();
    const [activeTab, setActiveTab] = useState(initialTab || 'plans');

    // Determine active tab from URL
    useEffect(() => {
        if (url.includes('/billing/settings/payment')) {
            setActiveTab('payment');
        } else {
            setActiveTab('plans');
        }
    }, [url]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (value === 'payment') {
            router.visit(route('billing.settings.payment'), { preserveState: true });
        } else {
            router.visit(route('billing.settings.plans'), { preserveState: true });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Billing Settings" />

            <div className="container mx-auto p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">Billing Settings</h1>
                    <p className="text-gray-600 mt-1">Manage subscription plans and payment configuration</p>
                </div>

                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-2 max-w-md">
                        <TabsTrigger value="plans" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Subscription Plans
                        </TabsTrigger>
                        <TabsTrigger value="payment" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Payment Settings
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="plans" className="mt-6">
                        {plans && filters ? <PlansIndex /> : <div>Loading plans...</div>}
                    </TabsContent>

                    <TabsContent value="payment" className="mt-6">
                        {maxPaymentAttempts !== undefined && trialDays !== undefined ? (
                            <PaymentAttempts maxPaymentAttempts={maxPaymentAttempts} trialDays={trialDays} />
                        ) : (
                            <div>Loading payment settings...</div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

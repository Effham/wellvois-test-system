import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, AlertCircle, RefreshCw, Mail, Plus } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Wallet',
        href: '/wallet',
    },
];

interface NoWalletProps {
    user: {
        id: number;
        name: string;
        email: string;
    };
    error?: string;
}

function NoWallet({ user, error }: NoWalletProps) {
    const [isCreating, setIsCreating] = useState(false);

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleCreateWallet = async () => {
        setIsCreating(true);
        try {
            const response = await fetch('/wallet/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                // Redirect to wallet page
                router.visit('/wallet');
            } else {
                alert('Failed to create wallet: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error creating wallet: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <Head title="Wallet - Setup Required" />

            <div className="flex h-full flex-1 flex-col items-center justify-center gap-6 rounded-xl p-6">
                <Card className="w-full max-w-md border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
                            <Wallet className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <CardTitle className="text-xl text-yellow-800 dark:text-yellow-200">
                            Wallet Setup Required
                        </CardTitle>
                        <CardDescription className="text-yellow-700 dark:text-yellow-300">
                            Your wallet is being initialized. This usually happens automatically when your practitioner account is set up.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                            <p><strong>User:</strong> {user.name}</p>
                            <p><strong>Email:</strong> {user.email}</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleCreateWallet}
                                className="w-full"
                                variant="default"
                                disabled={isCreating}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
                            </Button>

                            <Button
                                onClick={handleRefresh}
                                className="w-full"
                                variant="outline"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh Page
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => window.location.href = 'mailto:support@example.com?subject=Wallet Setup Issue'}
                            >
                                <Mail className="mr-2 h-4 w-4" />
                                Contact Support
                            </Button>
                        </div>

                        <div className="mt-4 rounded-md bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <p><strong>What's happening?</strong></p>
                            <p>Your wallet should be created automatically when you complete your first session. If you continue to see this message, please contact support.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default withAppLayout(NoWallet, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Wallet' }
    ]
});
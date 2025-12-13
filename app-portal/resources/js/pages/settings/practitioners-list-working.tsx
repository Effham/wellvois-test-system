import React, { useEffect } from 'react';
import { withAppLayout } from '@/utils/layout';
import PractitionerIndex from '@/pages/Practitioner/Index';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
    items: any;
    filters: any;
}

function PractitionersListWorking({ items, filters }: Props) {
    const { url } = usePage();

    // Fetch data using partial reload when items is null
    useEffect(() => {
        if (!items) {
            router.reload({
                only: ['items'],
                data: filters,
                onError: (errors) => {
                    console.error('Failed to load practitioners:', errors);
                    toast.error('Failed to load practitioners', {
                        description: 'Please refresh the page to try again.',
                    });
                },
            });
        }
    }, []);

    // Determine active tab based on current URL
    const isListActive = url === '/practitioners/list';
    const isInvitationsActive = url === '/practitioners/invitations-list';

    return (
        <>
            <Head title="Practitioners" />

            <div className="max-w-full mx-auto p-6 space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Practitioners</h2>
                    <p className="text-muted-foreground">
                        Manage your practice's practitioners and their settings.
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <Link
                            href="/practitioners/list"
                            className={cn(
                                "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm",
                                isListActive
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            Practitioners
                        </Link>
                        <Link
                            href="/practitioners/invitations-list"
                            className={cn(
                                "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm",
                                isInvitationsActive
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            Invitations
                        </Link>
                    </nav>
                </div>

                {/* Use the working Practitioner Index component */}
                <PractitionerIndex
                    standalone={false}
                    practitioners={items}
                    filters={filters}
                />
            </div>
        </>
    );
}

export default withAppLayout(PractitionersListWorking, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Settings', href: route('settings.index') },
        { title: 'Practitioners' }
    ]
});

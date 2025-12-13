import { Link, Head, usePage, router } from '@inertiajs/react';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { withAppLayout } from '@/utils/layout';
import InvitationsTable from '../Practitioner/InvitationsTable';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
    invitations?: any;
    filters?: any;
    activeTab?: string;
}

function PractitionersInvitationsSettings({
    invitations,
    filters,
    activeTab
}: Props) {
    const { url } = usePage();

    // Fetch data using partial reload when invitations is null
    useEffect(() => {
        if (!invitations) {
            router.reload({
                only: ['invitations'],
                data: filters,
                onError: (errors) => {
                    console.error('Failed to load invitations:', errors);
                    toast.error('Failed to load invitations', {
                        description: 'Please refresh the page to try again.',
                    });
                },
            });
        }
    }, []);
    
    // Determine active tab based on current URL
    const isListActive = url === '/practitioners/list';
    const isInvitationsActive = url === '/practitioners/invitations-list';

    const renderContent = () => {
        try {
            return (
                <div className="max-w-full mx-auto p-6 space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Practitioners</h2>
                        <p className="text-muted-foreground">
                            Manage your practice's practitioners and their settings.
                        </p>
                    </div>

                    {/* Tab Navigation - matching the style from practitioners-list-working */}
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

                    <InvitationsTable 
                        standalone={false}
                        invitations={invitations || {}}
                        filters={filters || {}}
                    />
                </div>
            );
        } catch (error) {
            console.error('Error rendering practitioners invitations content:', error);
            return (
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-red-800">
                            An error occurred while loading the invitations list. Please refresh the page and try again.
                        </p>
                        <p className="text-sm text-red-600 mt-2">
                            Error details: {error instanceof Error ? error.message : 'Unknown error'}
                        </p>
                    </div>
                </div>
            );
        }
    };

    return (
        <>
            <Head title="Practitioner Invitations" />
            {renderContent()}
        </>
    );
}

export default withAppLayout(PractitionersInvitationsSettings, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Settings', href: route('settings.index') },
        { title: 'Practitioner Invitations' }
    ]
});

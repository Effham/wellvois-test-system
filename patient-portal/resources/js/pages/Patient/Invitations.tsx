import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { withAppLayout } from '@/utils/layout';
import { Head, usePage, Link, router } from '@inertiajs/react';
import { Send, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import InvitationsTable from './InvitationsTable';

function Invitations() {
    const { invitations, filters, flash }: any = usePage().props;

    // Handle flash messages with toast notifications
    useEffect(() => {
        if (flash?.success) {
            toast.success('Success', {
                description: flash.success
            });
        }
        if (flash?.error) {
            toast.error('Error', {
                description: flash.error
            });
        }
        if (flash?.info) {
            toast.info('Information', {
                description: flash.info
            });
        }
    }, [flash]);

    // Fetch data using partial reload when invitations is null
    useEffect(() => {
        if (!invitations) {
            router.reload({
                only: ['invitations'],
                data: filters,
                onError: (errors) => {
                    console.error('Failed to load invitations data:', errors);
                    toast.error('Failed to load invitations', {
                        description: 'Please refresh the page to try again.',
                    });
                },
            });
        }
    }, []);

    // Show loading state
    if (!invitations) {
        return (
            <>
                <Head title="Patient Invitations" />
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-4">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                    <h2 className="text-2xl font-semibold">Loading Invitations...</h2>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Patient Invitations" />
            
            <div className="space-y-6">
                <Card className="shadow-none border-none m-3 sm:m-6">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Send className="h-5 w-5" />
                                <CardTitle>Patient Invitations</CardTitle>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Link href="/patients">
                                    <Button variant="outline" size="sm">
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        View Patients
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="card-content-mobile">
                        <InvitationsTable 
                            invitations={invitations}
                            filters={filters}
                            standalone={true}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default withAppLayout(Invitations, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Patients', href: route('patients.index') },
        { title: 'Patient Invitations' }
    ]
});


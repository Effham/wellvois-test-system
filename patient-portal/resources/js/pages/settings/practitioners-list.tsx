import { useState, useEffect } from 'react';
import { usePage, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import SettingsLayout from '@/layouts/settings-layout';
import PractitionerIndex from '../Practitioner/Index';
import PractitionerCreate from '../Practitioner/Create';

type Practitioner = {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
    phone_number?: string;
    gender?: string;
    pronoun?: string;
    email: string;
    short_bio?: string;
    full_bio?: string;
    invitation_status?: string;
};

interface Props {
    practitioners?: any;
    filters?: any;
    locations?: any;
    services?: any;
    editPractitioner?: any;
    activeTab?: string;
    error?: string;
}

export default function PractitionersListSettings({ 
    practitioners, 
    filters, 
    locations, 
    services, 
    editPractitioner,
    activeTab,
    error 
}: Props) {
    const { flash }: any = usePage()?.props || {};
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingPractitioner, setEditingPractitioner] = useState<Practitioner | null>(null);

    // Handle URL parameters for practitioner editing and creating
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const urlParams = new URLSearchParams(window.location.search);
        const practitionerId = urlParams.get('practitioner_id');
        const createMode = urlParams.get('create') === 'true';
        
        // If create mode is requested, show create form
        if (createMode) {
            setEditingPractitioner(null);
            setShowCreateForm(true);
            return;
        }
        
        if (practitionerId && editPractitioner) {
            setEditingPractitioner(editPractitioner);
            setShowCreateForm(true);
        }
    }, [editPractitioner]);

    const handleCreatePractitioner = () => {
        setEditingPractitioner(null);
        setShowCreateForm(true);
    };

    const handleEditPractitioner = (practitioner: Practitioner) => {
        setEditingPractitioner(practitioner);
        setShowCreateForm(true);
    };

    const handleCancelPractitionerForm = () => {
        setShowCreateForm(false);
        setEditingPractitioner(null);
        
        // Clean up URL parameters when canceling edit
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('practitioner_id')) {
                url.searchParams.delete('practitioner_id');
                window.history.replaceState({}, '', url.pathname + url.search);
            }
        }
    };

    const renderContent = () => {
        try {
            if (showCreateForm) {
                return (
                    <div className="space-y-6">
                        <PractitionerCreate
                            practitioner={editingPractitioner}
                            locations={locations}
                            services={services}
                            onCancel={handleCancelPractitionerForm}
                            canEditBasicInfo={(editingPractitioner as any)?.canEditBasicInfo ?? true}
                            canEditProfessionalDetails={(editingPractitioner as any)?.canEditProfessionalDetails ?? true}
                            embedded={true}
                        />
                    </div>
                );
            }

            return (
                <div className="space-y-6">
                    {/* Tab Navigation */}
                    <div className="flex items-center space-x-1 border-b">
                        <Link
                            href="/settings/practitioners/list"
                            className="px-4 py-2 border-b-2 border-blue-500 text-blue-600 font-medium"
                        >
                            <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4" />
                                <span>Practitioners</span>
                            </div>
                        </Link>
                        <Link
                            href="/settings/practitioners/invitations"
                            className="px-4 py-2 text-gray-500 hover:text-gray-700"
                        >
                            <span>Invitations</span>
                        </Link>
                    </div>

                    {/* Show error message if backend error occurred */}
                    {error && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">
                                        Unable to Load Practitioners
                                    </h3>
                                    <p className="mt-1 text-sm text-yellow-700">
                                        {error}
                                    </p>
                                    <p className="mt-1 text-xs text-yellow-600">
                                        This error has been logged. Please try refreshing the page or contact support if the issue persists.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Card className="border-none shadow-none">
                        <CardContent>
                            <PractitionerIndex
                                standalone={false}
                                practitioners={practitioners || {}}
                                filters={filters || {}}
                                onCreateClick={handleCreatePractitioner}
                                onEditClick={handleEditPractitioner}
                            />
                        </CardContent>
                    </Card>
                </div>
            );
        } catch (error) {
            console.error('Error rendering practitioners list content:', error);
            return (
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-red-800">
                            An error occurred while loading the practitioners list. Please refresh the page and try again.
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
        <SettingsLayout activeSection="practitioners" title="Practitioners Settings">
            {renderContent()}
        </SettingsLayout>
    );
}

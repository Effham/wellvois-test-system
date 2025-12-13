import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import SettingsLayout from '@/layouts/settings-layout';
import ServicesIndex from '../Services/Index';
import ServicesCreate from '../Services/Create';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
    services: any;
    filters?: any;
}

export default function ServicesSettings({ services, filters }: Props) {
    const [showServicesCreateForm, setShowServicesCreateForm] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const { flash }: any = usePage()?.props || {};

    // Check if we're in onboarding flow
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isOnboarding = urlParams.get('onboarding') === 'true';

    // Show toast when flash messages arrive (only if not in onboarding to avoid duplicates)
    useEffect(() => {
        if (!isOnboarding) {
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
        }
    }, [flash, isOnboarding]);

    // Check for create mode from URL parameters
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const createMode = urlParams.get('create') === 'true';
            
            if (createMode) {
                setShowServicesCreateForm(true);
                setEditingService(null);
            }
        }
    }, []);

    const handleCreateService = () => {
        setEditingService(null);
        setShowServicesCreateForm(true);
    };

    const handleEditService = (service: any) => {
        setEditingService(service);
        setShowServicesCreateForm(true);
    };

    const handleCancelServiceForm = () => {
        setShowServicesCreateForm(false);
        setEditingService(null);
    };

    const renderContent = () => {
        try {
            if (showServicesCreateForm) {
                // Provide the default options for services create form
                const categories = {
                    'Individual': 'Individual',
                    'Couple': 'Couple',
                    'Group': 'Group',
                    'Assessment': 'Assessment',
                    'Family': 'Family',
                    'Specialty': 'Specialty',
                    'Follow-Up': 'Follow-Up',
                };

                const deliveryModes = {
                    'in-person': 'In-Person',
                    'virtual': 'Virtual',
                };

                const durations = {
                    15: '15 minutes',
                    30: '30 minutes',
                    45: '45 minutes',
                    60: '60 minutes',
                    75: '75 minutes',
                    90: '90 minutes',
                    120: '2 hours',
                    150: '2.5 hours',
                    180: '3 hours',
                };

                return (
                    <ServicesCreate
                        service={editingService}
                        categories={categories}
                        deliveryModes={deliveryModes}
                        onCancel={handleCancelServiceForm}
                    />
                );
            }

            return (
                <ServicesIndex
                    onCreateClick={handleCreateService}
                    onEditClick={handleEditService}
                    services={services}
                    filters={filters}
                />
            );
        } catch (error) {
            console.error('Error rendering services content:', error);
            return (
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-red-800">
                            An error occurred while loading the services section. Please refresh the page and try again.
                        </p>
                    </div>
                </div>
            );
        }
    };

    return (
        <SettingsLayout activeSection="services" title="Services Settings">
            {renderContent()}
        </SettingsLayout>
    );
}

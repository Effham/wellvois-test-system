import { useEffect } from 'react';
import { router } from '@inertiajs/react';
import SettingsLayout from '@/layouts/settings-layout';
import IntegrationsTab from './Integrations/IntegrationsTab';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
    integrations?: any;
}

export default function IntegrationsSettings({ integrations }: Props) {
    // Fetch data using partial reload when integrations is null
    useEffect(() => {
        if (!integrations) {
            router.reload({
                only: ['integrations'],
                onError: (errors) => {
                    console.error('Failed to load integrations:', errors);
                    toast.error('Failed to load integrations', {
                        description: 'Please refresh the page to try again.',
                    });
                },
            });
        }
    }, []);

    const renderContent = () => {
        try {
            // Show loading state while data is being fetched
            if (!integrations) {
                return (
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-4">
                        <Loader2 className="h-16 w-16 animate-spin text-primary" />
                        <h2 className="text-2xl font-semibold">Loading Integrations...</h2>
                    </div>
                );
            }

            return (
                <IntegrationsTab
                    integrations={integrations}
                />
            );
        } catch (error) {
            console.error('Error rendering integrations content:', error);
            return (
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-red-800">
                            An error occurred while loading the integrations section. Please refresh the page and try again.
                        </p>
                    </div>
                </div>
            );
        }
    };

    return (
        <SettingsLayout activeSection="integrations" title="Integrations Settings">
            {renderContent()}
        </SettingsLayout>
    );
}

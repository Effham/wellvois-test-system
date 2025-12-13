import { useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';

// This component redirects /settings to the first available settings page based on permissions
export default function SettingsIndexRedirect() {
    const { auth }: any = usePage()?.props || {};
    const userPerms: string[] = auth?.user?.permissions || [];

    useEffect(() => {
        // Check permissions in priority order matching the sidebar and backend route
        if (userPerms.includes('view-organization')) {
            router.visit('/settings/organization', { replace: true });
        } else if (userPerms.includes('view-location')) {
            router.visit('/settings/locations', { replace: true });
        } else if (userPerms.includes('view-services')) {
            router.visit('/settings/services', { replace: true });
        } else {
            // If user has no settings permissions, redirect to dashboard
            router.visit('/dashboard', { replace: true });
        }
    }, [userPerms]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Redirecting to settings...</p>
            </div>
        </div>
    );
}

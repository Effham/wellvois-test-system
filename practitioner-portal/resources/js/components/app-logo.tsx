import { usePage } from '@inertiajs/react';
import { useSidebar } from '@/components/ui/sidebar';
import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    const { tenancy } : any = usePage().props;
    const isCentral = tenancy?.is_central;
    const currentTenantName = tenancy?.current?.name;
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';

    return (
        <>
            <div className="flex h-8 w-full items-center justify-center rounded-md">
                <AppLogoIcon collapsed={isCollapsed} className="h-full w-full object-contain" />
            </div>
        </>
    );
}

import * as React from 'react';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Settings } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Settings',
        href: '/settings',
    },
];

interface SidebarNavItem {
    title: string;
    key: string;
    href: string;
    permission?: string;
}

const sidebarNavItems: SidebarNavItem[] = [
    {
        title: 'Organization',
        key: 'organization',
        href: '/settings/organization',
        permission: 'view-organization',
    },
    {
        title: 'Locations',
        key: 'locations',
        href: '/settings/locations',
        permission: 'view-location',
    },
    {
        title: 'Services',
        key: 'services',
        href: '/settings/services',
        permission: 'view-services',
    },
    {
        title: 'Subscription',
        key: 'subscription',
        href: '/settings/subscription',
        permission: 'view-organization', // Reusing organization permission
    },
    // {
    //     title: 'Integrations',
    //     key: 'integrations',
    //     href: '/settings/integrations',
    //     permission: 'view-integration',
    // },
    // {
    //     title: 'Website Settings',
    //     key: 'website',
    //     href: '/settings/website',
    //     permission: 'view-website',
    // },
];

interface SettingsLayoutProps {
    children: React.ReactNode;
    activeSection: string;
    title?: string;
}

export default function SettingsLayout({ children, activeSection, title = "Settings" }: SettingsLayoutProps) {
    const page = usePage();
    const { auth }: any = page.props || {};
    const userPerms: string[] = auth?.user?.permissions || [];

    // Filter sidebar items based on permissions
    const filteredSidebarNavItems = sidebarNavItems.filter(item => {
        if (!item?.permission) return true;
        return userPerms?.includes(item.permission) || false;
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={title} />

            <div className="px-4 py-6">
                <div className="flex flex-col space-y-8 lg:flex-row lg:space-y-0 lg:space-x-12">
                    <aside className="w-full max-w-xl lg:w-48">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Settings className="h-6 w-6 text-primary" />
                                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                            </div>
                            <nav className="flex flex-col space-y-1 space-x-0">
                                {filteredSidebarNavItems.map((item) => {
                                    const isActive = activeSection === item.key;

                                    const linkClassName = cn(
                                        'w-full justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[36px] flex items-center cursor-pointer',
                                        {
                                            'bg-white text-primary shadow-sm': isActive,
                                            'bg-transparent text-black': !isActive,
                                            'hover:bg-accent hover:text-accent-foreground': true,
                                        }
                                    );

                                    const linkStyle = {
                                        fontWeight: isActive ? 600 : 500,
                                    };

                                    return (
                                        <div
                                            key={item.key}
                                            id={item.key}
                                            onClick={() => router.visit(item.href)}
                                            className={linkClassName}
                                            style={linkStyle}
                                        >
                                            {item.title}
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    <Separator className="my-6 md:hidden" />

                    <div className="flex-1 min-h-0">
                        <section className="space-y-12" style={{ minHeight: '400px' }}>
                            {children}
                        </section>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

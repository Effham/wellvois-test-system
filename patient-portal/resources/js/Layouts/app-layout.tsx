import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import { PageContentLoader } from '@/components/page-content-loader';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { usePage } from '@inertiajs/react';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    disableContentLoader?: boolean;
}

export default function AppLayout({ children, breadcrumbs, disableContentLoader = false, ...props }: AppLayoutProps) {
    const { component } = usePage();
    
    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
            {disableContentLoader ? (
                children
            ) : (
                <PageContentLoader delay={150} mode="full">
                    <motion.div
                        key={component}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                        {children}
                    </motion.div>
                </PageContentLoader>
            )}
        </AppLayoutTemplate>
    );
}

import React, { PropsWithChildren } from 'react';
import { Link } from '@inertiajs/react';
import PageHeader from '@/components/general/PageHeader';
import { type BreadcrumbItem } from '@/types';

interface GuestProps extends PropsWithChildren {
    breadcrumbs?: BreadcrumbItem[];
}

export default function Guest({ children, breadcrumbs }: GuestProps) {
    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-gray-100 dark:bg-gray-900">
            <div>
                <Link href="/">
                    <img   src="/brand/images/mainLogo.png"  alt="Application Logo" className="w-20 h-5 mt-5" />
                </Link>
            </div>

            <div className="w-full max-w-6xl mt-6 px-6 py-4 bg-white dark:bg-gray-800 shadow-md overflow-hidden sm:rounded-lg">
                {children}
            </div>
        </div>
    );
}

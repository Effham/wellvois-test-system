import { LucideIcon } from 'lucide-react';
import type { Config } from 'ziggy-js';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: string;
    permission?: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    appEnv: string;
    csrf_token: string;
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };
    sidebarOpen: boolean;
    flash: FlashProps;
    centralAppUrl: string; // Add centralAppUrl to SharedData
    keycloak?: {
        logged_in: boolean;
        user?: {
            name: string;
            email: string;
        };
        base_url?: string;
        realm?: string;
        client_id?: string;
        account_management_url?: string | null;
    };
    // Any other shared data from HandleInertiaRequests
    [key: string]: unknown;
}

export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    google2fa_enabled: boolean;
    tenancy: {
        is_central: boolean;
        current: { id: string | null; name: string | null; is_onboarding: boolean } | null;
        logo: string | null;
    };
    [key: string]: unknown; // This allows for additional properties...
}

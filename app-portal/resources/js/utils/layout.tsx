import type { ReactElement } from 'react';
import type { BreadcrumbItem } from '@/types';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings-layout';
import AuthLayout from '@/layouts/auth-layout';

/**
 * Layout Helper Utilities
 * 
 * These helpers make it easy to assign persistent layouts to pages.
 * 
 * ## Benefits of Persistent Layouts:
 * 
 * 1. **Performance**: Layout shell (sidebar, header) stays mounted and doesn't re-render
 * 2. **Smooth UX**: No flash/flicker of sidebar/header on navigation
 * 3. **State Preservation**: Component state in layout is preserved across pages
 * 4. **Faster Navigation**: Only page content is swapped, not the entire DOM
 * 
 * ## Usage:
 * 
 * ```tsx
 * import { withAppLayout } from '@/utils/layout';
 * 
 * function MyPage() {
 *   return <div>My content</div>;
 * }
 * 
 * // Method 1: Using helper function (recommended)
 * export default withAppLayout(MyPage, {
 *   breadcrumbs: [
 *     { title: 'Dashboard', href: route('dashboard') },
 *     { title: 'My Page', href: route('my-page') }
 *   ]
 * });
 * 
 * // Method 2: Direct assignment
 * MyPage.layout = (page) => (
 *   <AppLayout breadcrumbs={[...]}>
 *     {page}
 *   </AppLayout>
 * );
 * 
 * export default MyPage;
 * ```
 */

interface LayoutConfig {
    breadcrumbs?: BreadcrumbItem[];
}

interface SettingsLayoutConfig {
    activeSection: string;
    title?: string;
}

/**
 * Wraps a page component with AppLayout (main app layout with sidebar)
 * 
 * @example
 * ```tsx
 * export default withAppLayout(DashboardPage, {
 *   breadcrumbs: [{ title: 'Dashboard', href: route('dashboard') }]
 * });
 * ```
 */
export function withAppLayout<T extends object>(
    Component: React.ComponentType<T>,
    config: LayoutConfig = {}
): React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element } {
    const WrappedComponent = Component as React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element };
    
    WrappedComponent.layout = (page: ReactElement) => (
        <AppLayout breadcrumbs={config.breadcrumbs}>
            {page}
        </AppLayout>
    );
    
    return WrappedComponent;
}

/**
 * Wraps a page component with SettingsLayout
 * 
 * @example
 * ```tsx
 * export default withSettingsLayout(ProfilePage, {
 *   activeSection: 'profile',
 *   title: 'Profile Settings'
 * });
 * ```
 */
export function withSettingsLayout<T extends object>(
    Component: React.ComponentType<T>,
    config: SettingsLayoutConfig
): React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element } {
    const WrappedComponent = Component as React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element };
    
    WrappedComponent.layout = (page: ReactElement) => (
        <SettingsLayout activeSection={config.activeSection} title={config.title}>
            {page}
        </SettingsLayout>
    );
    
    return WrappedComponent;
}

/**
 * Wraps a page component with AuthLayout (for login, register, etc.)
 * 
 * @example
 * ```tsx
 * export default withAuthLayout(LoginPage, {
 *   title: 'Sign in to your account',
 *   description: 'Enter your credentials below'
 * });
 * ```
 */
export function withAuthLayout<T extends object>(
    Component: React.ComponentType<T>,
    config: { title?: string; description?: string } = {}
): React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element } {
    const WrappedComponent = Component as React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element };
    
    WrappedComponent.layout = (page: ReactElement) => (
        <AuthLayout title={config.title || ''} description={config.description || ''}>
            {page}
        </AuthLayout>
    );
    
    return WrappedComponent;
}

/**
 * Creates a custom layout wrapper
 * 
 * @example
 * ```tsx
 * export default withLayout(MyPage, (page) => (
 *   <CustomLayout>
 *     {page}
 *   </CustomLayout>
 * ));
 * ```
 */
export function withLayout<T extends object>(
    Component: React.ComponentType<T>,
    layoutFn: (page: ReactElement) => JSX.Element
): React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element } {
    const WrappedComponent = Component as React.ComponentType<T> & { layout: (page: ReactElement) => JSX.Element };
    WrappedComponent.layout = layoutFn;
    return WrappedComponent;
}


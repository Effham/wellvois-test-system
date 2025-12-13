import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme, setDatabaseTheme, applyFontFamily } from './hooks/use-appearance';
import { initializeTimeLocale, setDatabaseTimeLocale } from './hooks/use-time-locale';
import { router } from '@inertiajs/react';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => {
        // Get tenant information if available
        const page = document.querySelector('[data-page]');
        const pageData = page ? JSON.parse(page.getAttribute('data-page') || '{}') : {};
        const tenancy = pageData.props?.tenancy;
        
        if (tenancy?.current?.name) {
            return title ? `${title} - ${tenancy.current.name}` : tenancy.current.name;
        }
        
        return `${title} - ${appName}`;
    },
    resolve: (name) => {
        // Resolve page component with support for persistent layouts
        // The page component can have a .layout property for persistent layouts
        // This allows layouts to stay mounted while only page content changes
        return resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx'));
    },
    setup({ el, App, props }) {
        const root = createRoot(el);

        // Extract database settings from props if available
        const pageProps = props.initialPage.props as any;
        const organizationSettings = pageProps?.organizationSettings;
        const appearanceSettings = organizationSettings?.appearance;
        const timeLocaleSettings = organizationSettings?.timeLocale;
        const databaseThemeColor = appearanceSettings?.appearance_theme_color;
        const databaseFontFamily = appearanceSettings?.appearance_font_family;
        const databaseTimezone = timeLocaleSettings?.time_locale_timezone;
        const databaseDateFormat = timeLocaleSettings?.time_locale_date_format;
        const databaseTimeFormat = timeLocaleSettings?.time_locale_time_format;
        const isAuthenticated = !!pageProps?.auth?.user; // Check if user is authenticated
        // Initialize systems first
        initializeTheme();
        initializeTimeLocale();

        // Set database theme after initialization (this will override any defaults)
        if (databaseThemeColor && isAuthenticated) {
            console.log('Loading database theme for authenticated user:', databaseThemeColor);
            setDatabaseTheme(databaseThemeColor, isAuthenticated);
        } else if (isAuthenticated) {
            // Authenticated user but no theme set - clear any localStorage
            console.log('Authenticated user with no database theme - clearing localStorage');
            setDatabaseTheme(undefined, isAuthenticated);
        }

        // Apply database font family if available
        if (databaseFontFamily && isAuthenticated) {
            console.log('Loading database font for authenticated user:', databaseFontFamily);
            applyFontFamily(databaseFontFamily);
        }

        // Set database time/locale settings after initialization
        if (isAuthenticated && (databaseTimezone || databaseDateFormat || databaseTimeFormat)) {
            console.log('Loading database time/locale settings for authenticated user:', {
                timezone: databaseTimezone,
                dateFormat: databaseDateFormat,
                timeFormat: databaseTimeFormat
            });
            setDatabaseTimeLocale(databaseTimezone, databaseDateFormat, databaseTimeFormat, isAuthenticated);
        } else if (isAuthenticated) {
            // Authenticated user but no time/locale settings - use defaults
            console.log('Authenticated user with no database time/locale settings - using defaults');
            setDatabaseTimeLocale(undefined, undefined, undefined, isAuthenticated);
        }

        // Settings update on navigation for authenticated users (lightweight)
        if (isAuthenticated) {
            const removeInertiaListener = router.on('navigate', (event) => {
                const newProps = event.detail.page.props as any;
                const newOrgSettings = newProps?.organizationSettings;
                const newAppearanceSettings = newOrgSettings?.appearance;
                const newTimeLocaleSettings = newOrgSettings?.timeLocale;
                const newDbTheme = newAppearanceSettings?.appearance_theme_color;
                const newDbFont = newAppearanceSettings?.appearance_font_family;
                const newDbTimezone = newTimeLocaleSettings?.time_locale_timezone;
                const newDbDateFormat = newTimeLocaleSettings?.time_locale_date_format;
                const newDbTimeFormat = newTimeLocaleSettings?.time_locale_time_format;
                
                // Update theme if changed
                if (newDbTheme !== databaseThemeColor) {
                    console.log('Theme updated via navigation:', newDbTheme);
                    setDatabaseTheme(newDbTheme, true);
                }
                
                // Update font if changed
                if (newDbFont !== databaseFontFamily) {
                    console.log('Font updated via navigation:', newDbFont);
                    applyFontFamily(newDbFont);
                }
                
                // Update time/locale settings if changed
                if (newDbTimezone !== databaseTimezone || 
                    newDbDateFormat !== databaseDateFormat || 
                    newDbTimeFormat !== databaseTimeFormat) {
                    console.log('Time/locale settings updated via navigation:', {
                        timezone: newDbTimezone,
                        dateFormat: newDbDateFormat,
                        timeFormat: newDbTimeFormat
                    });
                    setDatabaseTimeLocale(newDbTimezone, newDbDateFormat, newDbTimeFormat, true);
                }
            });

            // Cleanup function
            (window as any).themeCleanup = () => {
                removeInertiaListener();
            };

            // Detect when page is restored from bfcache after logout
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    // Page was restored from bfcache
                    const pageProps = props.initialPage.props as any;
                    const wasAuthenticated = !!pageProps?.auth?.user;

                    if (wasAuthenticated) {
                        // Check if user is still authenticated
                        fetch('/api/check-auth', {
                            method: 'GET',
                            credentials: 'same-origin'
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (!data.authenticated) {
                                // User is no longer authenticated - force reload
                                console.log('bfcache restoration detected after logout - reloading');
                                window.location.reload();
                            }
                        })
                        .catch(() => {
                            // Error checking auth - safer to reload
                            window.location.reload();
                        });
                    }
                }
            });
        }

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

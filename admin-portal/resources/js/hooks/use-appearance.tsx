import { useCallback, useEffect, useState } from 'react';

export type Appearance = 'light'; // Only allow light theme

// Theme definitions - must match Appearance component
const themeColors = [
    { 
        value: '#f3f4f6', 
        label: 'Light Gray', 
        primary: '#6b7280',
        background: '#f9fafb'
    },
    { 
        value: '#7c3aed', 
        label: 'Purple', 
        primary: '#7c3aed',
        background: '#faf7ff'
    },
    { 
        value: '#10b981', 
        label: 'Green', 
        primary: '#10b981',
        background: '#f0fdf4'
    },
    { 
        value: '#3b82f6', 
        label: 'Blue', 
        primary: '#3b82f6',
        background: '#eff6ff'
    },
    { 
        value: '#8b5cf6', 
        label: 'Violet', 
        primary: '#8b5cf6',
        background: '#faf5ff'
    },
    { 
        value: '#f59e0b', 
        label: 'Orange', 
        primary: '#f59e0b',
        background: '#fffbeb'
    },
];

// Convert hex to oklch for CSS variables
const hexToOklch = (hex: string): string => {
    const colorMap: { [key: string]: string } = {
        '#6b7280': 'oklch(0.556 0 0)', // gray-500
        '#7c3aed': 'oklch(48.958% 0.24984 289.219)', // purple-600
        '#10b981': 'oklch(0.646 0.222 152.116)', // green-500
        '#3b82f6': 'oklch(0.6 0.222 252.116)', // blue-500
        '#8b5cf6': 'oklch(0.627 0.265 303.9)', // violet-500
        '#f59e0b': 'oklch(0.769 0.188 70.08)', // orange-500
        '#f9fafb': 'oklch(0.99 0 0)', // gray-50
        '#faf7ff': 'oklch(0.985 0.01 289)', // purple-50
        '#f0fdf4': 'oklch(0.985 0.02 152)', // green-50
        '#eff6ff': 'oklch(0.985 0.02 252)', // blue-50
        '#faf5ff': 'oklch(0.985 0.02 303)', // violet-50
        '#fffbeb': 'oklch(0.985 0.02 70)', // orange-50
    };
    return colorMap[hex] || hex;
};

// Apply custom theme to CSS variables
const applyCustomTheme = (theme: any) => {
    if (typeof document === 'undefined') return;
    
    console.log('Applying theme:', theme);
    
    const root = document.documentElement;
    
    const primaryColor = theme.primary || theme.value;
    const backgroundColor = theme.background;
    
    if (primaryColor) {
        // For predefined themes, use oklch conversion; for custom themes, use hex directly
        const isCustomTheme = theme.label === 'Custom Color' || !themeColors.find(t => t.value === primaryColor);
        
        if (isCustomTheme) {
            // Use hex directly for custom colors
            root.style.setProperty('--primary', primaryColor);
            console.log('Set custom primary color (hex):', primaryColor);
        } else {
            // Use oklch for predefined themes
            root.style.setProperty('--primary', hexToOklch(primaryColor));
            console.log('Set predefined primary color (oklch):', primaryColor, '→', hexToOklch(primaryColor));
        }
        
        root.style.setProperty('--sidebar-accent', primaryColor);
    }
    
    if (backgroundColor) {
        const isCustomTheme = theme.label === 'Custom Color' || !themeColors.find(t => t.value === theme.value);
        
        if (isCustomTheme) {
            // Use hex directly for custom backgrounds
            root.style.setProperty('--background', backgroundColor);
            console.log('Set custom background color (hex):', backgroundColor);
        } else {
            // Use oklch for predefined backgrounds
            root.style.setProperty('--background', hexToOklch(backgroundColor));
            console.log('Set predefined background color (oklch):', backgroundColor, '→', hexToOklch(backgroundColor));
        }
    }
    
    console.log('Theme application completed for:', theme.label || theme.value);
};

// Get theme object from color value
const getThemeByValue = (colorValue: string) => {
    return themeColors.find(theme => theme.value === colorValue) || null; // Return null if not found, don't default to purple
};

// Generate palette for custom colors (same as in Appearance component)
const generatePalette = (baseColor: string) => {
    console.log('Generating custom palette for color:', baseColor);
    
    const hexToHsl = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h * 360, s * 100, l * 100];
    };

    const hslToHex = (h: number, s: number, l: number) => {
        h /= 360; s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
            const k = (n + h * 12) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };

    const [h, s, l] = hexToHsl(baseColor);

    const colors = [
        hslToHex(h, Math.max(10, s * 0.3), Math.min(95, l + 40)),
        hslToHex(h, Math.max(15, s * 0.5), Math.min(90, l + 25)),
        hslToHex(h, Math.max(20, s * 0.7), Math.min(80, l + 10)),
        hslToHex(h, s, l),
        hslToHex(h, Math.min(100, s * 1.1), Math.max(20, l - 10)),
    ];

    const background = hslToHex(h, Math.max(5, s * 0.2), Math.min(98, l + 45));

    const generatedTheme = {
        colors,
        primary: baseColor,
        background,
        label: 'Custom Color',
        value: baseColor
    };
    
    console.log('Generated custom theme:', generatedTheme);
    return generatedTheme;
};

// Load theme with priority: Database (for authenticated) > localStorage (for unauthenticated) > default
const loadThemeFromSources = (databaseThemeColor?: string, isAuthenticated: boolean = false) => {
    if (typeof window === 'undefined') return null;
    
    let themeSource = 'default';
    let themeColorValue = '#7c3aed'; // Default purple
    
    try {
        // Priority 1: Database theme (for authenticated users)
        if (isAuthenticated && databaseThemeColor) {
            themeColorValue = databaseThemeColor;
            themeSource = 'database (authenticated)';
            
            // Clear localStorage to prevent conflicts for authenticated users
            localStorage.removeItem('selected-theme');
        }
        // Priority 2: localStorage theme (only for unauthenticated users)
        else if (!isAuthenticated) {
            const savedTheme = localStorage.getItem('selected-theme');
            if (savedTheme) {
                const parsed = JSON.parse(savedTheme);
                themeColorValue = parsed.value || parsed.primary || savedTheme;
                themeSource = 'localStorage (unauthenticated)';
            }
        }
        // For authenticated users without database theme, use default and clear localStorage
        else if (isAuthenticated && !databaseThemeColor) {
            localStorage.removeItem('selected-theme');
            themeSource = 'default (authenticated, no database theme)';
        }
        
        // Check if it's a predefined theme first
        let theme = getThemeByValue(themeColorValue);
        
        // If not found in predefined themes, treat as custom color (but validate hex format)
        if (!theme && themeColorValue.match(/^#[0-9A-Fa-f]{6}$/)) {
            theme = generatePalette(themeColorValue);
            themeSource += ' (custom)';
            console.log('Generated custom theme palette for:', themeColorValue);
        }
        
        // Apply the theme if we have one
        if (theme) {
            applyCustomTheme(theme);
            console.log(`Theme loaded from ${themeSource}:`, theme.label || theme.value);
            return theme;
        }
        
        // If still no theme found, fall back to default
        console.log('No valid theme found, using fallback default for:', themeColorValue);
        const defaultTheme = getThemeByValue('#7c3aed') || {
            value: '#7c3aed',
            label: 'Purple (Default)',
            primary: '#7c3aed',
            background: '#faf7ff'
        };
        applyCustomTheme(defaultTheme);
        return defaultTheme;
    } catch (error) {
        console.error('Error loading theme:', error);
    }
    
    // Fallback to default
    const defaultTheme = getThemeByValue('#7c3aed');
    applyCustomTheme(defaultTheme);
    return defaultTheme;
};

// Global function to set database theme (called from app initialization)
let globalDatabaseThemeColor: string | undefined = undefined;
let globalIsAuthenticated: boolean = false;

export const setDatabaseTheme = (themeColor?: string, isAuthenticated: boolean = false) => {
    globalDatabaseThemeColor = themeColor;
    globalIsAuthenticated = isAuthenticated;
    
    // Apply immediately
    if (isAuthenticated) {
        console.log('Setting database theme as priority for authenticated user:', themeColor || 'none (clearing localStorage)');
        loadThemeFromSources(themeColor, isAuthenticated);
    } else {
        // For unauthenticated users, use normal logic
        loadThemeFromSources(themeColor, false);
    }
};

// Function to apply font family globally
export const applyFontFamily = (fontFamily: string) => {
    const root = document.documentElement;
    root.style.setProperty('--dynamic-font-family', fontFamily);
    console.log('Applied font family:', fontFamily);
};

const prefersDark = () => {
    // Always return false to prevent dark theme
    return false;
};

const prefersLight = () => {
    // Always return true to force light theme
    return true;
};

const setCookie = (name: string, value: string, days = 365) => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    // Always set light theme in cookie
    document.cookie = `appearance=light;path=/;max-age=${maxAge};SameSite=Lax`;
};

const applyTheme = (appearance: Appearance) => {
    // Always apply light theme, never dark
    document.documentElement.classList.remove('dark');
    
    // Also load any saved custom theme colors
    loadThemeFromSources(globalDatabaseThemeColor, globalIsAuthenticated); // Pass true for isAuthenticated
};

const mediaQuery = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: light)'); // Listen for light theme only
};

const handleSystemThemeChange = () => {
    // Always force light theme regardless of system preference
    applyTheme('light');
};

export function initializeTheme() {
    // Always initialize with light theme
    applyTheme('light');
    localStorage.setItem('appearance', 'light');
    setCookie('appearance', 'light');

    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
    
    // Listen for theme changes from the settings page
    if (typeof window !== 'undefined') {
        window.addEventListener('theme-changed', (event: any) => {
            console.log('Theme changed event received:', event.detail.theme);
        });
    }
}

export function useAppearance() {
    const [appearance, setAppearance] = useState<Appearance>('light');

    const updateAppearance = useCallback((mode: Appearance) => {
        // Always force light theme regardless of what's passed
        setAppearance('light');

        localStorage.setItem('appearance', 'light');
        setCookie('appearance', 'light');

        applyTheme('light');
    }, []);

    useEffect(() => {
        // Always use light theme
        updateAppearance('light');

        return () => mediaQuery()?.removeEventListener('change', handleSystemThemeChange);
    }, [updateAppearance]);

    return { appearance: 'light' as const, updateAppearance } as const;
}

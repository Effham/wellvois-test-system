// src/components/Appearance.tsx

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useForm, router, usePage } from '@inertiajs/react';
import { FormEventHandler, useRef, useState, useEffect } from 'react';
import { Pencil, Palette, RotateCcw } from 'lucide-react';
import InputError from '@/components/input-error';
import { applyFontFamily } from '@/hooks/use-appearance';
import { toast } from 'sonner';

const themeColors = [
    { 
        value: '#f3f4f6', 
        label: 'Light Gray', 
        colors: ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af'],
        primary: '#6b7280',
        background: '#f9fafb'
    },
    { 
        value: '#7c3aed', 
        label: 'Purple', 
        colors: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa'],
        primary: '#7c3aed',
        background: '#faf7ff'
    },
    { 
        value: '#10b981', 
        label: 'Green', 
        colors: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399'],
        primary: '#10b981',
        background: '#f0fdf4'
    },
    {  
        value: '#3b82f6', 
        label: 'Blue', 
        colors: ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6'],
        primary: '#3b82f6',
        background: '#eff6ff'
    },
    { 
        value: '#8b5cf6', 
        label: 'Violet', 
        colors: ['#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7'],
        primary: '#8b5cf6',
        background: '#faf5ff'
    },
    { 
        value: '#f59e0b', 
        label: 'Orange', 
        colors: ['#fff7ed', '#fed7aa', '#fdba74', '#fb923c', '#f97316'],
        primary: '#f59e0b',
        background: '#fffbeb'
    },
];

// Generate color palette from a base color
const generatePalette = (baseColor: string) => {
    // Convert hex to HSL for better color manipulation
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

    // Convert HSL back to hex
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

    // Generate 5 shades: very light, light, medium, base, dark
    const colors = [
        hslToHex(h, Math.max(10, s * 0.3), Math.min(95, l + 40)), // Very light
        hslToHex(h, Math.max(15, s * 0.5), Math.min(90, l + 25)), // Light  
        hslToHex(h, Math.max(20, s * 0.7), Math.min(80, l + 10)), // Medium
        hslToHex(h, s, l), // Base color
        hslToHex(h, Math.min(100, s * 1.1), Math.max(20, l - 10)), // Dark
    ];

    // Generate background color (very light tint)
    const background = hslToHex(h, Math.max(5, s * 0.2), Math.min(98, l + 45));

    return {
        colors,
        primary: baseColor,
        background,
        label: 'Custom Color'
    };
};

const fonts = [
    { value: 'Axiforma', label: 'Axiforma (Default)' },
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
];

// Convert hex to oklch for CSS variables
const hexToOklch = (hex: string): string => {
    // This is a simplified conversion. For production, you'd want a proper color conversion library
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

// Apply theme to CSS variables
const applyTheme = (theme: any, isPreview: boolean = true) => {
    const root = document.documentElement;
    
    root.style.setProperty('--primary', hexToOklch(theme.primary));
    root.style.setProperty('--sidebar-accent', theme.primary);
    root.style.setProperty('--background', hexToOklch(theme.background));
    
    console.log(`Applied theme ${isPreview ? '(preview)' : '(saved to database)'}:`, theme.label);
};

interface Props {
    appearanceSettings: Record<string, string>;
    tenantName: string;
}

export default function Appearance({ appearanceSettings, tenantName }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { organizationSettings } = usePage().props as any;

    // Comprehensive logging for debugging
    console.log('=== APPEARANCE COMPONENT DEBUG ===');
    console.log('Props received:');
    console.log('- appearanceSettings:', appearanceSettings);
    console.log('- tenantName:', tenantName);
    console.log('Global page props:');
    console.log('- organizationSettings:', organizationSettings);
    console.log('- organizationSettings.appearance:', organizationSettings?.appearance);

    // Check all possible logo sources
    const allLogoPaths = {
        prop_appearance_logo_path: appearanceSettings.appearance_logo_path,
        prop_logo_path: appearanceSettings.logo_path,
        global_appearance_logo_path: organizationSettings?.appearance?.appearance_logo_path,
        global_logo_path: organizationSettings?.appearance?.logo_path,
    };
    console.log('All possible logo paths:', allLogoPaths);

    const { data, setData, post, processing, errors, progress } = useForm({
        appearance_theme_color: appearanceSettings.appearance_theme_color || '#7c3aed',
        appearance_font_family: appearanceSettings.appearance_font_family || 'Axiforma',
        logo: null as File | null,
    });

    // Custom color states
    const [isCustomColor, setIsCustomColor] = useState(false);
    const [customColor, setCustomColor] = useState('#7c3aed');
    const [customPalette, setCustomPalette] = useState(generatePalette('#7c3aed'));

    // Apply database theme on component mount
    useEffect(() => {
        const databaseThemeColor = appearanceSettings.appearance_theme_color;
        if (databaseThemeColor) {
            const selectedTheme = themeColors.find(theme => theme.value === databaseThemeColor);
            if (selectedTheme) {
                applyTheme(selectedTheme, false);
                setIsCustomColor(false);
            } else {
                if (databaseThemeColor.match(/^#[0-9A-Fa-f]{6}$/)) {
                    const customTheme = generatePalette(databaseThemeColor);
                    applyTheme(customTheme, false);
                    setIsCustomColor(true);
                    setCustomColor(databaseThemeColor);
                    setCustomPalette(customTheme);
                }
            }
        }
    }, [appearanceSettings.appearance_theme_color]);

    // Real-time custom color preview
    useEffect(() => {
        if (isCustomColor && customColor.match(/^#[0-9A-Fa-f]{6}$/)) {
            const newPalette = generatePalette(customColor);
            setCustomPalette(newPalette);
            applyTheme(newPalette, true);
        }
    }, [customColor, isCustomColor]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('organization.appearance.update'), data, {
            onSuccess: () => {
                console.log('Theme successfully saved to database.');
            }
        });
    };

    const handleThemeChange = (themeValue: string) => {
        const selectedTheme = themeColors.find(theme => theme.value === themeValue);
        if (selectedTheme) {
            applyTheme(selectedTheme, true);
            setData('appearance_theme_color', themeValue);
            setIsCustomColor(false);
            setCustomColor('#7c3aed');
        }
    };

    const handleCustomColorChange = (color: string) => {
        if (!color.match(/^#[0-9A-Fa-f]{6}$/)) {
            return;
        }

        setCustomColor(color);
        setData('appearance_theme_color', color);
        setIsCustomColor(true);
        
        const customTheme = generatePalette(color);
        setCustomPalette(customTheme);
        applyTheme(customTheme, true);
    };

    const resetToPresetTheme = () => {
        const defaultTheme = themeColors[1];
        handleThemeChange(defaultTheme.value);
    };

    const handleImageUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file.');
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                toast.error('File size must be less than 2MB.');
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            // Manually set the logo file to the form data
            setData('logo', file);
            
            // Immediately post the logo to the dedicated upload route
            router.post(route('organization.logo.upload'), {
                logo: file,
            }, {
                forceFormData: true,
                onSuccess: (page) => {
                    console.log('OrganizationAppearance: Logo uploaded and database updated successfully.');
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                    // Refresh the page to update the global logo prop
                    router.reload({ only: ['organizationSettings'] });
                },
                onError: (errors) => {
                    console.error('OrganizationAppearance: Logo upload failed', { errors });
                    setData('logo', null);
                    // Show error toast to user
                    const errorMessage = errors.logo || 'Failed to upload logo. Please try again.';
                    toast.error(errorMessage);
                },
                onProgress: (uploadProgress) => {
                    console.log('Upload Progress:', uploadProgress.percentage);
                },
            });
        }
    };
    
    // Try all possible logo sources with priority
    const logoUrl =
        appearanceSettings.appearance_logo_path ||
        organizationSettings?.appearance?.appearance_logo_path ||
        appearanceSettings.logo_path ||
        organizationSettings?.appearance?.logo_path;

    console.log('Final selected logo URL:', logoUrl);
    console.log('Logo selection priority check:');
    console.log('1. appearanceSettings.appearance_logo_path:', appearanceSettings.appearance_logo_path);
    console.log('2. organizationSettings?.appearance?.appearance_logo_path:', organizationSettings?.appearance?.appearance_logo_path);
    console.log('3. appearanceSettings.logo_path:', appearanceSettings.logo_path);
    console.log('4. organizationSettings?.appearance?.logo_path:', organizationSettings?.appearance?.logo_path);

    // Test if it's a CORS/network issue by trying a simple test image
    console.log('Testing S3 URL accessibility...');
    if (logoUrl) {
        // Create a test image to check if the URL is accessible
        const testImg = new Image();
        testImg.onload = () => console.log('✅ S3 URL is accessible via Image object');
        testImg.onerror = (e) => console.error('❌ S3 URL failed in Image object:', e);
        testImg.src = logoUrl;
    }

    return (
        <form onSubmit={submit}>
            <div className="px-6 py-4 space-y-8">
                {/* Update Logo */}
                <div className="space-y-4">
                    <Label className="font-normal">Update Logo</Label>
                    <div className="relative">
                        {logoUrl ? (
                            <div className="relative w-64 h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                                <img
                                    src={logoUrl}
                                    alt="Company Logo"
                                    className="w-full h-full object-contain"
                                    onLoad={() => console.log('✅ Logo loaded successfully:', logoUrl)}
                                    onError={(e) => {
                                        console.error('❌ Logo failed to load:', logoUrl);
                                        console.error('Error details:', e);
                                        // Test if URL is accessible
                                        fetch(logoUrl, { method: 'HEAD' })
                                            .then(response => {
                                                console.log('Fetch test - Status:', response.status);
                                                console.log('Fetch test - Headers:', [...response.headers.entries()]);
                                            })
                                            .catch(err => console.error('Fetch test failed:', err));
                                    }}
                                />
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={handleImageUpload}
                                                disabled={processing}
                                                className="absolute top-2 right-2 w-8 h-8 bg-sidebar-accent text-sidebar-accent-foreground rounded-full flex items-center justify-center hover:bg-sidebar-accent/90 disabled:opacity-50 shadow-lg z-10"
                                            >
                                                {processing && progress ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Pencil className="w-4 h-4" />
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{processing && progress ? `Uploading... ${progress.percentage}%` : 'Change logo'}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        ) : (
                            <div className="relative flex items-center justify-center w-64 h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                                <div className="text-center">
                                    <div className="text-sm font-medium uppercase">{tenantName}</div>
                                    <div className="text-xs text-gray-500">Click to upload logo</div>
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={handleImageUpload}
                                                disabled={processing}
                                                className="absolute top-2 right-2 w-8 h-8 bg-sidebar-accent text-sidebar-accent-foreground rounded-full flex items-center justify-center hover:bg-sidebar-accent/90 disabled:opacity-50 shadow-lg z-10"
                                            >
                                                {processing && progress ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Pencil className="w-4 h-4" />
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{processing && progress ? `Uploading... ${progress.percentage}%` : 'Upload logo'}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                    {/* Error Messages */}
                    <InputError message={errors.logo} />
                </div>
                
                {/* Select Theme */}
                <div className="space-y-4">
                    <Label className="font-normal">Select Theme</Label>
                    <div className="space-y-3">
                        {/* Preset Themes */}
                        {themeColors.map((theme) => (
                            <div key={theme.value} className="flex items-center space-x-3">
                                <div 
                                    className="flex cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => handleThemeChange(theme.value)}
                                >
                                    {theme.colors.map((color, index) => (
                                        <div
                                            key={index}
                                            className="w-8 h-8 first:rounded-l-md last:rounded-r-md"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange(theme.value)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                        !isCustomColor && data.appearance_theme_color === theme.value 
                                            ? 'bg-blue-600 text-white' 
                                            : 'border border-gray-300 hover:border-gray-400'
                                    }`}
                                >
                                    {!isCustomColor && data.appearance_theme_color === theme.value && '✓'}
                                </button>
                                <span className="text-sm text-gray-600">{theme.label}</span>
                            </div>
                        ))}

                        {/* Custom Color Section */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex items-center space-x-3 mb-3">
                                <Palette className="w-5 h-5 text-gray-500" />
                                <Label className="text-base font-normal">Custom Color</Label>
                                {isCustomColor && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetToPresetTheme}
                                        className="ml-auto text-xs"
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        Reset to Preset
                                    </Button>
                                )}
                            </div>

                            <div className="flex items-center space-x-3">
                                {/* Custom Color Palette Preview */}
                                <div className="flex">
                                    {customPalette.colors.map((color, index) => (
                                        <div
                                            key={index}
                                            className="w-8 h-8 first:rounded-l-md last:rounded-r-md"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                
                                {/* Custom Color Indicator */}
                                <button
                                    type="button"
                                    onClick={() => setIsCustomColor(true)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                        isCustomColor 
                                            ? 'bg-blue-600 text-white' 
                                            : 'border border-gray-300 hover:border-gray-400'
                                    }`}
                                >
                                    {isCustomColor && '✓'}
                                </button>
                                
                                <span className="text-sm text-gray-600">Custom Color</span>
                            </div>

                            {/* Color Picker Input */}
                            <div className="mt-3 flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="custom-color" className="text-sm font-normal">Pick Color:</Label>
                                    <div className="relative">
                                        <Input
                                            id="custom-color"
                                            type="color"
                                            value={customColor}
                                            onChange={(e) => handleCustomColorChange(e.target.value)}
                                            className="w-12 h-8 p-1 border border-gray-300 rounded cursor-pointer"
                                        />
                                    </div>
                                    <Input
                                        type="text"
                                        value={customColor}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setCustomColor(value);
                                            
                                            if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                                setData('appearance_theme_color', value);
                                                setIsCustomColor(true);
                                                
                                                const customTheme = generatePalette(value);
                                                setCustomPalette(customTheme);
                                                applyTheme(customTheme, true);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const value = e.target.value;
                                            if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                                handleCustomColorChange(value);
                                            } else {
                                                const currentTheme = data.appearance_theme_color;
                                                if (currentTheme.match(/^#[0-9A-Fa-f]{6}$/)) {
                                                    setCustomColor(currentTheme);
                                                } else {
                                                    setCustomColor('#7c3aed');
                                                }
                                            }
                                        }}
                                        placeholder="#7c3aed"
                                        className="w-24 text-sm text-muted-foreground"
                                    />
                                </div>
                                
                                {/* Live Preview Badge */}
                                {isCustomColor && (
                                    <div className="flex items-center space-x-1 px-2 py-1 bg-green-50 rounded-full">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-green-700">Live Preview</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Select Font */}
                <div className="space-y-4">
                    <Label htmlFor="font" className="font-normal">Select Font <span className="text-gray-500">(optional)</span></Label>
                    <Select
                        value={data.appearance_font_family}
                        onValueChange={(value) => {
                            setData('appearance_font_family', value);
                            applyFontFamily(value);
                        }}
                    >
                        <SelectTrigger className="w-full text-muted-foreground">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {fonts.map((font) => (
                                <SelectItem key={font.value} value={font.value}>
                                    {font.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={processing} size="save">
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
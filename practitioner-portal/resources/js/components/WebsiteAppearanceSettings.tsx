import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
    Palette, 
    Image, 
    Type,
    Save,
    Eye,
    Upload,
    X,
    Loader2
} from 'lucide-react';

interface AppearanceSettings {
    heroSection: {
        enabled: boolean;
        title: string;
        subtitle: string;
        backgroundImage?: string;
    };
    footer: {
        enabled: boolean;
        copyrightText: string;
        additionalLinks: Array<{
            label: string;
            url: string;
        }>;
    };
    colors: {
        useCustom: boolean;
        primaryColor: string;
        accentColor: string;
    };
    typography: {
        useCustom: boolean;
        headingFont: string;
        bodyFont: string;
    };
}

const DEFAULT_SETTINGS: AppearanceSettings = {
    heroSection: {
        enabled: true,
        title: 'Welcome to Our Healthcare Practice',
        subtitle: 'Providing comprehensive care with a focus on your health and wellbeing',
    },
    footer: {
        enabled: true,
        copyrightText: 'All rights reserved.',
        additionalLinks: [],
    },
    colors: {
        useCustom: false,
        primaryColor: '#7c3aed',
        accentColor: '#10b981',
    },
    typography: {
        useCustom: false,
        headingFont: 'Inter',
        bodyFont: 'Inter',
    },
};

export default function WebsiteAppearanceSettings() {
    const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load settings from database on component mount
    useEffect(() => {
        loadAppearanceSettings();
    }, []);

    const loadAppearanceSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/website-settings/appearance');
            const data = await response.json();
            
            if (data) {
                // Merge with defaults to ensure all properties exist
                setSettings({
                    heroSection: {
                        ...DEFAULT_SETTINGS.heroSection,
                        enabled: data.hero_section?.enabled ?? DEFAULT_SETTINGS.heroSection.enabled,
                        title: data.hero_section?.title ?? DEFAULT_SETTINGS.heroSection.title,
                        subtitle: data.hero_section?.subtitle ?? DEFAULT_SETTINGS.heroSection.subtitle,
                        backgroundImage: data.hero_section?.background_image ?? DEFAULT_SETTINGS.heroSection.backgroundImage,
                    },
                    footer: {
                        ...DEFAULT_SETTINGS.footer,
                        enabled: data.footer?.enabled ?? DEFAULT_SETTINGS.footer.enabled,
                        copyrightText: data.footer?.copyright_text ?? DEFAULT_SETTINGS.footer.copyrightText,
                        additionalLinks: data.footer?.additional_links ?? DEFAULT_SETTINGS.footer.additionalLinks,
                    },
                    colors: {
                        ...DEFAULT_SETTINGS.colors,
                        useCustom: data.colors?.use_custom ?? DEFAULT_SETTINGS.colors.useCustom,
                        primaryColor: data.colors?.primary_color ?? DEFAULT_SETTINGS.colors.primaryColor,
                        accentColor: data.colors?.accent_color ?? DEFAULT_SETTINGS.colors.accentColor,
                    },
                    typography: {
                        ...DEFAULT_SETTINGS.typography,
                        useCustom: data.typography?.use_custom ?? DEFAULT_SETTINGS.typography.useCustom,
                        headingFont: data.typography?.heading_font ?? DEFAULT_SETTINGS.typography.headingFont,
                        bodyFont: data.typography?.body_font ?? DEFAULT_SETTINGS.typography.bodyFont,
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load appearance settings:', error);
            toast.error('Failed to load appearance settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = (path: string, value: any) => {
        const keys = path.split('.');
        setSettings(prev => {
            const newSettings = { ...prev };
            let current: any = newSettings;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return newSettings;
        });
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const response = await fetch('/api/website-settings/appearance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    hero_section: {
                        enabled: settings.heroSection.enabled,
                        title: settings.heroSection.title,
                        subtitle: settings.heroSection.subtitle,
                        background_image: settings.heroSection.backgroundImage,
                    },
                    colors: {
                        use_custom: settings.colors.useCustom,
                        primary_color: settings.colors.primaryColor,
                        accent_color: settings.colors.accentColor,
                    },
                    typography: {
                        use_custom: settings.typography.useCustom,
                        heading_font: settings.typography.headingFont,
                        body_font: settings.typography.bodyFont,
                    },
                    footer: {
                        enabled: settings.footer.enabled,
                        copyright_text: settings.footer.copyrightText,
                        additional_links: settings.footer.additionalLinks,
                    },
                }),
            });

            if (response.ok) {
                setHasChanges(false);
                toast.success('Appearance settings saved successfully');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save appearance settings:', error);
            toast.error('Failed to save appearance settings');
        } finally {
            setSaving(false);
        }
    };

    const addFooterLink = () => {
        const newLinks = [...settings.footer.additionalLinks, { label: '', url: '' }];
        handleSettingChange('footer.additionalLinks', newLinks);
    };

    const removeFooterLink = (index: number) => {
        const newLinks = settings.footer.additionalLinks.filter((_, i) => i !== index);
        handleSettingChange('footer.additionalLinks', newLinks);
    };

    const updateFooterLink = (index: number, field: 'label' | 'url', value: string) => {
        const newLinks = [...settings.footer.additionalLinks];
        newLinks[index][field] = value;
        handleSettingChange('footer.additionalLinks', newLinks);
    };

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading appearance settings...</span>
                </div>
            ) : (
                <>
                    {/* Hero Section Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Image className="h-5 w-5 text-primary" />
                                Hero Section
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Configure the main banner area of your public portal
                            </p>
                        </div>
                        <Switch
                            checked={settings.heroSection.enabled}
                            onCheckedChange={(enabled) => handleSettingChange('heroSection.enabled', enabled)}
                        />
                    </div>
                </CardHeader>
                {settings.heroSection.enabled && (
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="hero-title">Main Title</Label>
                            <Input
                                id="hero-title"
                                value={settings.heroSection.title}
                                onChange={(e) => handleSettingChange('heroSection.title', e.target.value)}
                                placeholder="Enter the main title for your hero section"
                            />
                        </div>
                        <div>
                            <Label htmlFor="hero-subtitle">Subtitle</Label>
                            <Textarea
                                id="hero-subtitle"
                                value={settings.heroSection.subtitle}
                                onChange={(e) => handleSettingChange('heroSection.subtitle', e.target.value)}
                                placeholder="Enter a descriptive subtitle"
                                className="min-h-[80px]"
                            />
                        </div>
                        <div>
                            <Label>Background Image</Label>
                            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600 mb-2">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-xs text-gray-500">
                                    PNG, JPG, GIF up to 10MB
                                </p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Color Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="h-5 w-5 text-primary" />
                                Color Scheme
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Customize the color scheme for your public portal
                            </p>
                        </div>
                        <Switch
                            checked={settings.colors.useCustom}
                            onCheckedChange={(useCustom) => handleSettingChange('colors.useCustom', useCustom)}
                        />
                    </div>
                </CardHeader>
                {settings.colors.useCustom && (
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="primary-color">Primary Color</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        id="primary-color"
                                        type="color"
                                        value={settings.colors.primaryColor}
                                        onChange={(e) => handleSettingChange('colors.primaryColor', e.target.value)}
                                        className="w-16 h-10 p-1"
                                    />
                                    <Input
                                        value={settings.colors.primaryColor}
                                        onChange={(e) => handleSettingChange('colors.primaryColor', e.target.value)}
                                        placeholder="#7c3aed"
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="accent-color">Accent Color</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        id="accent-color"
                                        type="color"
                                        value={settings.colors.accentColor}
                                        onChange={(e) => handleSettingChange('colors.accentColor', e.target.value)}
                                        className="w-16 h-10 p-1"
                                    />
                                    <Input
                                        value={settings.colors.accentColor}
                                        onChange={(e) => handleSettingChange('colors.accentColor', e.target.value)}
                                        placeholder="#10b981"
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground mb-2">Color Preview:</p>
                            <div className="flex gap-4 items-center">
                                <div 
                                    className="w-8 h-8 rounded border"
                                    style={{ backgroundColor: settings.colors.primaryColor }}
                                ></div>
                                <span className="text-sm">Primary</span>
                                <div 
                                    className="w-8 h-8 rounded border"
                                    style={{ backgroundColor: settings.colors.accentColor }}
                                ></div>
                                <span className="text-sm">Accent</span>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Typography Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Type className="h-5 w-5 text-primary" />
                                Typography
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Customize fonts for headings and body text
                            </p>
                        </div>
                        <Switch
                            checked={settings.typography.useCustom}
                            onCheckedChange={(useCustom) => handleSettingChange('typography.useCustom', useCustom)}
                        />
                    </div>
                </CardHeader>
                {settings.typography.useCustom && (
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="heading-font">Heading Font</Label>
                                <Input
                                    id="heading-font"
                                    value={settings.typography.headingFont}
                                    onChange={(e) => handleSettingChange('typography.headingFont', e.target.value)}
                                    placeholder="Inter, Arial, sans-serif"
                                />
                            </div>
                            <div>
                                <Label htmlFor="body-font">Body Font</Label>
                                <Input
                                    id="body-font"
                                    value={settings.typography.bodyFont}
                                    onChange={(e) => handleSettingChange('typography.bodyFont', e.target.value)}
                                    placeholder="Inter, Arial, sans-serif"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground mb-2">Font Preview:</p>
                            <div className="space-y-2">
                                <h3 
                                    className="text-lg font-bold"
                                    style={{ fontFamily: settings.typography.headingFont }}
                                >
                                    Heading Font Example
                                </h3>
                                <p 
                                    className="text-sm"
                                    style={{ fontFamily: settings.typography.bodyFont }}
                                >
                                    This is how body text will appear with your selected font.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Footer Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Footer Configuration</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Customize the footer section of your public portal
                            </p>
                        </div>
                        <Switch
                            checked={settings.footer.enabled}
                            onCheckedChange={(enabled) => handleSettingChange('footer.enabled', enabled)}
                        />
                    </div>
                </CardHeader>
                {settings.footer.enabled && (
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="copyright-text">Copyright Text</Label>
                            <Input
                                id="copyright-text"
                                value={settings.footer.copyrightText}
                                onChange={(e) => handleSettingChange('footer.copyrightText', e.target.value)}
                                placeholder="All rights reserved."
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label>Additional Footer Links</Label>
                                <Button size="sm" variant="outline" onClick={addFooterLink}>
                                    Add Link
                                </Button>
                            </div>
                            {settings.footer.additionalLinks.map((link, index) => (
                                <div key={index} className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Label>Label</Label>
                                        <Input
                                            value={link.label}
                                            onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                                            placeholder="Privacy Policy"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Label>URL</Label>
                                        <Input
                                            value={link.url}
                                            onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
                                            placeholder="/privacy"
                                        />
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => removeFooterLink(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Preview & Save */}
            <div className="flex items-center justify-between">
                <Button variant="outline" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview Changes
                </Button>
                
                <Button 
                    onClick={handleSave} 
                    disabled={!hasChanges || saving}
                    className="flex items-center gap-2"
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {saving ? 'Saving...' : 'Save Appearance Settings'}
                </Button>
            </div>

            {hasChanges && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                                <span className="text-sm font-medium text-orange-800">
                                    You have unsaved changes
                                </span>
                            </div>
                            <Button size="sm" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
                </>
            )}
        </div>
    );
} 
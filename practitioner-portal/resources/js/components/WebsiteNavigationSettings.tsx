import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
    ArrowUp,
    ArrowDown,
    Eye, 
    EyeOff,
    Settings,
    Save,
    RotateCcw,
    Loader2
} from 'lucide-react';

interface NavigationItem {
    id: string;
    label: string;
    enabled: boolean;
    customLabel?: string;
    order: number;
}

const DEFAULT_NAVIGATION_ITEMS: NavigationItem[] = [
    { id: 'services', label: 'Services', enabled: true, order: 1 },
    { id: 'locations', label: 'Locations', enabled: true, order: 2 },
    { id: 'staff', label: 'Staff', enabled: true, order: 3 },
    { id: 'assess-yourself', label: 'Assess Yourself', enabled: true, order: 4 },
    { id: 'book-appointment', label: 'Book Appointment', enabled: true, order: 5 },
];

export default function WebsiteNavigationSettings() {
    const [navigationItems, setNavigationItems] = useState<NavigationItem[]>(DEFAULT_NAVIGATION_ITEMS);
    const [hasChanges, setHasChanges] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load settings from database on component mount
    useEffect(() => {
        loadNavigationSettings();
    }, []);

    const loadNavigationSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/website-settings/navigation');
            const data = await response.json();
            
            if (data.navigation_items) {
                setNavigationItems(data.navigation_items);
            }
        } catch (error) {
            console.error('Failed to load navigation settings:', error);
            toast.error('Failed to load navigation settings');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleItem = (id: string) => {
        setNavigationItems(prev => 
            prev.map(item => 
                item.id === id ? { ...item, enabled: !item.enabled } : item
            )
        );
        setHasChanges(true);
    };

    const handleCustomLabelChange = (id: string, customLabel: string) => {
        setNavigationItems(prev => 
            prev.map(item => 
                item.id === id ? { ...item, customLabel } : item
            )
        );
        setHasChanges(true);
    };

    const moveItem = (id: string, direction: 'up' | 'down') => {
        const sortedItems = [...navigationItems].sort((a, b) => a.order - b.order);
        const currentIndex = sortedItems.findIndex(item => item.id === id);
        
        if (
            (direction === 'up' && currentIndex === 0) ||
            (direction === 'down' && currentIndex === sortedItems.length - 1)
        ) {
            return;
        }

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const [movedItem] = sortedItems.splice(currentIndex, 1);
        sortedItems.splice(newIndex, 0, movedItem);

        // Update order values
        const updatedItems = sortedItems.map((item, index) => ({
            ...item,
            order: index + 1
        }));

        setNavigationItems(updatedItems);
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const response = await fetch('/api/website-settings/navigation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    navigation_items: navigationItems
                }),
            });

            if (response.ok) {
                setHasChanges(false);
                toast.success('Navigation settings saved successfully');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save navigation settings:', error);
            toast.error('Failed to save navigation settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setNavigationItems(DEFAULT_NAVIGATION_ITEMS);
        setHasChanges(true);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                <span className="hidden sm:inline">Navigation Menu Configuration</span>
                                <span className="sm:hidden">Navigation Menu</span>
                            </CardTitle>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                Customize which menu items appear in your public portal navigation
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs sm:text-sm">
                                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Reset to Default</span>
                                <span className="sm:hidden ml-2">Reset</span>
                            </Button>
                            <Button 
                                onClick={handleSave} 
                                disabled={!hasChanges || saving}
                                size="sm"
                                className="text-xs sm:text-sm"
                            >
                                {saving ? (
                                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                )}
                                <span className="ml-2 sm:ml-0">{saving ? 'Saving...' : 'Save Changes'}</span>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" />
                            <span className="text-sm sm:text-base">Loading navigation settings...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-xs sm:text-sm text-muted-foreground">
                                Use the up/down arrows to reorder menu items. Toggle switches to show/hide items.
                            </div>

                        <div className="space-y-3">
                            {navigationItems
                                .sort((a, b) => a.order - b.order)
                                .map((item, index) => (
                                <div
                                    key={item.id}
                                    className="p-3 sm:p-4 border rounded-lg bg-card"
                                >
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                                        {/* Reorder Controls */}
                                        <div className="flex sm:flex-col gap-2 sm:gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveItem(item.id, 'up')}
                                                disabled={index === 0}
                                                className="h-8 w-8 sm:h-6 sm:w-6 p-0"
                                            >
                                                <ArrowUp className="h-3 w-3 sm:h-3 sm:w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveItem(item.id, 'down')}
                                                disabled={index === navigationItems.length - 1}
                                                className="h-8 w-8 sm:h-6 sm:w-6 p-0"
                                            >
                                                <ArrowDown className="h-3 w-3 sm:h-3 sm:w-3" />
                                            </Button>
                                        </div>

                                        {/* Enable/Disable Switch */}
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                checked={item.enabled}
                                                onCheckedChange={() => handleToggleItem(item.id)}
                                            />
                                            {item.enabled ? (
                                                <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                            ) : (
                                                <EyeOff className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                                            )}
                                        </div>

                                        {/* Item Details */}
                                        <div className="flex-1 grid grid-cols-1 gap-3 sm:gap-4">
                                            <div>
                                                <Label className="text-xs sm:text-sm font-medium">
                                                    Default Label
                                                </Label>
                                                <p className="text-xs sm:text-sm text-muted-foreground">
                                                    {item.label}
                                                </p>
                                            </div>
                                            <div>
                                                <Label htmlFor={`custom-${item.id}`} className="text-xs sm:text-sm font-medium">
                                                    Custom Label (Optional)
                                                </Label>
                                                <Input
                                                    id={`custom-${item.id}`}
                                                    value={item.customLabel || ''}
                                                    onChange={(e) => 
                                                        handleCustomLabelChange(item.id, e.target.value)
                                                    }
                                                    placeholder={`Leave blank to use "${item.label}"`}
                                                    disabled={!item.enabled}
                                                    className="mt-1 text-xs sm:text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <Badge 
                                            variant={item.enabled ? "default" : "secondary"}
                                            className="self-start sm:ml-auto text-xs"
                                        >
                                            {item.enabled ? 'Visible' : 'Hidden'}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    )}
                </CardContent>
            </Card>

            {/* Preview Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg sm:text-xl">Navigation Preview</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        This is how your navigation menu will appear to visitors
                    </p>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                    <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
                        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                            <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                                Navigation:
                            </div>
                            {navigationItems
                                .filter(item => item.enabled)
                                .sort((a, b) => a.order - b.order)
                                .map((item, index) => (
                                <React.Fragment key={item.id}>
                                    <span className="text-xs sm:text-sm font-medium">
                                        {item.customLabel || item.label}
                                    </span>
                                    {index < navigationItems.filter(i => i.enabled).length - 1 && (
                                        <span className="text-muted-foreground text-xs sm:text-sm">•</span>
                                    )}
                                </React.Fragment>
                            ))}
                            {navigationItems.filter(item => item.enabled).length === 0 && (
                                <span className="text-xs sm:text-sm text-muted-foreground italic">
                                    No navigation items enabled
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {hasChanges && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                                <span className="text-xs sm:text-sm font-medium text-orange-800">
                                    You have unsaved changes
                                </span>
                            </div>
                            <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs sm:text-sm w-full sm:w-auto">
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
    Layout, 
    LayoutGrid, 
    LayoutList,
    Columns,
    Save,
    Monitor,
    Smartphone,
    Tablet,
    Loader2
} from 'lucide-react';

interface LayoutOption {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    preview: string;
    features: string[];
}

const LAYOUT_OPTIONS: LayoutOption[] = [
    {
        id: 'classic',
        name: 'Classic Layout',
        description: 'Traditional layout with filters above the content',
        icon: <Layout className="h-5 w-5" />,
        preview: '/api/placeholder/400/200', // Placeholder for layout preview
        features: [
            'Horizontal filter bar',
            'Grid view for content',
            'Traditional navigation',
            'Best for desktop users'
        ]
    },
    {
        id: 'sidebar',
        name: 'Sidebar Layout',
        description: 'Modern layout with filters in a left sidebar',
        icon: <Columns className="h-5 w-5" />,
        preview: '/api/placeholder/400/200',
        features: [
            'Left sidebar filters',
            'Main content area',
            'Better space utilization',
            'Mobile-friendly'
        ]
    },
    {
        id: 'compact',
        name: 'Compact Layout',
        description: 'Minimal layout with collapsible filters',
        icon: <LayoutList className="h-5 w-5" />,
        preview: '/api/placeholder/400/200',
        features: [
            'Collapsible filter panel',
            'List view for content',
            'Minimal design',
            'Optimized for mobile'
        ]
    }
];

export default function WebsiteLayoutSettings() {
    const [selectedLayout, setSelectedLayout] = useState('sidebar'); // Default to sidebar (current implementation)
    const [hasChanges, setHasChanges] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load settings from database on component mount
    useEffect(() => {
        loadLayoutSettings();
    }, []);

    const loadLayoutSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/website-settings/layout');
            const data = await response.json();
            
            if (data.selected_layout) {
                setSelectedLayout(data.selected_layout);
            }
        } catch (error) {
            console.error('Failed to load layout settings:', error);
            toast.error('Failed to load layout settings');
        } finally {
            setLoading(false);
        }
    };

    const handleLayoutChange = (layoutId: string) => {
        setSelectedLayout(layoutId);
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const response = await fetch('/api/website-settings/layout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    selected_layout: selectedLayout
                }),
            });

            if (response.ok) {
                setHasChanges(false);
                toast.success('Layout settings saved successfully');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save layout settings:', error);
            toast.error('Failed to save layout settings');
        } finally {
            setSaving(false);
        }
    };

    const selectedLayoutOption = LAYOUT_OPTIONS.find(layout => layout.id === selectedLayout);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-primary" />
                                Layout Configuration
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Choose how your public portal pages are laid out
                            </p>
                        </div>
                        <Button 
                            onClick={handleSave} 
                            disabled={!hasChanges || saving}
                            size="sm"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            {saving ? 'Saving...' : 'Save Layout'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span>Loading layout settings...</span>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                        {LAYOUT_OPTIONS.map((layout) => (
                            <div key={layout.id} className="relative">
                                <Label 
                                    htmlFor={layout.id}
                                    className="cursor-pointer"
                                >
                                    <div className={`p-6 border-2 rounded-lg transition-colors ${
                                        selectedLayout === layout.id 
                                            ? 'border-primary bg-primary/5' 
                                            : 'border-border hover:border-primary/50'
                                    }`}>
                                        <div className="flex items-start gap-4">
                                            <input
                                                type="radio"
                                                value={layout.id}
                                                id={layout.id}
                                                name="layoutSelection"
                                                checked={selectedLayout === layout.id}
                                                onChange={() => handleLayoutChange(layout.id)}
                                                className="mt-1 h-4 w-4 text-primary"
                                            />
                                                
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="text-primary">
                                                            {layout.icon}
                                                        </div>
                                                        <h3 className="font-semibold text-lg">
                                                            {layout.name}
                                                        </h3>
                                                        {selectedLayout === layout.id && (
                                                            <Badge className="bg-primary">Current</Badge>
                                                        )}
                                                    </div>
                                                    
                                                    <p className="text-muted-foreground mb-4">
                                                        {layout.description}
                                                    </p>
                                                    
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Features:</Label>
                                                        <ul className="text-sm text-muted-foreground space-y-1">
                                                            {layout.features.map((feature, index) => (
                                                                <li key={index} className="flex items-center gap-2">
                                                                    <div className="h-1 w-1 bg-primary rounded-full"></div>
                                                                    {feature}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                                
                                                {/* Website Layout Preview */}
                                                <div className="hidden md:block w-48 h-24 bg-gray-50 rounded border border-gray-200 overflow-hidden">
                                                    {layout.id === 'classic' && (
                                                        <div className="h-full space-y-0.5 text-xs">
                                                            {/* Header with logo and nav */}
                                                            <div className="bg-white border-b px-1 py-0.5 flex items-center justify-between">
                                                                <div className="flex items-center gap-0.5">
                                                                    <div className="w-1.5 h-1.5 bg-primary rounded"></div>
                                                                    <div className="text-[6px] text-gray-600">Clinic</div>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <div className="text-[5px] text-gray-500">Services</div>
                                                                    <div className="text-[5px] text-gray-500">Staff</div>
                                                                    <div className="text-[5px] bg-primary text-white px-1 rounded-sm">Book</div>
                                                                </div>
                                                            </div>
                                                            {/* Hero banner */}
                                                            <div className="bg-primary/10 px-1 py-1 text-center">
                                                                <div className="text-[6px] font-medium text-gray-700">Welcome to Our Clinic</div>
                                                                <div className="text-[5px] text-gray-500">Healthcare services</div>
                                                            </div>
                                                            {/* Content sections */}
                                                            <div className="px-1 space-y-0.5 flex-1">
                                                                <div className="grid grid-cols-3 gap-0.5">
                                                                    <div className="bg-white border rounded px-0.5 py-0.5">
                                                                        <div className="text-[5px] text-gray-600">Services</div>
                                                                    </div>
                                                                    <div className="bg-white border rounded px-0.5 py-0.5">
                                                                        <div className="text-[5px] text-gray-600">Team</div>
                                                                    </div>
                                                                    <div className="bg-white border rounded px-0.5 py-0.5">
                                                                        <div className="text-[5px] text-gray-600">Contact</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {layout.id === 'sidebar' && (
                                                        <div className="h-full flex text-xs">
                                                            {/* Header */}
                                                            <div className="flex-1 space-y-0.5">
                                                                <div className="bg-white border-b px-1 py-0.5 flex items-center justify-between">
                                                                    <div className="flex items-center gap-0.5">
                                                                        <div className="w-1.5 h-1.5 bg-primary rounded"></div>
                                                                        <div className="text-[6px] text-gray-600">Clinic</div>
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        <div className="text-[5px] text-gray-500">Services</div>
                                                                        <div className="text-[5px] text-gray-500">Staff</div>
                                                                        <div className="text-[5px] bg-primary text-white px-1 rounded-sm">Book</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-1">
                                                                    {/* Sidebar with filters */}
                                                                    <div className="w-8 bg-gray-100 border-r p-0.5 space-y-0.5">
                                                                        <div className="text-[5px] text-gray-600 font-medium">Filters</div>
                                                                        <div className="text-[4px] text-gray-500">Type</div>
                                                                        <div className="text-[4px] text-gray-500">Location</div>
                                                                        <div className="text-[4px] text-gray-500">Price</div>
                                                                    </div>
                                                                    {/* Main content */}
                                                                    <div className="flex-1 p-0.5 space-y-0.5">
                                                                        <div className="text-[6px] font-medium text-gray-700">Our Services</div>
                                                                        <div className="grid grid-cols-2 gap-0.5">
                                                                            <div className="bg-white border rounded px-0.5 py-0.5">
                                                                                <div className="text-[5px] text-gray-600">Consultation</div>
                                                                            </div>
                                                                            <div className="bg-white border rounded px-0.5 py-0.5">
                                                                                <div className="text-[5px] text-gray-600">Check-up</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {layout.id === 'compact' && (
                                                        <div className="h-full space-y-0.5 text-xs">
                                                            {/* Compact header with menu */}
                                                            <div className="bg-white border-b px-1 py-0.5 flex items-center justify-between">
                                                                <div className="flex items-center gap-0.5">
                                                                    <div className="w-1.5 h-1.5 bg-primary rounded"></div>
                                                                    <div className="text-[6px] text-gray-600">Clinic</div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <div className="text-[5px] bg-primary text-white px-1 rounded-sm">Book</div>
                                                                    <div className="w-2 h-1 bg-gray-400 rounded-sm"></div>
                                                                </div>
                                                            </div>
                                                            {/* Compact hero */}
                                                            <div className="bg-primary/10 px-1 py-0.5">
                                                                <div className="text-[6px] font-medium text-gray-700">Quick Healthcare Access</div>
                                                            </div>
                                                            {/* List view content */}
                                                            <div className="px-1 space-y-0.5 flex-1">
                                                                <div className="space-y-0.5">
                                                                    <div className="bg-white border rounded px-0.5 py-0.5 flex justify-between">
                                                                        <div className="text-[5px] text-gray-600">General Consultation</div>
                                                                        <div className="text-[4px] text-gray-400">$50</div>
                                                                    </div>
                                                                    <div className="bg-white border rounded px-0.5 py-0.5 flex justify-between">
                                                                        <div className="text-[5px] text-gray-600">Health Check-up</div>
                                                                        <div className="text-[4px] text-gray-400">$80</div>
                                                                    </div>
                                                                    <div className="bg-white border rounded px-0.5 py-0.5 flex justify-between">
                                                                        <div className="text-[5px] text-gray-600">Specialist Visit</div>
                                                                        <div className="text-[4px] text-gray-400">$120</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Label>
                                </div>
                        ))}
                    </div>
                    )}
                </CardContent>
            </Card>

            {/* Layout Details */}
            {selectedLayoutOption && (
                <Card>
                    <CardHeader>
                        <CardTitle>Layout Details</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Information about the selected layout
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Desktop Preview */}
                            <div className="text-center">
                                <div className="flex items-center justify-center mb-2">
                                    <Monitor className="h-5 w-5 text-primary" />
                                </div>
                                <Label className="text-sm font-medium">Desktop View</Label>
                                <div className="mt-2 border rounded bg-white min-h-[120px] overflow-hidden">
                                    {selectedLayoutOption.id === 'classic' && (
                                        <div className="p-3 h-full space-y-2">
                                            <div className="h-3 bg-primary/20 rounded"></div>
                                            <div className="flex gap-2">
                                                <div className="h-2 bg-gray-300 rounded flex-1"></div>
                                                <div className="h-2 bg-gray-300 rounded flex-1"></div>
                                                <div className="h-2 bg-gray-300 rounded flex-1"></div>
                                                <div className="h-2 bg-gray-300 rounded flex-1"></div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 flex-1">
                                                {[...Array(8)].map((_, i) => (
                                                    <div key={i} className="h-6 bg-gray-200 rounded"></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLayoutOption.id === 'sidebar' && (
                                        <div className="h-full flex">
                                            <div className="w-8 bg-primary/10 p-2 space-y-1">
                                                <div className="h-2 bg-primary/30 rounded"></div>
                                                <div className="h-1 bg-gray-300 rounded"></div>
                                                <div className="h-1 bg-gray-300 rounded"></div>
                                                <div className="h-1 bg-gray-300 rounded"></div>
                                                <div className="h-1 bg-gray-300 rounded"></div>
                                            </div>
                                            <div className="flex-1 p-3 space-y-2">
                                                <div className="h-3 bg-primary/20 rounded"></div>
                                                <div className="grid grid-cols-3 gap-2 flex-1">
                                                    {[...Array(6)].map((_, i) => (
                                                        <div key={i} className="h-6 bg-gray-200 rounded"></div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {selectedLayoutOption.id === 'compact' && (
                                        <div className="p-3 h-full space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <div className="h-3 bg-primary/20 rounded flex-1"></div>
                                                <div className="w-6 h-2 bg-gray-400 rounded"></div>
                                            </div>
                                            <div className="space-y-1 flex-1">
                                                {[...Array(6)].map((_, i) => (
                                                    <div key={i} className="h-3 bg-gray-200 rounded"></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tablet Preview */}
                            <div className="text-center">
                                <div className="flex items-center justify-center mb-2">
                                    <Tablet className="h-5 w-5 text-primary" />
                                </div>
                                <Label className="text-sm font-medium">Tablet View</Label>
                                <div className="mt-2 border rounded bg-white min-h-[120px] overflow-hidden">
                                    {selectedLayoutOption.id === 'classic' && (
                                        <div className="p-2 h-full space-y-2">
                                            <div className="h-3 bg-primary/20 rounded"></div>
                                            <div className="flex gap-1">
                                                <div className="h-2 bg-gray-300 rounded flex-1"></div>
                                                <div className="h-2 bg-gray-300 rounded flex-1"></div>
                                                <div className="h-2 bg-gray-300 rounded flex-1"></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                                {[...Array(4)].map((_, i) => (
                                                    <div key={i} className="h-8 bg-gray-200 rounded"></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLayoutOption.id === 'sidebar' && (
                                        <div className="h-full flex">
                                            <div className="w-6 bg-primary/10 p-1 space-y-1">
                                                <div className="h-2 bg-primary/30 rounded"></div>
                                                <div className="h-1 bg-gray-300 rounded"></div>
                                                <div className="h-1 bg-gray-300 rounded"></div>
                                            </div>
                                            <div className="flex-1 p-2 space-y-2">
                                                <div className="h-3 bg-primary/20 rounded"></div>
                                                <div className="grid grid-cols-2 gap-2 flex-1">
                                                    {[...Array(4)].map((_, i) => (
                                                        <div key={i} className="h-8 bg-gray-200 rounded"></div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {selectedLayoutOption.id === 'compact' && (
                                        <div className="p-2 h-full space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <div className="h-3 bg-primary/20 rounded flex-1"></div>
                                                <div className="w-4 h-2 bg-gray-400 rounded"></div>
                                            </div>
                                            <div className="space-y-1 flex-1">
                                                {[...Array(4)].map((_, i) => (
                                                    <div key={i} className="h-4 bg-gray-200 rounded"></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Preview */}
                            <div className="text-center">
                                <div className="flex items-center justify-center mb-2">
                                    <Smartphone className="h-5 w-5 text-primary" />
                                </div>
                                <Label className="text-sm font-medium">Mobile View</Label>
                                <div className="mt-2 border rounded bg-white min-h-[120px] overflow-hidden">
                                    {selectedLayoutOption.id === 'classic' && (
                                        <div className="p-2 h-full space-y-2">
                                            <div className="h-3 bg-primary/20 rounded"></div>
                                            <div className="h-2 bg-gray-300 rounded"></div>
                                            <div className="space-y-2 flex-1">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="h-6 bg-gray-200 rounded"></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLayoutOption.id === 'sidebar' && (
                                        <div className="p-2 h-full space-y-2">
                                            <div className="h-3 bg-primary/20 rounded"></div>
                                            <div className="h-2 bg-primary/10 rounded"></div>
                                            <div className="space-y-2 flex-1">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="h-6 bg-gray-200 rounded"></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedLayoutOption.id === 'compact' && (
                                        <div className="p-2 h-full space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <div className="h-3 bg-primary/20 rounded flex-1"></div>
                                                <div className="w-3 h-2 bg-gray-400 rounded"></div>
                                            </div>
                                            <div className="space-y-1 flex-1">
                                                {[...Array(4)].map((_, i) => (
                                                    <div key={i} className="h-3 bg-gray-200 rounded"></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Implementation Note */}
            <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="h-2 w-2 bg-blue-500 rounded-full mt-2"></div>
                        <div>
                            <p className="text-sm font-medium text-blue-900 mb-1">
                                Layout Implementation
                            </p>
                            <p className="text-sm text-blue-800">
                                Currently, the <strong>Sidebar Layout</strong> is implemented. The Classic and Compact layouts 
                                will be available in future updates. Your selection will be saved and automatically 
                                applied when these layouts become available.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

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
        </div>
    );
} 
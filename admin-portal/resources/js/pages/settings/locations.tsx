import { useState, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Loader2 } from 'lucide-react';
import SettingsLayout from '@/layouts/settings-layout';
import BasicInfo from './Location/BasicInfo';
import PractitionersTab from './Location/PractitionersTab';
import AllLocations from './Location/AllLocations';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

interface Props {
    locations: any;
}

const tabs = [
    { value: 'basic-info', label: 'Basic Info' },
    { value: 'practitioners', label: 'Practitioners' },
];

export default function LocationsSettings({ locations }: Props) {
    const { flash }: any = usePage()?.props || {};
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [locationViewMode, setLocationViewMode] = useState<'all' | 'edit'>('all');
    const [showFlash, setShowFlash] = useState(true);

    // Get current URL parameters
    const getCurrentTab = () => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('tab') || 'basic-info';
        }
        return 'basic-info';
    };

    const [activeTab, setActiveTab] = useState(getCurrentTab());

    // Handle URL parameters for location redirects
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const urlParams = new URLSearchParams(window.location.search);
        const locationId = urlParams.get('location');
        const createMode = urlParams.get('create') === 'true';

        // If create mode is requested, show create form
        if (createMode) {
            setSelectedLocation(null);
            setLocationViewMode('edit');
            return;
        }

        if (locationId && locations?.data) {
            const location = locations.data.find((loc: any) => loc?.id === parseInt(locationId));
            if (location) {
                setSelectedLocation(location);
                setLocationViewMode('edit');
            } else {
                // Location ID in URL but not in data - trigger reload to fetch latest
                router.reload({
                    only: ['locations'],
                    onError: (errors) => {
                        console.error('Failed to reload locations:', errors);
                        toast.error('Failed to load location data', {
                            description: 'Please refresh the page to try again.',
                        });
                    },
                });
            }
        }
    }, [locations?.data]);

    // Check if we're in onboarding flow
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isOnboarding = urlParams.get('onboarding') === 'true';

    // Show toast when flash messages arrive (only if not in onboarding to avoid duplicates)
    useEffect(() => {
        if (!isOnboarding) {
            if (flash?.success) {
                setShowFlash(true);
                toast.success('Success', {
                    description: flash.success
                });
            }
            if (flash?.error) {
                setShowFlash(true);
                toast.error('Error', {
                    description: flash.error
                });
            }
        }
    }, [flash, isOnboarding]);

    // Update URL when tab changes
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', value);
            
            // Include location ID for location tabs
            if (selectedLocation?.id) {
                url.searchParams.set('location', selectedLocation.id.toString());
            }
            
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    const handleAddLocation = () => {
        setSelectedLocation(null);
        setLocationViewMode('edit');
        
        // Update URL for new location (without location ID)
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'basic-info');
            url.searchParams.delete('location'); // Remove location param for new location
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    const handleEditLocation = (location: any) => {
        setSelectedLocation(location);
        setLocationViewMode('edit');
        
        // Update URL with location parameter
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('location', location.id.toString());
            url.searchParams.set('tab', 'basic-info'); // Default to basic info tab
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    const handleBackToAll = () => {
        setLocationViewMode('all');
        setSelectedLocation(null);
        
        // Update URL to remove location and tab parameters
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('tab');
            url.searchParams.delete('location');
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    const renderTabComponent = (tabValue: string) => {
        try {
            switch (tabValue) {
                case 'basic-info':
                    return <BasicInfo
                        location={selectedLocation}
                        timezones={locations?.timezones || []}
                        provinces={locations?.provinces || []}
                        cities={locations?.cities || {}}
                        onSave={(location) => {
                            setSelectedLocation(location);
                        }}
                        onTabChange={handleTabChange}
                    />;
                case 'practitioners':
                    return <PractitionersTab
                        location={selectedLocation}
                        practitioners={selectedLocation?.practitioners || []}
                        onSave={(practitioners) => {
                            if (selectedLocation) {
                                setSelectedLocation({
                                    ...selectedLocation,
                                    practitioners: practitioners
                                });
                            }
                        }}
                        onTabChange={handleTabChange}
                    />;
                default:
                    return <BasicInfo
                        location={selectedLocation}
                        timezones={locations?.timezones || []}
                        provinces={locations?.provinces || []}
                        cities={locations?.cities || {}}
                        onSave={(location) => {
                            setSelectedLocation(location);
                        }}
                        onTabChange={handleTabChange}
                    />;
            }
        } catch (error) {
            console.error('Error rendering location tab component:', error);
            return (
                <div className="p-6">
                    <Alert className="bg-red-50 border-red-200">
                        <AlertDescription className="text-red-800">
                            An error occurred while loading this section. Please refresh the page and try again.
                        </AlertDescription>
                    </Alert>
                </div>
            );
        }
    };

    const renderContent = () => {
        try {
            // Show all locations view
            if (locationViewMode === 'all') {
                return (
                    <AllLocations
                        locations={locations?.data || []}
                        onAddLocation={handleAddLocation}
                        onEditLocation={handleEditLocation}
                    />
                );
            }

            // Show location edit view with tabs
            return (
                <div className="space-y-6">
                    {/* Back button for location edit mode */}
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                onClick={handleBackToAll}
                                className="text-gray-600 hover:text-gray-800"
                            >
                                ← Back 
                            </Button>
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {selectedLocation ? `Edit ${selectedLocation.name}` : 'Add New Location'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {selectedLocation ? 'Update location information and settings' : 'Create a new location for your organization'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Card className="border-none shadow-none">
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <div className="px-6 pb-0">
                                <TabsList className="grid w-full grid-cols-3">
                                    {tabs.map((tab) => (
                                        <TabsTrigger 
                                            key={tab.value} 
                                            value={tab.value}
                                            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-800"
                                        >
                                            {tab.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </div>

                            {tabs.map((tab) => (
                                <TabsContent key={tab.value} value={tab.value} className="mt-0">
                                    {/* Flash Message */}
                                    {showFlash && flash?.success && (
                                        <div className="px-6 pt-4">
                                            <Alert className="bg-green-50 border-green-200">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                <AlertDescription className="text-green-800">
                                                    {flash.success}
                                                </AlertDescription>
                                            </Alert>
                                        </div>
                                    )}
                                    {showFlash && flash?.error && (
                                        <div className="px-6 pt-4">
                                            <Alert className="bg-red-50 border-red-200">
                                                <AlertDescription className="text-red-800">
                                                    {flash.error}
                                                </AlertDescription>
                                            </Alert>
                                        </div>
                                    )}
                                    {renderTabComponent(tab.value)}
                                </TabsContent>
                            ))}
                        </Tabs>
                    </Card>
                </div>
            );
        } catch (error) {
            console.error('Error rendering locations content:', error);
            return (
                <div className="p-6">
                    <Alert className="bg-red-50 border-red-200">
                        <AlertDescription className="text-red-800">
                            An error occurred while loading the locations section. Please refresh the page and try again.
                        </AlertDescription>
                    </Alert>
                </div>
            );
        }
    };

    return (
        <SettingsLayout activeSection="locations" title="Locations Settings">
            {renderContent()}
            <Toaster position="top-right" />
        </SettingsLayout>
    );
}

import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';
import SettingsLayout from '@/layouts/settings-layout';
import WebsiteNavigationSettings from '@/components/WebsiteNavigationSettings';

const tabs = [
    { value: 'navigation', label: 'Navigation Menu' },
];

export default function WebsiteSettings() {
    const { flash }: any = usePage()?.props || {};
    const [showFlash, setShowFlash] = useState(true);

    // Get current URL parameters for active tab
    const getCurrentTab = () => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('tab') || 'navigation';
        }
        return 'navigation';
    };

    const [activeTab, setActiveTab] = useState(getCurrentTab());

    // Auto-hide flash messages after 5 seconds
    useEffect(() => {
        if (flash?.success || flash?.error) {
            setShowFlash(true);
            const timer = setTimeout(() => {
                setShowFlash(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [flash]);

    // Update URL when tab changes
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', value);
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    const renderTabComponent = (tabValue: string) => {
        try {
            switch (tabValue) {
                case 'navigation':
                    return <WebsiteNavigationSettings />;
                default:
                    return <WebsiteNavigationSettings />;
            }
        } catch (error) {
            console.error('Error rendering website tab component:', error);
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

    return (
        <SettingsLayout activeSection="website" title="Website Settings">
            <div className="space-y-4 sm:space-y-6">
                <Card className="border-none shadow-none">
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                        <div className="px-3 sm:px-6 pb-0">
                            <TabsList className="grid w-full grid-cols-1">
                                {tabs.map((tab) => (
                                    <TabsTrigger 
                                        key={tab.value} 
                                        value={tab.value}
                                        className="text-sm sm:text-base data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-800"
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
                                    <div className="px-3 sm:px-6 pt-3 sm:pt-4">
                                        <Alert className="bg-green-50 border-green-200">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <AlertDescription className="text-sm sm:text-base text-green-800">
                                                {flash.success}
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                )}
                                {showFlash && flash?.error && (
                                    <div className="px-3 sm:px-6 pt-3 sm:pt-4">
                                        <Alert className="bg-red-50 border-red-200">
                                            <AlertDescription className="text-sm sm:text-base text-red-800">
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
        </SettingsLayout>
    );
}

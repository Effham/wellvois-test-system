import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';
import SettingsLayout from '@/layouts/settings-layout';
import PracticeDetails from './Organization/PracticeDetails';
import { toast } from 'sonner';




import Appearance from './Organization/Appearance';
import TimeLocale from './Organization/TimeLocale';
import BusinessCompliance from './Organization/BusinessCompliance';
import AppointmentSettings from './Appointments/AppointmentSettings';
import AccountingSettings from './Organization/AccountingSettings';

interface OrganizationSettings {
    practiceDetails: Record<string, string>;
    appearance: Record<string, string>;
    timeLocale: Record<string, string>;
    businessCompliance: Record<string, string>;
    accounting: Record<string, string>;
}

interface Props {
    organizationSettings: OrganizationSettings;
    appointmentSettings: any;
}

const tabs = [
    { value: 'practice-details', label: 'Practice Details' },
    { value: 'appearance-time', label: 'Appearance' },
    { value: 'locale', label: ' Time & Locale' },
    { value: 'business-compliance', label: 'Business & Compliance' },
    { value: 'appointment-settings', label: 'Appointment' },
    { value: 'accounting', label: 'Accounting' },
];

export default function OrganizationSettings({ organizationSettings, appointmentSettings }: Props) {
    const { tenancy, flash }: any = usePage()?.props || {};
    const [showFlash, setShowFlash] = useState(true);

    // Get current URL parameters for active tab
    const getCurrentTab = () => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('tab') || 'practice-details';
        }
        return 'practice-details';
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

    // Provide default empty objects if organizationSettings is undefined
    const defaultSettings = {
        practiceDetails: {},
        appearance: {},
        timeLocale: {},
        businessCompliance: {},
        accounting: {},
    };

    const settings = organizationSettings || defaultSettings;

    const renderTabComponent = (tabValue: string) => {
        try {
            switch (tabValue) {
                case 'practice-details':
                    return <PracticeDetails 
                        practiceDetailsSettings={settings.practiceDetails} 
                        tenantName={tenancy?.current?.name || ''} 
                    />;
                case 'appearance-time':
                    return <Appearance 
                        appearanceSettings={settings.appearance} 
                        tenantName={tenancy?.current?.name || ''} 
                    />;
                case 'locale':
                    return <TimeLocale timeLocaleSettings={settings.timeLocale} />;
                case 'business-compliance':
                    return <BusinessCompliance businessComplianceSettings={settings.businessCompliance} />;
                case 'appointment-settings':
                    return <AppointmentSettings appointmentSettings={appointmentSettings || {}} />;
                case 'accounting':
                    return <AccountingSettings accountingSettings={settings.accounting} />;
                default:
                    return <PracticeDetails 
                        practiceDetailsSettings={settings.practiceDetails} 
                        tenantName={tenancy?.current?.name || ''} 
                    />;
            }
        } catch (error) {
            console.error('Error rendering tab component:', error);
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
        <SettingsLayout activeSection="organization" title="Organization Settings">
            <div className="space-y-6">
                <Card className="border-none shadow-none">
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                        <div className="px-6 pb-0">
                            <TabsList className="grid w-full grid-cols-5">
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
        </SettingsLayout>
    );
}

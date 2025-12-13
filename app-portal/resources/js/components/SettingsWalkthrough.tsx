import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings, MapPin, Users, Briefcase, ArrowRight, Sparkles } from 'lucide-react';

interface SettingsWalkthroughProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onNavigateToSection: (section: string, subtab?: string) => void;
}

const setupSteps = [
    {
        id: 1,
        title: 'Organization Settings',
        description: 'Set up your practice details, logo, and branding',
        section: 'organization',
        subtab: 'practice-details',
        icon: Settings,
        items: ['Practice name & details', 'Logo & branding', 'Contact information']
    },
    {
        id: 2,
        title: 'Location Settings', 
        description: 'Configure your practice locations and operating hours',
        section: 'locations',
        subtab: 'basic-info',
        icon: MapPin,
        items: ['Location details', 'Operating hours', 'Contact information']
    },
    {
        id: 3,
        title: 'Add Practitioners',
        description: 'Add your team members or find practitioners in the network',
        section: 'practitioners',
        subtab: null,
        icon: Users,
        items: ['Add team members', 'Search network', 'Set availability']
    },
    {
        id: 4,
        title: 'Services & Pricing',
        description: 'Define the services you offer and set your pricing',
        section: 'services',
        subtab: null,
        icon: Briefcase,
        items: ['Add services', 'Set pricing', 'Configure duration']
    }
];

export default function SettingsWalkthrough({ open, onOpenChange, onNavigateToSection }: SettingsWalkthroughProps) {
    const handleGoToSection = (section: string, subtab?: string) => {
        // Close modal first
        onOpenChange(false);
        
        // Then navigate to the section
        onNavigateToSection(section, subtab || undefined);
    };

    const handleSkip = () => {
        onOpenChange(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                                    Complete Your Setup
                                </DialogTitle>
                                <p className="text-gray-600 text-sm">Set up these 4 essential areas to get started</p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Welcome Message */}
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                            <p className="text-gray-700 leading-relaxed text-sm">
                                Welcome to Wellovis! To get your practice ready, please complete the following setup steps. 
                                You can click on any section to get started and complete them in any order.
                            </p>
                        </div>

                        {/* Setup Steps Grid */}
                        <div className="grid gap-4 md:grid-cols-2">
                            {setupSteps.map((step) => {
                                const Icon = step.icon;
                                
                                return (
                                    <div 
                                        key={step.id}
                                        className="group p-4 rounded-xl border-2 border-gray-200 hover:border-purple-300 transition-all duration-200 cursor-pointer hover:shadow-md bg-white"
                                        onClick={() => handleGoToSection(step.section, step.subtab || undefined)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-purple-100 text-gray-600 group-hover:text-purple-600 transition-colors">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-purple-900">
                                                    {step.title}
                                                </h3>
                                                <p className="text-sm text-gray-600 mb-3">
                                                    {step.description}
                                                </p>
                                                <ul className="space-y-1">
                                                    {step.items.map((item, index) => (
                                                        <li key={index} className="flex items-center text-xs text-gray-500">
                                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Separator />

                        {/* Action Buttons */}
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500">
                                💡 Tip: You can complete these steps in any order and return to this guide anytime.
                            </p>
                            
                            <Button 
                                variant="outline" 
                                onClick={handleSkip}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                I'll do this later
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
} 
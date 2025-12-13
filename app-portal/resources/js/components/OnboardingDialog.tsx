import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Settings, MapPin, Users, Briefcase, ArrowRight, Sparkles } from 'lucide-react';
import { router } from '@inertiajs/react';

interface OnboardingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const onboardingSteps = [
    {
        id: 1,
        icon: Settings,
        title: 'Organization Settings',
        description: 'Set up your practice details, branding, and preferences',
        status: 'pending'
    },
    {
        id: 2,
        icon: MapPin,
        title: 'Location Settings',
        description: 'Configure your practice locations and operating hours',
        status: 'pending'
    },
    {
        id: 3,
        icon: Users,
        title: 'Add Practitioners',
        description: 'Add team members or find practitioners in the network',
        status: 'pending'
    },
    {
        id: 4,
        icon: Briefcase,
        title: 'Services & Pricing',
        description: 'Define the services you offer and set your pricing',
        status: 'pending'
    }
];

export default function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const handleGetStarted = async () => {
        await completeOnboarding();
        onOpenChange(false);
        router.visit('/dashboard');
    };

    const handleSkip = async () => {
        await completeOnboarding();
        onOpenChange(false);
        router.visit('/dashboard');
    };

    const completeOnboarding = async () => {
        try {
            await fetch('/api/complete-onboarding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}
        
        >
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
             onInteractOutside={(e) => {
    e.preventDefault();
 
  }}
            >
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                                Welcome to Wellovis
                            </DialogTitle>
                            <p className="text-gray-600 text-sm">Practice Management Platform</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Welcome Message */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            🎉 Congratulations on joining Wellovis!
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                            Your practice is now ready to get started. We'll help you set up the essential components 
                            to get your EMR system up and running quickly and efficiently.
                        </p>
                    </div>

                    {/* Setup Steps */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <h4 className="text-lg font-semibold text-gray-900">Let's get you set up</h4>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                4 Quick Steps
                            </Badge>
                        </div>

                        <div className="grid gap-4">
                            {onboardingSteps.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = index === currentStep;
                                
                                return (
                                    <div 
                                        key={step.id}
                                        className={`flex items-start gap-4 p-4 rounded-lg border transition-all duration-200 ${
                                            isActive 
                                                ? 'border-purple-200 bg-purple-50 shadow-sm' 
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                    >
                                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                                            isActive 
                                                ? 'bg-purple-100 text-purple-600' 
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h5 className={`font-medium ${
                                                isActive ? 'text-purple-900' : 'text-gray-900'
                                            }`}>
                                                {step.title}
                                            </h5>
                                            <p className={`text-sm mt-1 ${
                                                isActive ? 'text-purple-700' : 'text-gray-600'
                                            }`}>
                                                {step.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center">
                                            <Badge variant={isActive ? 'default' : 'secondary'} className={
                                                isActive 
                                                    ? 'bg-purple-100 text-purple-700 border-purple-200' 
                                                    : 'bg-gray-100 text-gray-600'
                                            }>
                                                Step {index + 1}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-blue-900 font-medium text-sm">
                                    Don't worry, you can always update these settings later
                                </p>
                                <p className="text-blue-700 text-sm mt-1">
                                    We'll redirect you to the settings page where you can complete each step at your own pace.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button 
                            onClick={handleGetStarted}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg"
                            size="lg"
                        >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Get Started with Setup
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleSkip}
                            className="sm:w-auto w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            Skip for Now
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 
'use client';

import { router, usePage, Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, MapPin, Briefcase, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLogoIcon from '@/components/app-logo-icon';
import { getRequiredSteps, checkCompletion, type StepId } from '@/utils/onboarding-completion';

interface OnboardingChecklistProps {
    onboardingStatus: {
        hasLocation: boolean;
        hasService: boolean;
        locationCount: number;
        serviceCount: number;
        practitionerCount?: number;
        hasVirtualLocationWithHours?: boolean;
        isComplete: boolean;
    };
    practiceType?: 'solo' | 'group' | null;
    appointmentType?: 'virtual' | 'hybrid' | 'in-person' | null;
    hasMultipleLocations?: boolean | null;
}

export default function OnboardingChecklist({ onboardingStatus, practiceType, appointmentType, hasMultipleLocations }: OnboardingChecklistProps) {
    const page = usePage();
    const pageProps = page.props as any;
    const [showLogo, setShowLogo] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    
    // Get hasMultipleLocations from props if not passed directly
    const multipleLocations = hasMultipleLocations ?? pageProps.hasMultipleLocations ?? null;
    
    const handleNavigateToLocation = () => {
        const url = `/onboarding/location/create?onboarding=true&hasMultipleLocations=${multipleLocations === true ? 'true' : 'false'}`;
        router.visit(url);
    };

    const handleNavigateToService = () => {
        router.visit('/onboarding/service/create');
    };





    const handleBackToChecklist = () => {
        router.visit('/dashboard?onboarding=true');
    };
    
    // Check if we're coming from a create page
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const fromCreate = urlParams.get('from') === 'create';

    // Determine required steps based on questionnaire answers
    const requiredSteps = getRequiredSteps(practiceType || null, appointmentType || null, multipleLocations);
    
    // Check if onboarding is complete
    const isComplete = checkCompletion(requiredSteps, {
        ...onboardingStatus,
        practitionerCount: onboardingStatus.practitionerCount ?? 0,
    });

    // Build steps dynamically based on required steps
    const stepConfig: Record<StepId, { title: string; description: string; icon: any }> = {
        location: {
            title: 'Add Location',
            description: 'Set up your practice location with address, timezone, and operating hours',
            icon: MapPin,
        },
        service: {
            title: 'Add Services',
            description: 'Define the services you offer, pricing, duration, and categories',
            icon: Briefcase,
        },

    };

    const steps = requiredSteps.map((stepId) => {
        const config = stepConfig[stepId];
        let completed = false;
        
        switch (stepId) {
            case 'location':
                completed = onboardingStatus.hasLocation;
                break;
            case 'service':
                completed = onboardingStatus.hasService;
                break;

        }

        return {
            id: stepId,
            title: config.title,
            description: config.description,
            icon: config.icon,
            completed,
            required: true,
            action: stepId === 'location' ? handleNavigateToLocation :
                    stepId === 'service' ? handleNavigateToService : handleNavigateToService,
        };
    });

    // Handle scroll to show/hide logo
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            
            // Hide logo when scrolling down, show when scrolling up or at top
            if (currentScrollY > 50 && currentScrollY > lastScrollY) {
                setShowLogo(false);
            } else if (currentScrollY < lastScrollY || currentScrollY <= 50) {
                setShowLogo(true);
            }
            
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F9F7FF] via-[#FEFBFF] to-[#F5F3FF] p-4 sm:p-6 lg:p-8 overflow-hidden">
            <Head>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes ekg {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    
                    @keyframes pulse-data {
                        0%, 100% { opacity: 0.4; }
                        50% { opacity: 0.8; }
                    }
                    
                    @keyframes vital-pulse {
                        0%, 100% { opacity: 0.6; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.05); }
                    }
                    
                    @keyframes mini-ekg {
                        0% { background-position: -100% 0; }
                        100% { background-position: 100% 0; }
                    }
                    
                    @keyframes chart-draw {
                        0% { stroke-dasharray: 0 1000; }
                        100% { stroke-dasharray: 1000 0; }
                    }
                    
                    @keyframes dna-helix {
                        0% { transform: rotateY(0deg); }
                        100% { transform: rotateY(360deg); }
                    }
                    
                    @keyframes dna-helix-reverse {
                        0% { transform: rotateY(360deg); }
                        100% { transform: rotateY(0deg); }
                    }
                    
                    @keyframes dna-base {
                        0%, 100% { width: 100%; opacity: 0.3; }
                        50% { width: 80%; opacity: 0.6; }
                    }
                    
                    @keyframes molecular-rotation {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @keyframes atom-pulse {
                        0%, 100% { r: 4; opacity: 0.6; }
                        50% { r: 6; opacity: 1; }
                    }
                    
                    @keyframes data-stream {
                        0% { transform: translateX(-100%); opacity: 0; }
                        50% { opacity: 1; }
                        100% { transform: translateX(100%); opacity: 0; }
                    }
                    
                    @keyframes medical-pulse {
                        0%, 100% { transform: scale(1); opacity: 0.8; }
                        50% { transform: scale(1.1); opacity: 1; }
                    }
                    
                    @keyframes ping-medical {
                        0% { transform: scale(1); opacity: 1; }
                        75%, 100% { transform: scale(1.5); opacity: 0; }
                    }
                    
                    @keyframes ultrasound-wave {
                        0% { stroke-dasharray: 0 200; }
                        50% { stroke-dasharray: 100 100; }
                        100% { stroke-dasharray: 200 0; }
                    }
                    
                    @keyframes data-point {
                        0%, 100% { opacity: 0.3; transform: scale(1) translateY(0); }
                        50% { opacity: 0.8; transform: scale(1.5) translateY(-5px); }
                    }
                    
                    @keyframes gentle-pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.8; transform: scale(1.05); }
                    }
                    
                    .animate-ekg { animation: ekg 8s linear infinite; }
                    .animate-pulse-data { animation: pulse-data 2s ease-in-out infinite; }
                    .animate-vital-pulse { animation: vital-pulse 1s ease-in-out infinite; }
                    .animate-mini-ekg { animation: mini-ekg 2s linear infinite; }
                    .animate-chart-draw { animation: chart-draw 4s ease-in-out infinite; }
                    .animate-dna-helix { animation: dna-helix 8s linear infinite; }
                    .animate-dna-helix-reverse { animation: dna-helix-reverse 8s linear infinite; }
                    .animate-dna-base { animation: dna-base 2s ease-in-out infinite; }
                    .animate-molecular-rotation { animation: molecular-rotation 15s linear infinite; }
                    .animate-atom-pulse { animation: atom-pulse 2s ease-in-out infinite; }
                    .animate-data-stream { animation: data-stream 4s ease-in-out infinite; }
                    .animate-medical-pulse { animation: medical-pulse 3s ease-in-out infinite; }
                    .animate-ping-medical { animation: ping-medical 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
                    .animate-ultrasound-wave { animation: ultrasound-wave 3s ease-in-out infinite; }
                    .animate-data-point { animation: data-point 6s ease-in-out infinite; }
                    .animate-gentle-pulse { animation: gentle-pulse 3s ease-in-out infinite; }
                    `
                }} />
            </Head>

            {/* Premium EMR Healthcare Background Animations */}
            <div className="absolute inset-0 overflow-hidden">
                
                {/* Medical EKG/ECG Heartbeat Pattern */}
                <div className="absolute top-1/4 left-0 w-full h-32 opacity-15">
                    <svg viewBox="0 0 1200 100" className="w-full h-full animate-ekg">
                        <defs>
                            <linearGradient id="ekg-gradient-checklist" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6640DC" stopOpacity="0.6" />
                                <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#6640DC" stopOpacity="0.4" />
                            </linearGradient>
                        </defs>
                        <path 
                            d="M0,50 L200,50 L210,30 L220,70 L230,20 L240,80 L250,50 L450,50 L460,30 L470,70 L480,20 L490,80 L500,50 L700,50 L710,30 L720,70 L730,20 L740,80 L750,50 L950,50 L960,30 L970,70 L980,20 L990,80 L1000,50 L1200,50"
                            fill="none" 
                            stroke="url(#ekg-gradient-checklist)" 
                            strokeWidth="2"
                            className="animate-pulse-data"
                        />
                    </svg>
                </div>

                {/* Medical Vital Signs Monitor Display */}
                <div className="absolute bottom-1/3 right-10 w-64 h-48 opacity-10">
                    <div className="w-full h-full bg-gradient-to-br from-sidebar-accent/20 to-purple-600/10 rounded-lg border border-sidebar-accent/20 p-4">
                        {/* Simulated vital signs readout */}
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-sidebar-accent/60">
                                <span>HR</span><span className="animate-vital-pulse">72 bpm</span>
                            </div>
                            <div className="flex justify-between text-sidebar-accent/60">
                                <span>BP</span><span>120/80</span>
                            </div>
                            <div className="flex justify-between text-sidebar-accent/60">
                                <span>SpO2</span><span className="animate-vital-pulse delay-500">98%</span>
                            </div>
                            <div className="flex justify-between text-sidebar-accent/60">
                                <span>TEMP</span><span>98.6°F</span>
                            </div>
                        </div>
                        {/* Mini EKG strip */}
                        <div className="mt-3 h-8 bg-gradient-to-r from-transparent via-sidebar-accent/30 to-transparent animate-mini-ekg"></div>
                    </div>
                </div>

                {/* Medical Chart/Grid Pattern */}
                <div className="absolute top-10 left-10 w-80 h-60 opacity-8">
                    <svg viewBox="0 0 320 240" className="w-full h-full">
                        <defs>
                            <pattern id="medical-grid-checklist" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#6640DC" strokeWidth="0.5" opacity="0.3"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#medical-grid-checklist)" />
                        {/* Medical chart line */}
                        <path 
                            d="M20,180 Q80,120 140,140 T260,100 T320,120"
                            fill="none" 
                            stroke="#6640DC" 
                            strokeWidth="2" 
                            opacity="0.4"
                            className="animate-chart-draw"
                        />
                    </svg>
                </div>

                {/* DNA Double Helix Pattern */}
                <div className="absolute top-1/2 left-20 w-2 h-40 opacity-20">
                    <div className="relative w-full h-full">
                        <div className="absolute left-0 top-0 w-0.5 h-full bg-gradient-to-b from-sidebar-accent/40 to-purple-500/20 animate-dna-helix"></div>
                        <div className="absolute right-0 top-0 w-0.5 h-full bg-gradient-to-b from-purple-500/20 to-sidebar-accent/40 animate-dna-helix-reverse"></div>
                        {/* DNA base pairs */}
                        {[...Array(8)].map((_, i) => (
                            <div 
                                key={i}
                                className="absolute left-0 w-full h-0.5 bg-sidebar-accent/20 animate-dna-base" 
                                style={{ top: `${i * 12.5}%`, animationDelay: `${i * 0.2}s` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Medical Molecular Structure */}
                <div className="absolute bottom-20 left-1/3 w-32 h-32 opacity-15">
                    <svg viewBox="0 0 120 120" className="w-full h-full animate-molecular-rotation">
                        <defs>
                            <radialGradient id="molecule-gradient-checklist">
                                <stop offset="0%" stopColor="#6640DC" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.2" />
                            </radialGradient>
                        </defs>
                        {/* Molecular bonds */}
                        <line x1="60" y1="30" x2="60" y2="90" stroke="#6640DC" strokeWidth="1" opacity="0.4" />
                        <line x1="30" y1="60" x2="90" y2="60" stroke="#6640DC" strokeWidth="1" opacity="0.4" />
                        <line x1="40" y1="40" x2="80" y2="80" stroke="#6640DC" strokeWidth="1" opacity="0.4" />
                        <line x1="80" y1="40" x2="40" y2="80" stroke="#6640DC" strokeWidth="1" opacity="0.4" />
                        {/* Atoms */}
                        <circle cx="60" cy="30" r="4" fill="url(#molecule-gradient-checklist)" className="animate-atom-pulse" />
                        <circle cx="60" cy="90" r="4" fill="url(#molecule-gradient-checklist)" className="animate-atom-pulse delay-300" />
                        <circle cx="30" cy="60" r="4" fill="url(#molecule-gradient-checklist)" className="animate-atom-pulse delay-600" />
                        <circle cx="90" cy="60" r="4" fill="url(#molecule-gradient-checklist)" className="animate-atom-pulse delay-900" />
                        <circle cx="60" cy="60" r="6" fill="url(#molecule-gradient-checklist)" className="animate-atom-pulse delay-150" />
                    </svg>
                </div>

                {/* Medical Data Stream Visualization */}
                <div className="absolute top-2/3 right-1/4 w-48 h-32 opacity-12">
                    <div className="relative w-full h-full">
                        {[...Array(6)].map((_, i) => (
                            <div 
                                key={i}
                                className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-sidebar-accent/40 to-transparent animate-data-stream"
                                style={{ 
                                    top: `${i * 20}%`, 
                                    animationDelay: `${i * 0.8}s`,
                                    animationDuration: '4s'
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Medical Cross with Pulse */}
                <div className="absolute top-1/3 right-1/3 w-12 h-12 opacity-25">
                    <div className="relative w-full h-full animate-medical-pulse">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-sidebar-accent/50 transform -translate-y-1/2 rounded-full"></div>
                        <div className="absolute left-1/2 top-0 w-1 h-full bg-sidebar-accent/50 transform -translate-x-1/2 rounded-full"></div>
                        <div className="absolute inset-0 border-2 border-sidebar-accent/30 rounded-full animate-ping-medical"></div>
                    </div>
                </div>

                {/* Ultrasound Wave Pattern */}
                <div className="absolute bottom-1/4 right-10 w-40 h-20 opacity-15">
                    <svg viewBox="0 0 160 80" className="w-full h-full">
                        <path 
                            d="M0,40 Q20,20 40,40 T80,40 T120,40 T160,40"
                            fill="none" 
                            stroke="#6640DC" 
                            strokeWidth="1" 
                            opacity="0.6"
                            className="animate-ultrasound-wave"
                        />
                        <path 
                            d="M0,45 Q25,25 50,45 T100,45 T160,45"
                            fill="none" 
                            stroke="#8B5CF6" 
                            strokeWidth="1" 
                            opacity="0.4"
                            className="animate-ultrasound-wave delay-500"
                        />
                    </svg>
                </div>

                {/* Medical Record Data Points */}
                <div className="absolute inset-0">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-sidebar-accent/30 rounded-full animate-data-point"
                            style={{
                                left: `${20 + (i * 7)}%`,
                                top: `${30 + Math.sin(i) * 20}%`,
                                animationDelay: `${i * 0.5}s`,
                                animationDuration: '6s'
                            }}
                        />
                    ))}
                </div>

                {/* Premium gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-sidebar-accent/3 via-transparent to-purple-100/15" />
            </div>

            {/* EMR Vector Illustrations - Spread Across Page */}
            {/* Medical Records File Cabinet - Top Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ left: '3%', top: '10%' }}>
                <svg width="200" height="140" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="15" y="20" width="110" height="60" rx="4" fill="rgba(139, 92, 246, 0.12)" stroke="rgba(139, 92, 246, 0.6)" strokeWidth="2.5"/>
                    <line x1="15" y1="45" x2="125" y2="45" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2"/>
                    <line x1="15" y1="60" x2="125" y2="60" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2"/>
                    <rect x="20" y="25" width="25" height="15" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="50" y="25" width="25" height="15" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="80" y="25" width="25" height="15" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="20" y="65" width="25" height="10" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="50" y="65" width="25" height="10" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="80" y="65" width="25" height="10" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                </svg>
            </div>

            {/* Medical Tablet/Device - Upper Mid Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ left: '1%', top: '30%' }}>
                <svg width="180" height="130" viewBox="0 0 130 95" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="20" y="15" width="90" height="65" rx="6" fill="rgba(99, 102, 241, 0.12)" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2.5"/>
                    <rect x="25" y="20" width="80" height="55" rx="3" fill="rgba(99, 102, 241, 0.08)"/>
                    <rect x="30" y="25" width="70" height="8" rx="2" fill="rgba(99, 102, 241, 0.2)"/>
                    <rect x="30" y="38" width="30" height="20" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                    <rect x="65" y="38" width="35" height="20" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                    <rect x="30" y="63" width="70" height="8" rx="2" fill="rgba(99, 102, 241, 0.2)"/>
                    <circle cx="65" cy="85" r="4" fill="rgba(99, 102, 241, 0.4)"/>
                </svg>
            </div>

            {/* Medical Chart/Clipboard - Mid Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ left: '6%', top: '50%' }}>
                <svg width="190" height="140" viewBox="0 0 135 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="20" y="15" width="95" height="70" rx="4" fill="rgba(124, 58, 237, 0.12)" stroke="rgba(124, 58, 237, 0.5)" strokeWidth="2.5"/>
                    <line x1="25" y1="30" x2="110" y2="30" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5"/>
                    <line x1="25" y1="40" x2="110" y2="40" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5"/>
                    <line x1="25" y1="50" x2="90" y2="50" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5"/>
                    <line x1="25" y1="60" x2="100" y2="60" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5"/>
                    <line x1="25" y1="70" x2="85" y2="70" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5"/>
                    <rect x="25" y="75" width="30" height="8" rx="2" fill="rgba(124, 58, 237, 0.2)"/>
                    <rect x="105" y="20" width="8" height="12" rx="2" fill="rgba(124, 58, 237, 0.3)" stroke="rgba(124, 58, 237, 0.5)" strokeWidth="1.5"/>
                </svg>
            </div>

            {/* Medical Scanner - Lower Mid Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ left: '2%', top: '70%' }}>
                <svg width="200" height="130" viewBox="0 0 140 95" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="15" y="25" width="110" height="55" rx="5" fill="rgba(139, 92, 246, 0.12)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth="2.5"/>
                    <rect x="20" y="30" width="100" height="45" rx="3" fill="rgba(139, 92, 246, 0.08)"/>
                    <rect x="25" y="35" width="90" height="8" rx="2" fill="rgba(139, 92, 246, 0.2)"/>
                    <rect x="30" y="48" width="20" height="20" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="55" y="48" width="20" height="20" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="80" y="48" width="20" height="20" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <line x1="25" y1="20" x2="30" y2="25" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2"/>
                    <line x1="115" y1="20" x2="110" y2="25" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2"/>
                </svg>
            </div>

            {/* EKG Monitor - Top Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ right: '2%', top: '12%' }}>
                <svg width="190" height="140" viewBox="0 0 135 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="15" y="15" width="105" height="60" rx="5" fill="rgba(99, 102, 241, 0.12)" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2.5"/>
                    <rect x="20" y="20" width="95" height="8" rx="2" fill="rgba(99, 102, 241, 0.2)"/>
                    <path d="M25 50 L40 40 L55 55 L70 35 L85 60 L100 45 L110 50" stroke="rgba(99, 102, 241, 0.7)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    <circle cx="40" cy="40" r="2" fill="rgba(99, 102, 241, 0.8)"/>
                    <circle cx="70" cy="35" r="2" fill="rgba(99, 102, 241, 0.8)"/>
                    <circle cx="100" cy="45" r="2" fill="rgba(99, 102, 241, 0.8)"/>
                </svg>
            </div>

            {/* Medical Storage Unit - Upper Mid Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ right: '5%', top: '32%' }}>
                <svg width="180" height="150" viewBox="0 0 125 110" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="20" y="20" width="85" height="70" rx="5" fill="rgba(168, 85, 247, 0.12)" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2.5"/>
                    <line x1="20" y1="45" x2="105" y2="45" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="2"/>
                    <line x1="20" y1="65" x2="105" y2="65" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="2"/>
                    <rect x="25" y="25" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5"/>
                    <rect x="65" y="25" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5"/>
                    <rect x="25" y="70" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5"/>
                    <rect x="65" y="70" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5"/>
                    <circle cx="42" cy="32" r="2" fill="rgba(168, 85, 247, 0.4)"/>
                    <circle cx="82" cy="32" r="2" fill="rgba(168, 85, 247, 0.4)"/>
                </svg>
            </div>

            {/* Medical Computer Station - Mid Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ right: '1%', top: '52%' }}>
                <svg width="200" height="140" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="15" y="30" width="110" height="55" rx="4" fill="rgba(139, 92, 246, 0.12)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth="2.5"/>
                    <rect x="20" y="35" width="100" height="45" rx="3" fill="rgba(139, 92, 246, 0.08)"/>
                    <rect x="25" y="40" width="90" height="6" rx="2" fill="rgba(139, 92, 246, 0.2)"/>
                    <rect x="30" y="50" width="25" height="18" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="60" y="50" width="30" height="18" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="95" y="50" width="25" height="18" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5"/>
                    <rect x="30" y="72" width="90" height="6" rx="2" fill="rgba(139, 92, 246, 0.2)"/>
                    <rect x="50" y="20" width="40" height="12" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2"/>
                </svg>
            </div>

            {/* Medical Filing System - Lower Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block" style={{ right: '4%', top: '72%' }}>
                <svg width="190" height="130" viewBox="0 0 135 95" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="20" y="20" width="95" height="60" rx="4" fill="rgba(99, 102, 241, 0.12)" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2.5"/>
                    <line x1="20" y1="40" x2="115" y2="40" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2"/>
                    <line x1="20" y1="55" x2="115" y2="55" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2"/>
                    <rect x="25" y="25" width="20" height="12" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                    <rect x="50" y="25" width="20" height="12" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                    <rect x="75" y="25" width="20" height="12" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                    <rect x="25" y="60" width="20" height="15" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                    <rect x="50" y="60" width="20" height="15" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                    <rect x="75" y="60" width="20" height="15" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5"/>
                </svg>
            </div>

            {/* Logo - Fixed at top, transparent background, centered - Hide on scroll down */}
            <div className={`fixed top-0 left-0 right-0 z-50 py-6 flex justify-center pointer-events-none transition-opacity duration-300 ${showLogo ? 'opacity-100' : 'opacity-0'}`}>
                <div className="pointer-events-auto">
                    <AppLogoIcon className="h-8 w-auto drop-shadow-lg" />
                </div>
            </div>
            
            <div className="w-full max-w-3xl relative z-10">
                    <Card className="border-2 shadow-2xl bg-white/95 backdrop-blur-sm">
                    <CardHeader className="text-center pb-6">
                        <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                            Welcome to Your Practice
                        </CardTitle>
                        <CardDescription className="text-lg text-gray-600">
                            Let's get you started with a few quick setup steps
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Checklist Cards */}
                        <div className="space-y-4">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isCompleted = step.completed;
                        const canProceed = index === 0 || steps[index - 1].completed;

                        return (
                            <Card
                                key={step.id}
                                className={`border-2 transition-all ${
                                    isCompleted
                                        ? 'border-primary/30 bg-primary/5'
                                        : canProceed
                                          ? 'border-border hover:border-primary/50 hover:shadow-md'
                                          : 'border-border/50 bg-muted/30 opacity-60'
                                }`}
                            >
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div
                                                className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                                    isCompleted
                                                        ? 'border-primary bg-primary text-primary-foreground'
                                                        : canProceed
                                                          ? 'border-primary/30 bg-primary/10 text-primary'
                                                          : 'border-muted bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle2 className="h-6 w-6" />
                                                ) : (
                                                    <Icon className="h-5 w-5" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-foreground">{step.title}</CardTitle>
                                                    {step.required && (
                                                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                            Required
                                                        </span>
                                                    )}
                                                    {!step.required && (
                                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                            Optional
                                                        </span>
                                                    )}
                                                </div>
                                                <CardDescription className="mt-1 text-sm">
                                                    {step.description}
                                                </CardDescription>
                                                {isCompleted && step.id === 'location' && (
                                                    <p className="mt-2 text-xs text-primary font-medium">
                                                        {onboardingStatus.locationCount} location
                                                        {onboardingStatus.locationCount !== 1 ? 's' : ''} added
                                                    </p>
                                                )}
                                                {isCompleted && step.id === 'service' && (
                                                    <p className="mt-2 text-xs text-primary font-medium">
                                                        {onboardingStatus.serviceCount} service
                                                        {onboardingStatus.serviceCount !== 1 ? 's' : ''} added
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {isCompleted ? (
                                            <div className="flex items-center gap-2 text-primary">
                                                <CheckCircle2 className="h-5 w-5" />
                                                <span className="text-sm font-medium">Complete</span>
                                            </div>
                                        ) : (
                                            // Other steps: Show single button
                                            <Button
                                                onClick={step.action}
                                                disabled={!canProceed}
                                                className={`${
                                                    canProceed
                                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                                                }`}
                                            >
                                                {step.id === 'location' || (step.id === 'service' && onboardingStatus.hasLocation)
                                                    ? 'Add Now'
                                                    : 'Get Started'}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                            </Card>
                        );
                    })}
                </div>

                        {/* Back to Checklist Button (shown when coming from create pages) */}
                        {fromCreate && (
                            <div className="flex justify-center pt-4">
                                {/* <Button
                                    variant="outline"
                                    onClick={handleBackToChecklist}
                                    className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                >
                                    Back to Checklist
                                </Button> */}
                            </div>
                        )}

                        {/* Progress Indicator */}
                        <div className="pt-6">
                            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                                <span>Setup Progress</span>
                                <span className="font-medium text-foreground">
                                    {steps.filter((s) => s.required && s.completed).length} of{' '}
                                    {steps.filter((s) => s.required).length} required steps completed
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{
                                        width: `${
                                            (steps.filter((s) => s.required && s.completed).length /
                                                steps.filter((s) => s.required).length) *
                                            100
                                        }%`,
                                    }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


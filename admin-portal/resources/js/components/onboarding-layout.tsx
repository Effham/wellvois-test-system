'use client';

import { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import { motion } from 'motion/react';
import AppLogoIcon from '@/components/app-logo-icon';

interface OnboardingLayoutProps {
    children: ReactNode;
    title: string;
    className?: string;
    showLogo?: boolean;
    contentClassName?: string;
}

export default function OnboardingLayout({ 
    children, 
    title, 
    className = '', 
    showLogo: showLogoProp = true,
    contentClassName = ''
}: OnboardingLayoutProps) {

    return (
        <div className={`relative flex min-h-screen bg-white ${className}`}>
            <Head title={title}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes fadeInSlideUp {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
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
                    
                    @keyframes ai-diagonal-sweep {
                        0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); opacity: 0; }
                        50% { opacity: 0.6; }
                        100% { transform: translateX(200%) translateY(200%) rotate(45deg); opacity: 0; }
                    }
                    
                    @keyframes neural-network-pulse {
                        0%, 100% { opacity: 0.2; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(1.1); }
                    }
                    
                    @keyframes ai-data-flow {
                        0% { transform: translateX(-50px) translateY(0); opacity: 0; }
                        50% { opacity: 0.8; }
                        100% { transform: translateX(calc(100vw + 50px)) translateY(-100px); opacity: 0; }
                    }
                    
                    @keyframes circuit-pulse {
                        0%, 100% { stroke-dashoffset: 0; opacity: 0.3; }
                        50% { stroke-dashoffset: 20; opacity: 0.7; }
                    }
                    
                    @keyframes ai-particle-float {
                        0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
                        20% { opacity: 0.6; }
                        80% { opacity: 0.6; }
                        100% { transform: translateY(-100vh) translateX(50px) rotate(360deg); opacity: 0; }
                    }
                    
                    @keyframes gradient-shift {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    
                    @keyframes float-gentle {
                        0%, 100% { transform: translateY(0px) translateX(0px); }
                        50% { transform: translateY(-8px) translateX(3px); }
                    }
                    
                    @keyframes float-slow {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-12px); }
                    }
                    
                    @keyframes svg-pulse {
                        0%, 100% { opacity: 0.5; transform: scale(1); }
                        50% { opacity: 0.7; transform: scale(1.02); }
                    }
                    
                    @keyframes ekg-line {
                        0% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: 200; }
                    }
                    
                    @keyframes scanner-sweep {
                        0% { transform: translateX(-100%); opacity: 0; }
                        50% { opacity: 0.8; }
                        100% { transform: translateX(100%); opacity: 0; }
                    }
                    
                    @keyframes file-slide {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-3px); }
                    }
                    
                    @keyframes screen-flicker {
                        0%, 100% { opacity: 0.08; }
                        50% { opacity: 0.12; }
                    }
                    
                    @keyframes drawer-open {
                        0%, 100% { transform: translateX(0); }
                        50% { transform: translateX(2px); }
                    }
                    
                    @keyframes chart-line-draw {
                        0% { stroke-dashoffset: 300; opacity: 0; }
                        50% { opacity: 1; }
                        100% { stroke-dashoffset: 0; opacity: 1; }
                    }
                    
                    @keyframes data-point-glow {
                        0%, 100% { opacity: 0.6; r: 2.5; }
                        50% { opacity: 1; r: 3.5; }
                    }
                    
                    @keyframes chart-grid-fade {
                        0%, 100% { opacity: 0.2; }
                        50% { opacity: 0.4; }
                    }
                    
                    @keyframes bar-grow {
                        0% { height: 0; opacity: 0; }
                        50% { opacity: 1; }
                        100% { opacity: 1; }
                    }
                    
                    @keyframes stat-number {
                        0%, 100% { opacity: 0.7; }
                        50% { opacity: 1; }
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
                    .animate-fadeInSlideUp { animation: fadeInSlideUp 0.6s ease-out forwards; }
                    .animate-ai-diagonal-sweep { animation: ai-diagonal-sweep 8s ease-in-out infinite; }
                    .animate-neural-network-pulse { animation: neural-network-pulse 3s ease-in-out infinite; }
                    .animate-ai-data-flow { animation: ai-data-flow 6s linear infinite; }
                    .animate-circuit-pulse { animation: circuit-pulse 2s ease-in-out infinite; }
                    .animate-ai-particle-float { animation: ai-particle-float 12s ease-in-out infinite; }
                    .animate-gradient-shift { animation: gradient-shift 15s ease infinite; background-size: 200% 200%; }
                    .animate-float-gentle { animation: float-gentle 4s ease-in-out infinite; }
                    .animate-float-slow { animation: float-slow 5s ease-in-out infinite; }
                    .animate-svg-pulse { animation: svg-pulse 3s ease-in-out infinite; }
                    .animate-ekg-line { animation: ekg-line 2s linear infinite; stroke-dasharray: 20 5; }
                    .animate-scanner-sweep { animation: scanner-sweep 3s ease-in-out infinite; }
                    .animate-file-slide { animation: file-slide 3s ease-in-out infinite; }
                    .animate-screen-flicker { animation: screen-flicker 2s ease-in-out infinite; }
                    .animate-drawer-open { animation: drawer-open 4s ease-in-out infinite; }
                    .animate-chart-line-draw { animation: chart-line-draw 3s ease-in-out infinite; stroke-dasharray: 300; }
                    .animate-data-point-glow { animation: data-point-glow 2s ease-in-out infinite; }
                    .animate-chart-grid-fade { animation: chart-grid-fade 3s ease-in-out infinite; }
                    .animate-bar-grow { animation: bar-grow 2s ease-out infinite; transform-origin: bottom; }
                    .animate-stat-number { animation: stat-number 2s ease-in-out infinite; }
                    `
                }} />
            </Head>

            {/* Arch Split Background - Light Top, Dark Bottom with Smooth Semicircle Arch */}
            <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
                {/* Light Side - Top Half (Theme Light Purple) */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: '#F9F7FF',
                        clipPath: 'ellipse(200% 80% at 50% -20%)'
                    }}
                />
                
                {/* Dark Side - Bottom Half with Smooth Arch (Theme Dark Purple) */}
                <div 
                    className="absolute inset-0 overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #6D28D9 0%, #5B21B6 50%, #4C1D95 100%)',
                        clipPath: 'ellipse(200% 80% at 50% 120%)'
                    }}
                >
                    {/* Neural Network Nodes - Clean grid layout */}
                    <svg className="absolute inset-0 w-full h-full opacity-50" style={{ zIndex: 0 }}>
                        <defs>
                            <linearGradient id="neural-gradient-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.8" />
                                <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.9" />
                            </linearGradient>
                        </defs>
                        {[...Array(12)].map((_, i) => {
                            const cols = 4;
                            const rows = 3;
                            const col = i % cols;
                            const row = Math.floor(i / cols);
                            const x = 60 + (col * 10);
                            const y = 60 + (row * 15);
                            return (
                                <g key={`neural-dark-${i}`} className="animate-neural-network-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
                                    <circle cx={`${x}%`} cy={`${y}%`} r="3" fill="url(#neural-gradient-dark)" />
                                    {/* Connect to right neighbor */}
                                    {col < cols - 1 && (
                                        <line
                                            x1={`${x}%`}
                                            y1={`${y}%`}
                                            x2={`${x + 10}%`}
                                            y2={`${y}%`}
                                            stroke="url(#neural-gradient-dark)"
                                            strokeWidth="1"
                                            opacity="0.4"
                                        />
                                    )}
                                    {/* Connect to bottom neighbor */}
                                    {row < rows - 1 && (
                                        <line
                                            x1={`${x}%`}
                                            y1={`${y}%`}
                                            x2={`${x}%`}
                                            y2={`${y + 15}%`}
                                            stroke="url(#neural-gradient-dark)"
                                            strokeWidth="1"
                                            opacity="0.4"
                                        />
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                    
                    {/* Flowing Data Streams - Clean diagonal lines */}
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={`stream-dark-${i}`}
                            className="absolute w-1 h-32 bg-gradient-to-b from-purple-300/60 via-purple-400/80 to-transparent animate-ai-data-flow"
                            style={{
                                top: `${55 + i * 8}%`,
                                left: `${60 + i * 6}%`,
                                animationDelay: `${i * 1.5}s`,
                                transform: 'rotate(45deg)',
                                animationDuration: '8s'
                            }}
                        />
                    ))}
                    
                    {/* Circuit Pattern Lines - Subtle background */}
                    <svg className="absolute inset-0 w-full h-full opacity-20" style={{ zIndex: 0 }}>
                        <defs>
                            <pattern id="circuit-pattern-dark" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                                <path
                                    d="M0,50 L40,50 M40,30 L40,70 M40,50 L80,50 M80,40 L80,60 M80,50 L100,50"
                                    stroke="#A78BFA"
                                    strokeWidth="1"
                                    fill="none"
                                    className="animate-circuit-pulse"
                                />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#circuit-pattern-dark)" />
                    </svg>
                    
                    {/* Floating Particles - Subtle movement */}
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={`particle-dark-${i}`}
                            className="absolute w-2 h-2 rounded-full bg-purple-300/50 animate-ai-particle-float blur-sm"
                            style={{
                                left: `${65 + (i % 4) * 8}%`,
                                top: `${65 + Math.floor(i / 4) * 12}%`,
                                animationDelay: `${i * 1.5}s`,
                                animationDuration: '15s'
                            }}
                        />
                    ))}
                    
                    {/* Glowing Orbs - Background glow effect */}
                    {[...Array(4)].map((_, i) => (
                        <div
                            key={`orb-dark-${i}`}
                            className="absolute rounded-full bg-purple-400/20 animate-neural-network-pulse blur-2xl"
                            style={{
                                width: `${100 + i * 30}px`,
                                height: `${100 + i * 30}px`,
                                left: `${65 + (i % 2) * 20}%`,
                                top: `${65 + Math.floor(i / 2) * 20}%`,
                                animationDelay: `${i * 1.2}s`,
                                animationDuration: '5s'
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Premium EMR Healthcare Background Animations */}
            <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
                
                {/* Medical EKG/ECG Heartbeat Pattern */}
                <div className="absolute top-1/4 left-0 w-full h-32 opacity-15">
                    <svg viewBox="0 0 1200 100" className="w-full h-full animate-ekg">
                        <defs>
                            <linearGradient id="ekg-gradient-onboarding" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6640DC" stopOpacity="0.6" />
                                <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#6640DC" stopOpacity="0.4" />
                            </linearGradient>
                        </defs>
                        <path 
                            d="M0,50 L200,50 L210,30 L220,70 L230,20 L240,80 L250,50 L450,50 L460,30 L470,70 L480,20 L490,80 L500,50 L700,50 L710,30 L720,70 L730,20 L740,80 L750,50 L950,50 L960,30 L970,70 L980,20 L990,80 L1000,50 L1200,50"
                            fill="none" 
                            stroke="url(#ekg-gradient-onboarding)" 
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
                            <pattern id="medical-grid-onboarding" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#6640DC" strokeWidth="0.5" opacity="0.3"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#medical-grid-onboarding)" />
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
                            <radialGradient id="molecule-gradient-onboarding">
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
                        <circle cx="60" cy="30" r="4" fill="url(#molecule-gradient-onboarding)" className="animate-atom-pulse" />
                        <circle cx="60" cy="90" r="4" fill="url(#molecule-gradient-onboarding)" className="animate-atom-pulse delay-300" />
                        <circle cx="30" cy="60" r="4" fill="url(#molecule-gradient-onboarding)" className="animate-atom-pulse delay-600" />
                        <circle cx="90" cy="60" r="4" fill="url(#molecule-gradient-onboarding)" className="animate-atom-pulse delay-900" />
                        <circle cx="60" cy="60" r="6" fill="url(#molecule-gradient-onboarding)" className="animate-atom-pulse delay-150" />
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
            {/* Patient Metrics Dashboard Card - Top Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-gentle" style={{ left: '3%', top: '10%', animationDelay: '0s' }}>
                <svg width="200" height="140" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    {/* Card Background */}
                    <rect x="15" y="20" width="110" height="60" rx="4" fill="rgba(139, 92, 246, 0.12)" stroke="rgba(139, 92, 246, 0.6)" strokeWidth="2.5"/>
                    
                    {/* Card Header */}
                    <rect x="20" y="25" width="100" height="12" rx="2" fill="rgba(139, 92, 246, 0.15)" className="animate-pulse-data"/>
                    <text x="25" y="33" fontSize="7" fill="rgba(139, 92, 246, 0.8)" fontWeight="600" className="animate-gentle-pulse">Patient Summary</text>
                    
                    {/* Metric Bars Container */}
                    <g>
                        {/* BP Systolic Bar */}
                        <rect x="25" y="45" width="8" height="25" rx="1" fill="rgba(139, 92, 246, 0.2)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1"/>
                        <rect x="25" y="58" width="8" height="12" rx="1" fill="rgba(139, 92, 246, 0.6)" className="animate-bar-grow" style={{ animationDelay: '0s' }}/>
                        <text x="20" y="75" fontSize="5" fill="rgba(139, 92, 246, 0.6)" className="animate-stat-number" style={{ animationDelay: '0.2s' }}>BP</text>
                        
                        {/* Heart Rate Bar */}
                        <rect x="38" y="45" width="8" height="25" rx="1" fill="rgba(139, 92, 246, 0.2)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1"/>
                        <rect x="38" y="55" width="8" height="15" rx="1" fill="rgba(139, 92, 246, 0.6)" className="animate-bar-grow" style={{ animationDelay: '0.3s' }}/>
                        <text x="33" y="75" fontSize="5" fill="rgba(139, 92, 246, 0.6)" className="animate-stat-number" style={{ animationDelay: '0.5s' }}>HR</text>
                        
                        {/* SpO2 Bar */}
                        <rect x="51" y="45" width="8" height="25" rx="1" fill="rgba(139, 92, 246, 0.2)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1"/>
                        <rect x="51" y="50" width="8" height="20" rx="1" fill="rgba(139, 92, 246, 0.6)" className="animate-bar-grow" style={{ animationDelay: '0.6s' }}/>
                        <text x="48" y="75" fontSize="5" fill="rgba(139, 92, 246, 0.6)" className="animate-stat-number" style={{ animationDelay: '0.8s' }}>O2</text>
                        
                        {/* Temp Bar */}
                        <rect x="64" y="45" width="8" height="25" rx="1" fill="rgba(139, 92, 246, 0.2)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1"/>
                        <rect x="64" y="57" width="8" height="13" rx="1" fill="rgba(139, 92, 246, 0.6)" className="animate-bar-grow" style={{ animationDelay: '0.9s' }}/>
                        <text x="60" y="75" fontSize="5" fill="rgba(139, 92, 246, 0.6)" className="animate-stat-number" style={{ animationDelay: '1.1s' }}>T°</text>
                        
                        {/* Weight Bar */}
                        <rect x="77" y="45" width="8" height="25" rx="1" fill="rgba(139, 92, 246, 0.2)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1"/>
                        <rect x="77" y="52" width="8" height="18" rx="1" fill="rgba(139, 92, 246, 0.6)" className="animate-bar-grow" style={{ animationDelay: '1.2s' }}/>
                        <text x="73" y="75" fontSize="5" fill="rgba(139, 92, 246, 0.6)" className="animate-stat-number" style={{ animationDelay: '1.4s' }}>WT</text>
                        
                        {/* Glucose Bar */}
                        <rect x="90" y="45" width="8" height="25" rx="1" fill="rgba(139, 92, 246, 0.2)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1"/>
                        <rect x="90" y="54" width="8" height="16" rx="1" fill="rgba(139, 92, 246, 0.6)" className="animate-bar-grow" style={{ animationDelay: '1.5s' }}/>
                        <text x="85" y="75" fontSize="5" fill="rgba(139, 92, 246, 0.6)" className="animate-stat-number" style={{ animationDelay: '1.7s' }}>GL</text>
                    </g>
                    
                    {/* Status Indicator */}
                    <circle cx="110" cy="50" r="4" fill="rgba(139, 92, 246, 0.3)" stroke="rgba(139, 92, 246, 0.6)" strokeWidth="1.5" className="animate-vital-pulse"/>
                    <text x="105" y="65" fontSize="5" fill="rgba(139, 92, 246, 0.6)" className="animate-pulse-data">OK</text>
                </svg>
            </div>

            {/* Medical Tablet/Device - Upper Mid Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-slow" style={{ left: '1%', top: '30%', animationDelay: '0.5s' }}>
                <svg width="180" height="130" viewBox="0 0 130 95" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    <rect x="20" y="15" width="90" height="65" rx="6" fill="rgba(99, 102, 241, 0.12)" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2.5"/>
                    <rect x="25" y="20" width="80" height="55" rx="3" fill="rgba(99, 102, 241, 0.08)" className="animate-screen-flicker"/>
                    <rect x="30" y="25" width="70" height="8" rx="2" fill="rgba(99, 102, 241, 0.2)" className="animate-pulse-data"/>
                    <rect x="30" y="38" width="30" height="20" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0s' }}/>
                    <rect x="65" y="38" width="35" height="20" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0.5s' }}/>
                    <rect x="30" y="63" width="70" height="8" rx="2" fill="rgba(99, 102, 241, 0.2)" className="animate-pulse-data" style={{ animationDelay: '1s' }}/>
                    <circle cx="65" cy="85" r="4" fill="rgba(99, 102, 241, 0.4)" className="animate-vital-pulse"/>
                </svg>
            </div>

            {/* Medical Chart/Clipboard - Mid Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-gentle" style={{ left: '6%', top: '50%', animationDelay: '1s' }}>
                <svg width="190" height="140" viewBox="0 0 135 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    <rect x="20" y="15" width="95" height="70" rx="4" fill="rgba(124, 58, 237, 0.12)" stroke="rgba(124, 58, 237, 0.5)" strokeWidth="2.5"/>
                    <line x1="25" y1="30" x2="110" y2="30" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5" className="animate-chart-draw" style={{ animationDelay: '0s' }}/>
                    <line x1="25" y1="40" x2="110" y2="40" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5" className="animate-chart-draw" style={{ animationDelay: '0.3s' }}/>
                    <line x1="25" y1="50" x2="90" y2="50" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5" className="animate-chart-draw" style={{ animationDelay: '0.6s' }}/>
                    <line x1="25" y1="60" x2="100" y2="60" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5" className="animate-chart-draw" style={{ animationDelay: '0.9s' }}/>
                    <line x1="25" y1="70" x2="85" y2="70" stroke="rgba(124, 58, 237, 0.4)" strokeWidth="1.5" className="animate-chart-draw" style={{ animationDelay: '1.2s' }}/>
                    <rect x="25" y="75" width="30" height="8" rx="2" fill="rgba(124, 58, 237, 0.2)" className="animate-pulse-data"/>
                    <rect x="105" y="20" width="8" height="12" rx="2" fill="rgba(124, 58, 237, 0.3)" stroke="rgba(124, 58, 237, 0.5)" strokeWidth="1.5" className="animate-gentle-pulse"/>
                </svg>
            </div>

            {/* Medical Scanner - Lower Mid Left */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-slow" style={{ left: '2%', top: '70%', animationDelay: '1.5s' }}>
                <svg width="200" height="130" viewBox="0 0 140 95" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    <rect x="15" y="25" width="110" height="55" rx="5" fill="rgba(139, 92, 246, 0.12)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth="2.5"/>
                    <rect x="20" y="30" width="100" height="45" rx="3" fill="rgba(139, 92, 246, 0.08)" className="animate-screen-flicker"/>
                    <rect x="20" y="30" width="100" height="45" rx="3" fill="rgba(139, 92, 246, 0.15)" className="animate-scanner-sweep" style={{ mixBlendMode: 'screen' }}/>
                    <rect x="25" y="35" width="90" height="8" rx="2" fill="rgba(139, 92, 246, 0.2)" className="animate-pulse-data"/>
                    <rect x="30" y="48" width="20" height="20" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0s' }}/>
                    <rect x="55" y="48" width="20" height="20" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0.4s' }}/>
                    <rect x="80" y="48" width="20" height="20" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0.8s' }}/>
                    <line x1="25" y1="20" x2="30" y2="25" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2" className="animate-vital-pulse"/>
                    <line x1="115" y1="20" x2="110" y2="25" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2" className="animate-vital-pulse" style={{ animationDelay: '0.5s' }}/>
                </svg>
            </div>

            {/* EKG Monitor - Top Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-gentle" style={{ right: '2%', top: '12%', animationDelay: '0.2s' }}>
                <svg width="190" height="140" viewBox="0 0 135 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    <rect x="15" y="15" width="105" height="60" rx="5" fill="rgba(99, 102, 241, 0.12)" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2.5"/>
                    <rect x="20" y="20" width="95" height="8" rx="2" fill="rgba(99, 102, 241, 0.2)" className="animate-pulse-data"/>
                    <path d="M25 50 L40 40 L55 55 L70 35 L85 60 L100 45 L110 50" stroke="rgba(99, 102, 241, 0.7)" strokeWidth="2.5" fill="none" strokeLinecap="round" className="animate-ekg-line"/>
                    <circle cx="40" cy="40" r="2" fill="rgba(99, 102, 241, 0.8)" className="animate-atom-pulse" style={{ animationDelay: '0s' }}/>
                    <circle cx="70" cy="35" r="2" fill="rgba(99, 102, 241, 0.8)" className="animate-atom-pulse" style={{ animationDelay: '0.3s' }}/>
                    <circle cx="100" cy="45" r="2" fill="rgba(99, 102, 241, 0.8)" className="animate-atom-pulse" style={{ animationDelay: '0.6s' }}/>
                </svg>
            </div>

            {/* Medical Storage Unit - Upper Mid Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-slow" style={{ right: '5%', top: '32%', animationDelay: '0.7s' }}>
                <svg width="180" height="150" viewBox="0 0 125 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    <rect x="20" y="20" width="85" height="70" rx="5" fill="rgba(168, 85, 247, 0.12)" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2.5"/>
                    <line x1="20" y1="45" x2="105" y2="45" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="2"/>
                    <line x1="20" y1="65" x2="105" y2="65" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="2"/>
                    <rect x="25" y="25" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" className="animate-drawer-open" style={{ animationDelay: '0s' }}/>
                    <rect x="65" y="25" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" className="animate-drawer-open" style={{ animationDelay: '0.5s' }}/>
                    <rect x="25" y="70" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" className="animate-drawer-open" style={{ animationDelay: '1s' }}/>
                    <rect x="65" y="70" width="35" height="15" rx="2" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" className="animate-drawer-open" style={{ animationDelay: '1.5s' }}/>
                    <circle cx="42" cy="32" r="2" fill="rgba(168, 85, 247, 0.4)" className="animate-vital-pulse" style={{ animationDelay: '0s' }}/>
                    <circle cx="82" cy="32" r="2" fill="rgba(168, 85, 247, 0.4)" className="animate-vital-pulse" style={{ animationDelay: '0.5s' }}/>
                </svg>
            </div>

            {/* Medical Computer Station - Mid Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-gentle" style={{ right: '1%', top: '52%', animationDelay: '1.2s' }}>
                <svg width="200" height="140" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    <rect x="15" y="30" width="110" height="55" rx="4" fill="rgba(139, 92, 246, 0.12)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth="2.5"/>
                    <rect x="20" y="35" width="100" height="45" rx="3" fill="rgba(139, 92, 246, 0.08)" className="animate-screen-flicker"/>
                    <rect x="25" y="40" width="90" height="6" rx="2" fill="rgba(139, 92, 246, 0.2)" className="animate-pulse-data"/>
                    <rect x="30" y="50" width="25" height="18" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0s' }}/>
                    <rect x="60" y="50" width="30" height="18" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0.4s' }}/>
                    <rect x="95" y="50" width="25" height="18" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" className="animate-gentle-pulse" style={{ animationDelay: '0.8s' }}/>
                    <rect x="30" y="72" width="90" height="6" rx="2" fill="rgba(139, 92, 246, 0.2)" className="animate-pulse-data" style={{ animationDelay: '1s' }}/>
                    <rect x="50" y="20" width="40" height="12" rx="2" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2" className="animate-gentle-pulse"/>
                </svg>
            </div>

            {/* Medical Filing System - Lower Right */}
            <div className="fixed z-0 pointer-events-none opacity-50 hidden lg:block animate-float-slow" style={{ right: '4%', top: '72%', animationDelay: '1.8s' }}>
                <svg width="190" height="130" viewBox="0 0 135 95" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-svg-pulse">
                    <rect x="20" y="20" width="95" height="60" rx="4" fill="rgba(99, 102, 241, 0.12)" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2.5"/>
                    <line x1="20" y1="40" x2="115" y2="40" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2"/>
                    <line x1="20" y1="55" x2="115" y2="55" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2"/>
                    <rect x="25" y="25" width="20" height="12" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-file-slide" style={{ animationDelay: '0s' }}/>
                    <rect x="50" y="25" width="20" height="12" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-file-slide" style={{ animationDelay: '0.2s' }}/>
                    <rect x="75" y="25" width="20" height="12" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-file-slide" style={{ animationDelay: '0.4s' }}/>
                    <rect x="25" y="60" width="20" height="15" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-file-slide" style={{ animationDelay: '0.6s' }}/>
                    <rect x="50" y="60" width="20" height="15" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-file-slide" style={{ animationDelay: '0.8s' }}/>
                    <rect x="75" y="60" width="20" height="15" rx="2" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" className="animate-file-slide" style={{ animationDelay: '1s' }}/>
                </svg>
            </div>

            {/* Logo - Fixed at top left */}
            {showLogoProp && (
                <div className="fixed top-0 left-0 z-50 py-6 pl-6 pointer-events-none">
                    <div className="pointer-events-auto">
                        <AppLogoIcon className="h-8 w-auto drop-shadow-lg" />
                    </div>
                </div>
            )}
            
            {/* Content Container */}
            <div className="relative z-10 w-full min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
                <motion.div 
                    className={`w-full ${contentClassName}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                        duration: 0.6, 
                        ease: [0.25, 0.1, 0.25, 1] // Custom easing for soothing effect
                    }}
                >
                    {children}
                </motion.div>
            </div>
        </div>
    );
}

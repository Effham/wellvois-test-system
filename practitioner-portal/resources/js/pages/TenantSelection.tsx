import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { router, usePage } from '@inertiajs/react';
import { Hospital, ChevronRight, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Tenant {
    id: string;
    name: string;
    domain: string;
}

interface TenantSelectionProps {
    tenants: Tenant[];
    user?: { name?: string };
    logout?: boolean;
    auth?: { user?: { name?: string } };
}

export default function TenantSelection({ tenants, user, logout, auth }: TenantSelectionProps) {
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
    const [transitionProgress, setTransitionProgress] = useState(0);
    
    // Safely get user info with fallback
    const userInfo = user?.name ? { user } : auth?.user;
    
    // Check for flash success messages (indicates invitation acceptance)
    const { flash } = usePage().props as any;
    const hasSuccessMessage = flash?.success;
    
    // Handle single tenant scenarios - auto-redirect
    useEffect(() => {
        if (tenants.length === 1 && !selectedTenant) {
            // Auto-redirect to the single tenant after a short delay
            const delay = hasSuccessMessage ? 500 : 500;
            setTimeout(() => {
                handleSelect(tenants[0].id);
            }, delay);
        }
    }, [tenants, selectedTenant, hasSuccessMessage]);
    
    const handleSelect = (tenantId: string) => {
        setSelectedTenant(tenantId);
        setTransitionProgress(0);
        
        // Start the transition animation
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            setTransitionProgress(progress);
            
            if (progress >= 100) {
                clearInterval(interval);
                // Navigate after animation completes
                router.post(route('tenant.sso.redirect'), { tenant_id: tenantId });
            }
        }, 40);
    };

    // Get the selected tenant details for transition
    const selectedTenantData = tenants?.find(t => t.id === selectedTenant);

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F9F7FF] via-[#FEFBFF] to-[#F5F3FF] p-4 sm:p-6 lg:p-8 overflow-hidden">
            {/* Premium EMR Healthcare Background Animations */}
            <div className="absolute inset-0 overflow-hidden">
                
                {/* Medical EKG/ECG Heartbeat Pattern */}
                <div className="absolute top-1/4 left-0 w-full h-32 opacity-15">
                    <svg viewBox="0 0 1200 100" className="w-full h-full animate-ekg">
                        <defs>
                            <linearGradient id="ekg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6640DC" stopOpacity="0.6" />
                                <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#6640DC" stopOpacity="0.4" />
                            </linearGradient>
                        </defs>
                        <path 
                            d="M0,50 L200,50 L210,30 L220,70 L230,20 L240,80 L250,50 L450,50 L460,30 L470,70 L480,20 L490,80 L500,50 L700,50 L710,30 L720,70 L730,20 L740,80 L750,50 L950,50 L960,30 L970,70 L980,20 L990,80 L1000,50 L1200,50"
                            fill="none" 
                            stroke="url(#ekg-gradient)" 
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
                            <pattern id="medical-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#6640DC" strokeWidth="0.5" opacity="0.3"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#medical-grid)" />
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
                            <radialGradient id="molecule-gradient">
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
                        <circle cx="60" cy="30" r="4" fill="url(#molecule-gradient)" className="animate-atom-pulse" />
                        <circle cx="60" cy="90" r="4" fill="url(#molecule-gradient)" className="animate-atom-pulse delay-300" />
                        <circle cx="30" cy="60" r="4" fill="url(#molecule-gradient)" className="animate-atom-pulse delay-600" />
                        <circle cx="90" cy="60" r="4" fill="url(#molecule-gradient)" className="animate-atom-pulse delay-900" />
                        <circle cx="60" cy="60" r="6" fill="url(#molecule-gradient)" className="animate-atom-pulse delay-150" />
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

            {/* Tenant Transition Portal Effect */}
            {selectedTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Gentle Background Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-sidebar-accent/10 to-purple-600/10 animate-fade-in" />
                    
                    {/* Subtle Scanning Ring */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-40 border border-sidebar-accent/30 rounded-full animate-gentle-ring" />
                    </div>

                    {/* Central Portal Content */}
                    <div className="relative z-10 text-center space-y-4 bg-white/95 backdrop-blur-lg rounded-2xl w-72 h-auto p-8 border border-purple-100/50 shadow-xl mx-4">
                        {/* Tenant Logo Area */}
                        <div className="relative mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-sidebar-accent to-purple-600 rounded-xl flex items-center justify-center mx-auto shadow-lg">
                                <Building2 className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        {/* Transition Messages */}
                        <div className="space-y-3">
                            <h3 className="text-xl font-semibold text-gray-900">
                                Entering {selectedTenantData?.name}
                            </h3>
                            
                            <div className="text-sm text-gray-600">
                                {transitionProgress < 50 ? (
                                    <span>Connecting to workspace...</span>
                                ) : (
                                    <span>Almost ready!</span>
                                )}
                            </div>
                        </div>

                        {/* Simple Progress Bar */}
                        <div className="space-y-2">
                            <Progress value={transitionProgress} className="w-full h-2" />
                            <div className="text-xs text-gray-500">
                                {Math.round(transitionProgress)}% Complete
                            </div>
                        </div>
                    </div>

                    {/* Floating Medical Data Elements */}
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(8)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute text-xs text-sidebar-accent/30 font-mono animate-data-float"
                                style={{
                                    left: `${20 + (i * 10)}%`,
                                    top: `${20 + (i * 8)}%`,
                                    animationDelay: `${i * 0.3}s`,
                                }}
                            >
                                {['EMR', 'SYNC', 'DATA', 'SECURE', 'SCAN', 'LOAD', 'INIT', 'READY'][i]}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="relative z-20 w-full max-w-md">
                    {/* Header Section */}
                    <div className="mb-8 text-center">
                        <div className="mb-6 inline-flex">
                            <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-sidebar-accent to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl animate-gentle-pulse">
                                    <Hospital className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
                                {/* Subtle glow effect */}
                                <div className="absolute inset-0 w-16 h-16 bg-sidebar-accent/20 rounded-2xl blur-xl animate-gentle-pulse"></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-sidebar-accent to-purple-700 bg-clip-text text-transparent">
                                Welcome back !
                            </h1>
                            <p className="text-gray-600">Choose your workspace to continue your journey</p>
                        </div>
                    </div>

                    {/* Success Message Display */}
                    {hasSuccessMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full"></div>
                                    </div>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-green-800">
                                        {flash?.success}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tenants Section */}
                    <div className="space-y-3">
                        {tenants && tenants.length > 0 ? (
                            tenants.map((tenant, index) => (
                                <Card
                                    key={tenant.id}
                                    className={`group cursor-pointer border border-purple-100/50 bg-white/80 backdrop-blur-md transition-all duration-300 hover:border-sidebar-accent/30 hover:shadow-xl hover:shadow-purple-100/50 hover:bg-white/95 transform hover:scale-[1.02] hover:backdrop-blur-lg ${
                                        selectedTenant === tenant.id ? 'scale-105 shadow-2xl shadow-purple-200/60 border-sidebar-accent/50' : ''
                                    }`}
                                    onClick={() => handleSelect(tenant.id)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center space-x-4 min-w-0 flex-1">
                                                <div className="relative flex-shrink-0">
                                                    <div className={`w-12 h-12 bg-gradient-to-br from-sidebar-accent/10 to-purple-100 rounded-xl flex items-center justify-center group-hover:from-sidebar-accent/20 group-hover:to-purple-200 transition-all duration-300 shadow-lg ${
                                                        selectedTenant === tenant.id ? 'animate-portal-pulse from-sidebar-accent/30 to-purple-200' : ''
                                                    }`}>
                                                        <Building2 className="w-6 h-6 text-sidebar-accent" />
                                                    </div>
                                                    {index === 0 && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-green-400 to-green-500 rounded-full border border-white animate-pulse" />
                                                    )}
                                                    {selectedTenant === tenant.id && (
                                                        <div className="absolute inset-0 w-12 h-12 border-2 border-sidebar-accent/40 rounded-xl animate-scan-ring-1" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1 overflow-hidden">
                                                    <h3 className="font-semibold text-gray-900 group-hover:text-sidebar-accent transition-colors duration-200 truncate">
                                                        {tenant.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 truncate" title={tenant.domain}>{tenant.domain}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className={`w-5 h-5 text-gray-400 group-hover:text-sidebar-accent group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 ${
                                                selectedTenant === tenant.id ? 'translate-x-2 text-sidebar-accent' : ''
                                            }`} />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Card className="border border-purple-100/50 bg-white/80 backdrop-blur-md">
                                <CardContent className="p-8 text-center">
                                    <div className="space-y-4">
                                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                                            <Building2 className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="font-semibold text-gray-900">No workspaces available</h3>
                                            <p className="text-sm text-gray-500">Contact your administrator to get access to a workspace.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
                            <span>Need help?</span>
                            <button className="text-sidebar-accent hover:text-purple-700 hover:underline transition-colors duration-200 font-medium">
                                Contact support
                            </button>
                        </div>
                    </div>

                {/* Enhanced decorative elements */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-sidebar-accent/10 to-transparent rounded-full blur-3xl -translate-x-16 -translate-y-16 animate-gentle-pulse" />
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-200/30 to-transparent rounded-full blur-2xl translate-x-12 translate-y-12 animate-gentle-pulse delay-2000" />
            </div>

            {/* Premium EMR Healthcare Animation Styles */}
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
                
                /* Gentle Transition Animations */
                @keyframes fade-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                
                @keyframes gentle-ring {
                    0% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.1); opacity: 0.6; }
                    100% { transform: scale(1.2); opacity: 0; }
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
                
                /* Gentle Transition Classes */
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                .animate-gentle-ring { animation: gentle-ring 3s ease-out infinite; }
                `
            }} />
        </div>
    );
}


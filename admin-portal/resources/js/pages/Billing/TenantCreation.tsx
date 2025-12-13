import { imageAsset } from '@/utils/asset';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

const SETUP_STEPS = [
    {
        title: "Creating your clinic workspace",
        subtitle: "Preparing your secure tenant and database."
    },
    {
        title: "Configuring roles & permissions",
        subtitle: "Doctors, front desk, lab, pharmacy, admins."
    },
    {
        title: "Setting up patient records system",
        subtitle: "Demographics, MRN rules, visit templates."
    },
    {
        title: "Loading clinical templates",
        subtitle: "SOAP notes, prescriptions, lab orders."
    },
    {
        title: "Connecting billing & insurance settings",
        subtitle: "Invoices, receipts, claims, price lists."
    },
    {
        title: "Enabling appointment & queue management",
        subtitle: "Slots, reminders, walk-ins, triage."
    },
    {
        title: "Activating labs, radiology & pharmacy modules",
        subtitle: "Order → result → dispense workflows."
    },
    {
        title: "Applying security & compliance",
        subtitle: "Audit logs, backups, access controls."
    },
    {
        title: "Finalizing your dashboard",
        subtitle: "Almost ready to launch."
    }
];

type TenantCreationProps = {
    tenant?: {
        id: string;
        name: string;
    } | null;
    sessionId?: string;
    registrationUuid?: string;
    email?: string;
    polling?: boolean;
};

export default function TenantCreation({ tenant, sessionId, registrationUuid, email, polling = false }: TenantCreationProps) {
    const [currentSetupStep, setCurrentSetupStep] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollingRef = useRef(false);

    // API polling logic: Poll /api/tenant-creation-status every 2.5 seconds
    useEffect(() => {
        // If tenant already exists and is complete, skip polling
        if (tenant && !polling) {
            setIsComplete(true);
            return;
        }

        // If already polling, skip
        if (pollingRef.current) {
            return;
        }

        // If already complete, skip
        if (isComplete) {
            return;
        }

        const pollStatus = async () => {
            try {
                const params = new URLSearchParams();
                if (tenant?.id) {
                    params.append('tenant_id', tenant.id);
                }
                if (registrationUuid) {
                    params.append('registration_uuid', registrationUuid);
                }

                const response = await fetch(`/api/tenant-creation-status?${params.toString()}`, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to check status');
                }

                const data = await response.json();

                if (data.is_complete) {
                    setIsComplete(true);
                    // Trigger final step
                    if (currentSetupStep < SETUP_STEPS.length) {
                        setCurrentSetupStep(SETUP_STEPS.length);
                    }
                } else if (data.error) {
                    setError(data.error);
                }
            } catch (err) {
                console.error('Error polling status:', err);
                setError('Failed to check tenant creation status. Please refresh the page.');
            }
        };

        // Poll immediately, then every 2.5 seconds
        pollingRef.current = true;
        pollStatus();
        const interval = setInterval(pollStatus, 2500);

        return () => {
            clearInterval(interval);
            pollingRef.current = false;
        };
    }, [tenant, registrationUuid, polling, isComplete, currentSetupStep]);

    // Progress through setup steps (animated, but sync final step with actual completion)
    useEffect(() => {
        if (isComplete && currentSetupStep < SETUP_STEPS.length) {
            // If complete, immediately go to final step
            setCurrentSetupStep(SETUP_STEPS.length);
            return;
        }

        if (currentSetupStep < SETUP_STEPS.length && !isComplete) {
            const timer = setTimeout(() => {
                setCurrentSetupStep(prev => Math.min(prev + 1, SETUP_STEPS.length - 1));
            }, 2500); // Same timing as polling
            return () => clearTimeout(timer);
        } else if (isComplete && currentSetupStep >= SETUP_STEPS.length) {
            // All steps complete and tenant creation is done, redirect via SSO after a short delay
            const redirectTimer = setTimeout(() => {
                // Use SSO redirect endpoint instead of direct navigation
                const params = new URLSearchParams();
                if (tenant?.id) {
                    params.append('tenant_id', tenant.id);
                }
                if (registrationUuid) {
                    params.append('registration_uuid', registrationUuid);
                }
                // Use router.visit for SSO redirect (will be handled by backend)
                window.location.href = `/tenant-creation/redirect?${params.toString()}`;
            }, 1500); // Give time to show completion message
            return () => clearTimeout(redirectTimer);
        }
    }, [currentSetupStep, isComplete, tenant, registrationUuid]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Head title="Setting Up Your Workspace" />

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md"
            >
                <div className="w-full max-w-md p-8 text-center">
                    {/* Logo */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="mb-12 flex justify-center"
                    >
                        <img
                            src={`${imageAsset('/brand/images/mainLogo.png')}`}
                            alt="Logo"
                            className="h-10 w-auto"
                        />
                    </motion.div>

                    {/* Progress Ring & Icon */}
                    <div className="relative w-32 h-32 mx-auto mb-10">
                        {/* Pulsing Background */}
                        <motion.div
                            className="absolute inset-0 rounded-full bg-purple-100"
                            animate={{
                                scale: [1, 1.1, 1],
                                opacity: [0.5, 0.2, 0.5]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />

                        <svg className="w-full h-full transform -rotate-90 relative z-10">
                            <circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                className="text-gray-100"
                            />
                            <motion.circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                className="text-purple-600"
                                initial={{ pathLength: 0 }}
                                animate={{
                                    pathLength: (currentSetupStep + 1) / SETUP_STEPS.length
                                }}
                                transition={{ duration: 1, ease: "easeInOut" }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                            {currentSetupStep < SETUP_STEPS.length ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                >
                                    <img 
                                        src="/brand/images/Vector.svg" 
                                        alt="Valovis" 
                                        className="w-10 h-10" 
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                >
                                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Steps Text */}
                    <div className="h-32 relative">
                        <AnimatePresence mode="wait">
                            {error ? (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute inset-0 w-full"
                                >
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <h3 className="text-lg font-bold text-red-900 mb-2">
                                            Setup Error
                                        </h3>
                                        <p className="text-sm text-red-700">
                                            {error}
                                        </p>
                                    </div>
                                </motion.div>
                            ) : currentSetupStep < SETUP_STEPS.length ? (
                                <motion.div
                                    key={currentSetupStep}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, scale: 1.05 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="absolute inset-0 w-full"
                                >
                                    <motion.h3
                                        className="text-2xl font-bold text-gray-900 mb-3"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        {SETUP_STEPS[currentSetupStep].title}
                                    </motion.h3>
                                    <motion.p
                                        className="text-gray-500 text-lg"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        {SETUP_STEPS[currentSetupStep].subtitle}
                                    </motion.p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="complete"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute inset-0 w-full"
                                >
                                    <h3 className="text-3xl font-bold text-gray-900 mb-3">
                                        Welcome to Wellovis
                                    </h3>
                                    <p className="text-gray-500 text-lg">
                                        Redirecting you to your dashboard...
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Progress Text */}
                    <motion.div
                        className="mt-8"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <p className="text-sm font-medium text-purple-600">
                            {Math.min(100, Math.round(((currentSetupStep + 1) / SETUP_STEPS.length) * 100))}% Complete
                        </p>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { imageAsset } from '@/utils/asset';
import { useState, useEffect } from 'react';
import { useForm, router, Head, usePage } from '@inertiajs/react';
import { LoaderCircle, Eye, EyeOff, CheckCircle2, X, Loader2, Pencil, Sparkles, Mail, Lock } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import OnboardingLayout from '@/components/onboarding-layout';

type Plan = {
    id: number;
    name: string;
    slug: string;
    price: number;
    formatted_price: string;
    billing_cycle: string;
    billing_interval: string;
    billing_interval_count: number;
    description: string;
    features: string[];
    is_featured?: boolean;
};

type RegisterPublicProps = {
    baseDomain: string;
    plans: Plan[];
    preSelectedPlan?: Plan | null;
    invalidPlan?: boolean;
};

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

export default function RegisterPublic({ baseDomain, plans, preSelectedPlan, invalidPlan }: RegisterPublicProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
    const [showSetupLoader, setShowSetupLoader] = useState(false);
    const [currentSetupStep, setCurrentSetupStep] = useState(0);
    const [inertiaNavigationFinished, setInertiaNavigationFinished] = useState(false);
    const [navigationStarted, setNavigationStarted] = useState(false);

    // Dynamic page title based on step
    const getPageTitle = () => {
        switch (currentStep) {
            case 1:
                return 'Register - Practice Information';
            case 2:
                return 'Register - Verify Email';
            case 3:
                return preSelectedPlan ? 'Register - Create Password' : 'Register - Choose Plan';
            case 4:
                return 'Register - Create Password';
            default:
                return 'Register';
        }
    };
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isDomainManuallyEdited, setIsDomainManuallyEdited] = useState(false);
    const [isDomainFieldEnabled, setIsDomainFieldEnabled] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<number | null>(preSelectedPlan?.id ?? null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>(
        preSelectedPlan?.billing_interval === 'year' ? 'annually' : 'monthly'
    );
    const { url } = usePage();
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        domain: '',
        company_name: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
        admin_password_confirmation: '',
        plan_id: preSelectedPlan?.id ?? null as number | null,
    });

    // Populate form data from URL parameters when returning from change-plan page
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const domain = urlParams.get('domain');
            const companyName = urlParams.get('company_name');
            const adminName = urlParams.get('admin_name');
            const adminEmail = urlParams.get('admin_email');
            const planSlug = urlParams.get('plan');

            if (domain) setData('domain', domain);
            if (companyName) setData('company_name', companyName);
            if (adminName) setData('admin_name', adminName);
            if (adminEmail) setData('admin_email', adminEmail);

            // Update plan_id if plan slug is provided (from change-plan page)
            if (planSlug && preSelectedPlan?.slug !== planSlug) {
                const newPlan = plans.find(p => p.slug === planSlug);
                if (newPlan) {
                    setSelectedPlan(newPlan.id);
                    setData('plan_id', newPlan.id);
                    // Update billing cycle based on new plan
                    setBillingCycle(newPlan.billing_interval === 'year' ? 'annually' : 'monthly');
                }
            }
        }
    }, [url, preSelectedPlan, plans]);

    const validateStep1 = (): { isValid: boolean; errors: Record<string, string> } => {
        const errors: Record<string, string> = {};

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!data.admin_email || !emailRegex.test(data.admin_email)) {
            errors.admin_email = 'Please enter a valid email address';
        }

        // Validate domain format (alphanumeric and hyphens only, minimum 3 characters)
        const domainRegex = /^[a-zA-Z0-9-]{3,}$/;
        if (!data.domain || !domainRegex.test(data.domain)) {
            errors.domain = 'Domain must be at least 3 characters and contain only letters, numbers, and hyphens';
        }

        // Validate admin name has both first and last name
        const nameParts = data.admin_name.trim().split(/\s+/);
        if (!data.admin_name || nameParts.length < 2) {
            errors.admin_name = 'Please enter both first and last name';
        }

        // Validate practice name
        if (!data.company_name || data.company_name.trim().length === 0) {
            errors.company_name = 'Practice name is required';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
        };
    };

    const sendOTP = async () => {
        if (!data.admin_email) {
            return;
        }

        setSendingOtp(true);
        setOtpError('');

        try {
            const response = await axios.post(route('register.send-otp'), {
                email: data.admin_email,
            });

            if (response.data.success) {
                setCurrentStep(2);
                setResendTimer(60); // Start 60 second countdown
                clearErrors();
                setValidationErrors({}); // Clear validation errors when moving to next step
            }
        } catch (error: any) {
            if (error.response?.data?.message) {
                setOtpError(error.response.data.message);
            } else {
                setOtpError('Failed to send verification code. Please try again.');
            }
        } finally {
            setSendingOtp(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) {
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setOtpError('');
        
        // Reset auto-submit flag when user manually changes OTP
        // This allows auto-submit to work again after user corrects the code
        if (hasAutoSubmitted) {
            setHasAutoSubmitted(false);
        }

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    // Auto-focus first OTP input when step 2 becomes active
    useEffect(() => {
        if (currentStep === 2) {
            // Small delay to ensure the input is rendered
            const timer = setTimeout(() => {
                const firstOtpInput = document.getElementById('otp-0');
                firstOtpInput?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [currentStep]);

    // Auto-submit OTP when all 6 digits are filled
    useEffect(() => {
        const otpString = otp.join('');
        // Only auto-submit if:
        // - All 6 digits are filled
        // - Not currently verifying
        // - On step 2 (OTP verification step)
        // - Hasn't already auto-submitted (prevents infinite loop)
        // - No error exists (prevents resubmission after error)
        if (otpString.length === 6 && !verifyingOtp && currentStep === 2 && !hasAutoSubmitted && !otpError) {
            // Small delay to ensure state is updated
            const timer = setTimeout(() => {
                setHasAutoSubmitted(true);
                verifyOTP();
            }, 200);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otp, verifyingOtp, currentStep, hasAutoSubmitted, otpError]);

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];
        
        for (let i = 0; i < pastedData.length; i++) {
            newOtp[i] = pastedData[i];
        }
        
        setOtp(newOtp);
        setOtpError('');
        
        // Reset auto-submit flag when user pastes new code
        setHasAutoSubmitted(false);

        // Focus the next empty input or the last one
        const nextEmptyIndex = newOtp.findIndex(val => !val);
        const focusIndex = nextEmptyIndex === -1 ? 5 : Math.min(nextEmptyIndex, 5);
        const nextInput = document.getElementById(`otp-${focusIndex}`);
        nextInput?.focus();
    };

    const verifyOTP = async () => {
        const otpString = otp.join('');
        if (!otpString || otpString.length !== 6) {
            setOtpError('Please enter a valid 6-digit code');
            return;
        }

        setVerifyingOtp(true);
        setOtpError('');

        try {
            const response = await axios.post(route('register.verify-otp'), {
                email: data.admin_email,
                otp: otpString,
            });

            if (response.data.success) {
                // Skip plan selection if a plan is pre-selected
                if (preSelectedPlan) {
                    setCurrentStep(4); // Go directly to password setup
                } else {
                    setCurrentStep(3); // Go to plan selection
                }
                clearErrors();
            }
        } catch (error: any) {
            if (error.response?.data?.message) {
                setOtpError(error.response.data.message);
            } else {
                setOtpError('Verification failed. Please try again.');
            }
        } finally {
            setVerifyingOtp(false);
        }
    };

    const resendOTP = async () => {
        if (resendTimer > 0) {
            return;
        }
        await sendOTP();
    };

    // Password validation requirements
    const getPasswordRequirements = () => {
        const password = data.admin_password || '';
        return [
            {
                label: 'At least 8 characters',
                met: password.length >= 8,
            },
            {
                label: 'At least one uppercase letter',
                met: /[A-Z]/.test(password),
            },
            {
                label: 'At least one lowercase letter',
                met: /[a-z]/.test(password),
            },
            {
                label: 'At least one number',
                met: /[0-9]/.test(password),
            },
            {
                label: 'At least one special character',
                met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
            },
        ];
    };

    const passwordsMatch = () => {
        return data.admin_password && data.admin_password_confirmation && 
               data.admin_password === data.admin_password_confirmation;
    };

    const checkEmailExists = async (email: string, workspaceUrl?: string): Promise<{ emailExists: boolean; workspaceUrlExists: boolean }> => {
        try {
            setCheckingEmail(true);
            // Use route helper if available, otherwise use direct URL
            const apiUrl = typeof route !== 'undefined' ? route('api.check-email-exists') : '/api/check-email-exists';
            const requestData: { email: string; workspace_url?: string } = {
                email: email.trim().toLowerCase(),
            };
            
            // Include workspace URL if provided
            if (workspaceUrl) {
                requestData.workspace_url = workspaceUrl.trim().toLowerCase();
            }
            
            const response = await axios.post(apiUrl, requestData);
            
            const emailExists = response.data.success && response.data.email_exists === true;
            const workspaceUrlExists = response.data.success && response.data.workspace_url_exists === true;
            
            // Set validation errors for email
            if (emailExists) {
                setValidationErrors((prev) => ({
                    ...prev,
                    admin_email: 'You’re already registered! Sign in to pick up right where you stopped.',
                }));
            }
            
            // Set validation errors for workspace URL
            if (workspaceUrlExists) {
                setValidationErrors((prev) => ({
                    ...prev,
                    domain: response.data.workspace_url_message || 'This workspace URL is already taken',
                }));
            }
            
            return { emailExists, workspaceUrlExists };
        } catch (error: any) {
            // On error, allow registration to proceed (don't block on API failure)
            console.error('Error checking email/workspace URL:', error);
            if (error.response?.data?.message) {
                setValidationErrors((prev) => ({
                    ...prev,
                    admin_email: error.response.data.message,
                }));
            }
            return { emailExists: false, workspaceUrlExists: false };
        } finally {
            setCheckingEmail(false);
        }
    };

    const nextStep = async () => {
        if (currentStep === 1) {
            // Validate form before proceeding
            const validation = validateStep1();
            if (!validation.isValid) {
                setValidationErrors(validation.errors);
                return;
            }
            
            // Check if workspace URL already exists (email check is informational only)
            const { emailExists, workspaceUrlExists } = await checkEmailExists(data.admin_email, data.domain);
            if (workspaceUrlExists) {
                return; // Stop here if workspace URL is taken, error already set in validationErrors
            }
            // Email existence doesn't block registration - user can register with existing email
            
            // Clear validation errors if validation passes
            setValidationErrors({});
            sendOTP();
        } else if (currentStep < 3) {
            clearErrors();
            setDirection('forward');
            setCurrentStep(currentStep + 1);
        }
    };

    const previousStep = () => {
        if (currentStep > 1) {
            setDirection('backward');
            // If on step 4 (password) with pre-selected plan, go back to step 2 (OTP)
            // Skip step 3 (plan selection) since plan is already selected
            if (currentStep === 4 && preSelectedPlan) {
                setCurrentStep(2);
            } else {
                setCurrentStep(currentStep - 1);
            }
            setOtpError('');
            setOtp(['', '', '', '', '', '']);
            setHasAutoSubmitted(false); // Reset auto-submit flag when going back
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate password fields before submitting
        if (!data.admin_password || !data.admin_password_confirmation) {
            return;
        }
        
        if (data.admin_password !== data.admin_password_confirmation) {
            setValidationErrors({
                admin_password_confirmation: 'Passwords do not match',
            });
            return;
        }
        
        setIsSubmitting(true);
        
        // Use axios directly to handle JSON response with payment URL
        // Inertia's post() can't handle external redirects to Stripe
        try {
            const response = await axios.post(route('register.prepare'), data);

            if (response.data?.payment_url) {
                // Redirect to Stripe payment link
                window.location.href = response.data.payment_url;
            } else {
                // This shouldn't happen, but if it does, show error
                setIsSubmitting(false);
                setValidationErrors({
                    submit: 'Failed to prepare registration. Please try again.',
                });
            }
        } catch (error: any) {
            console.error('Registration error:', error);
            setIsSubmitting(false);
            
            // Handle validation errors
            if (error.response?.status === 422 && error.response?.data?.errors) {
                // Set validation errors for display
                const backendErrors = error.response.data.errors;
                setValidationErrors(backendErrors);
            } else if (error.response?.data?.message) {
                // Handle other error messages
                setValidationErrors({
                    submit: error.response.data.message,
                });
            } else {
                // Generic error
                setValidationErrors({
                    submit: 'An error occurred during registration. Please try again.',
                });
            }
        }
    };

    // Handle setup steps progression - slowed down
    useEffect(() => {
        if (showSetupLoader) {
            if (currentSetupStep < SETUP_STEPS.length) {
                const timer = setTimeout(() => {
                    setCurrentSetupStep(prev => prev + 1);
                }, 2500); // Increased from 1500ms to 2500ms per step to slow down loader
                return () => clearTimeout(timer);
            }
        }
    }, [showSetupLoader, currentSetupStep]);

    // Sync loader with Inertia navigation events
    useEffect(() => {
        if (!showSetupLoader) {
            return;
        }

        const handleStart = () => {
            setNavigationStarted(true);
        };

        const handleFinish = () => {
            // Mark navigation as finished
            setInertiaNavigationFinished(true);
        };

        // Subscribe to Inertia navigation events
        const removeStartListener = router.on('start', handleStart);
        const removeFinishListener = router.on('finish', handleFinish);

        return () => {
            removeStartListener();
            removeFinishListener();
        };
    }, [showSetupLoader]);

    // Hide loader only when both conditions are met:
    // 1. All setup steps are complete (currentSetupStep >= SETUP_STEPS.length)
    // 2. Inertia navigation has finished (inertiaNavigationFinished === true)
    // Also ensure minimum display time for smooth UX
    useEffect(() => {
        if (!showSetupLoader) {
            return;
        }

        // Check if both conditions are met
        const allStepsComplete = currentSetupStep >= SETUP_STEPS.length;
        const navigationComplete = inertiaNavigationFinished;

        if (allStepsComplete && navigationComplete) {
            // Add a small delay to ensure smooth transition and let progress bar complete
            const timer = setTimeout(() => {
                setShowSetupLoader(false);
                setCurrentSetupStep(0);
                setNavigationStarted(false);
                setInertiaNavigationFinished(false);
            }, 800); // Increased delay to ensure progress bar completes

            return () => clearTimeout(timer);
        }

        // Fallback: If steps complete but navigation hasn't started yet, wait for it
        // This handles the case where navigation might be delayed
        if (allStepsComplete && !navigationStarted) {
            // Wait a bit longer for navigation to start
            const fallbackTimer = setTimeout(() => {
                // If navigation still hasn't started after steps complete, 
                // assume it will happen soon and keep waiting
            }, 1000);

            return () => clearTimeout(fallbackTimer);
        }
    }, [showSetupLoader, currentSetupStep, inertiaNavigationFinished, navigationStarted]);

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => {
                setResendTimer(resendTimer - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Reset to step 1 if there are validation errors for step 1 fields (only on form submission)
    useEffect(() => {
        const step1Fields = ['admin_name', 'admin_email', 'company_name', 'domain'] as const;
        const hasStep1Errors = step1Fields.some(field => errors[field as keyof typeof errors]);

        // Only reset to step 1 if there are errors and we're on step 4 
        if (hasStep1Errors && currentStep === 4) {
            setCurrentStep(1);
        }
    }, [errors, currentStep]);

    // Auto-populate domain from practice name
    useEffect(() => {
        // Only auto-generate if domain field is disabled (not manually edited) and practice name is not empty
        if (data.company_name && !isDomainFieldEnabled && !isDomainManuallyEdited) {
            const suggestedSubdomain = data.company_name
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9-]/g, '');
            // Generate just the subdomain part, not the full domain
            setData('domain', suggestedSubdomain);
        }
    }, [data.company_name, isDomainFieldEnabled, isDomainManuallyEdited]);

    // Show error page if invalid plan is provided
    if (invalidPlan) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-50">
                {/* Header with Logo */}
                <div className="flex-shrink-0 flex items-center justify-center p-3 sm:p-6">
                    <img
                        src={`${imageAsset('/brand/images/mainLogo.png')}`}
                        alt="Logo"
                        className="h-7 w-auto"
                    />
                </div>

                {/* Error Content */}
                <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
                    <div className="max-w-md w-full">
                        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                Invalid Plan Selected
                            </h2>
                            <p className="text-gray-600 mb-6">
                                The subscription plan you're trying to access doesn't exist or is no longer available. Please select a valid plan to continue with registration.
                            </p>
                            <a
                                href={route('register')}
                                className="inline-flex items-center justify-center w-full h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-medium shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200"
                            >
                                View Available Plans
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head title={getPageTitle()} />
            <OnboardingLayout title={getPageTitle()} contentClassName="flex items-center justify-center">
                {/* Main Content Container */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: direction === 'forward' ? 30 : -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction === 'forward' ? -30 : 30 }}
                        transition={{ 
                            duration: 0.35,
                            ease: [0.25, 0.1, 0.25, 1]
                        }}
                        className={`w-full ${currentStep === 3 ? 'max-w-6xl' : currentStep === 1 ? 'max-w-lg' : currentStep === 2 || currentStep === 4 ? 'max-w-md' : 'max-w-2xl'}`}
                    >
                        {/* Welcome Section - Outside Card */}
                        <div className="mb-6 text-center">
                            <div className="flex items-center justify-center gap-3 mb-1.5">
                                {currentStep === 1 && <Sparkles className="h-7 w-7 text-primary" />}
                                {currentStep === 2 && <Mail className="h-7 w-7 text-primary" />}
                                {currentStep === 4 && <Lock className="h-7 w-7 text-primary" />}
                                <h1 className="text-3xl font-bold text-gray-900">
                                    {currentStep === 1 ? 'Welcome To Wellovis' :
                                        currentStep === 2 ? 'Verify Your Email' :
                                            currentStep === 3 ? (preSelectedPlan ? 'Create Password' : 'Choose Your Plan') :
                                                'Create Password'}
                                </h1>
                            </div>
                            <p className="text-lg text-gray-600">
                                {currentStep === 1 ? 'Start your journey with an AI-powered EMR.' :
                                    currentStep === 2 ? 'Enter the verification code sent to your email' :
                                        currentStep === 3 ? (preSelectedPlan ? `You've selected the ${preSelectedPlan.name}. Set up your password to continue.` : 'Select a subscription plan that fits your practice') :
                                            'Set Up Your Password for Secure Access'}
                            </p>
                        </div>

                        {/* Form Container */}
                        <Card className="border-2 shadow-2xl bg-white">
                            <CardContent className={`${currentStep !== 1 ? 'p-5 sm:p-6' : 'px-5 sm:px-6 xl:px-8 pt-5 sm:pt-6 pb-4'}`}>
                                    <form onSubmit={submit} className="space-y-4 sm:space-y-5">
                                        {/* Step 1 - Practice Information */}
                                        {currentStep === 1 && (
                                            <div className="space-y-4 sm:space-y-5">

                                                    {/* Name Fields - Responsive Grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                                                                First Name <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                id="first_name"
                                                                autoFocus
                                                                value={data.admin_name.split(' ')[0] || ''}
                                                                onChange={(e) => {
                                                                    const lastName = data.admin_name.split(' ').slice(1).join(' ');
                                                                    setData('admin_name', `${e.target.value} ${lastName}`.trim());
                                                                    // Clear validation error when user types
                                                                    if (validationErrors.admin_name) {
                                                                        setValidationErrors(prev => {
                                                                            const newErrors = { ...prev };
                                                                            delete newErrors.admin_name;
                                                                            return newErrors;
                                                                        });
                                                                    }
                                                                }}
                                                                placeholder="Enter First Name"
                                                                className={`h-11 sm:h-12 rounded-lg ${(errors.admin_name || validationErrors.admin_name) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'} bg-white text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2`}
                                                            />
                                                            {(errors.admin_name || validationErrors.admin_name) && <p className="text-sm text-red-500">{errors.admin_name || validationErrors.admin_name}</p>}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                                                                Last Name <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                id="last_name"
                                                                value={data.admin_name.split(' ').slice(1).join(' ') || ''}
                                                                onChange={(e) => {
                                                                    const firstName = data.admin_name.split(' ')[0] || '';
                                                                    setData('admin_name', `${firstName} ${e.target.value}`.trim());
                                                                    // Clear validation error when user types
                                                                    if (validationErrors.admin_name) {
                                                                        setValidationErrors(prev => {
                                                                            const newErrors = { ...prev };
                                                                            delete newErrors.admin_name;
                                                                            return newErrors;
                                                                        });
                                                                    }
                                                                }}
                                                                placeholder="Enter Last Name"
                                                                className={`h-11 sm:h-12 rounded-lg ${(errors.admin_name || validationErrors.admin_name) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'} bg-white text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2`}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Email Field */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="admin_email" className="text-sm font-medium text-gray-700">
                                                            Email <span className="text-red-500">*</span>
                                                        </Label>
                                                        <Input
                                                            id="admin_email"
                                                            type="email"
                                                            value={data.admin_email}
                                                            onChange={(e) => {
                                                                setData('admin_email', e.target.value);
                                                                // Clear validation error when user types
                                                                if (validationErrors.admin_email) {
                                                                    setValidationErrors(prev => {
                                                                        const newErrors = { ...prev };
                                                                        delete newErrors.admin_email;
                                                                        return newErrors;
                                                                    });
                                                                }
                                                            }}
                                                            placeholder="Enter Email Address"
                                                            className={`h-11 sm:h-12 rounded-lg ${(errors.admin_email || validationErrors.admin_email) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'} bg-white text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2`}
                                                        />
                                                        {(errors.admin_email || validationErrors.admin_email) && <p className="text-sm text-red-500">{errors.admin_email || validationErrors.admin_email}</p>}
                                                    </div>

                                                    {/* Practice Name Field */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="company_name" className="text-sm font-medium text-gray-700">
                                                            Practice Name <span className="text-red-500">*</span>
                                                        </Label>
                                                        <Input
                                                            id="company_name"
                                                            value={data.company_name}
                                                            onChange={(e) => {
                                                                setData('company_name', e.target.value);
                                                                // Clear validation error when user types
                                                                if (validationErrors.company_name) {
                                                                    setValidationErrors(prev => {
                                                                        const newErrors = { ...prev };
                                                                        delete newErrors.company_name;
                                                                        return newErrors;
                                                                    });
                                                                }
                                                            }}
                                                            placeholder="Enter Practice Name"
                                                            className={`h-11 sm:h-12 rounded-lg ${(errors.company_name || validationErrors.company_name) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'} bg-white text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2`}
                                                        />
                                                        {(errors.company_name || validationErrors.company_name) && <p className="text-sm text-red-500">{errors.company_name || validationErrors.company_name}</p>}
                                                    </div>

                                                    {/* Domain Field */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="domain" className="text-sm font-medium text-gray-700">
                                                            Workspace URL <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Input
                                                                id="domain"
                                                                value={data.domain}
                                                                onChange={(e) => {
                                                                    const cleanedValue = e.target.value
                                                                        .replace(/\s+/g, '')
                                                                        .replace(/[^a-zA-Z0-9-]/g, '')
                                                                        .toLowerCase();
                                                                    setData('domain', cleanedValue);
                                                                    // Mark domain as manually edited when user types
                                                                    setIsDomainManuallyEdited(true);
                                                                    // Clear validation error when user types
                                                                    if (validationErrors.domain) {
                                                                        setValidationErrors(prev => {
                                                                            const newErrors = { ...prev };
                                                                            delete newErrors.domain;
                                                                            return newErrors;
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={!isDomainFieldEnabled}
                                                                placeholder={isDomainFieldEnabled ? "Enter workspace URL" : "Auto-generated from practice name"}
                                                                className={`h-11 sm:h-12 rounded-lg pr-10 ${(errors.domain || validationErrors.domain) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'} bg-white text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2 disabled:bg-gray-50 disabled:cursor-not-allowed`}
                                                            />
                                                            {!isDomainFieldEnabled && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setIsDomainFieldEnabled(true);
                                                                        setIsDomainManuallyEdited(true);
                                                                    }}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                                                                    title="Click here to edit the practice workspace URL"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-600">
                                                            {isDomainFieldEnabled ? (
                                                                <>
                                                                    Your workspace:{' '}
                                                                    <span className="font-medium">
                                                                        {data.domain || 'subdomain'}.{baseDomain}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Auto-generated. Click the{' '}
                                                                    <span className="inline-flex items-center gap-1 text-purple-600">
                                                                        <Pencil className="w-3 h-3" />
                                                                    </span>
                                                                    {' '}icon to customize
                                                                </>
                                                            )}
                                                        </p>
                                                        {(errors.domain || validationErrors.domain) && <p className="text-sm text-red-500">{errors.domain || validationErrors.domain}</p>}
                                                    </div>

                                                    {/* Pre-selected Plan Indicator */}
                                                    {preSelectedPlan && (
                                                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-200">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-gray-900">
                                                                            {preSelectedPlan.name} 
                                                                        </p>
                                                                        <p className="text-xs text-gray-600">
                                                                            {preSelectedPlan.formatted_price}/{preSelectedPlan.billing_interval}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        // Build query params with preserved form data
                                                                        const queryParams: Record<string, string> = {
                                                                            from: 'register',
                                                                            plan: preSelectedPlan.slug,
                                                                            preserve_data: 'true',
                                                                        };

                                                                        // Preserve form data
                                                                        if (data.domain) queryParams.domain = data.domain;
                                                                        if (data.company_name) queryParams.company_name = data.company_name;
                                                                        if (data.admin_name) queryParams.admin_name = data.admin_name;
                                                                        if (data.admin_email) queryParams.admin_email = data.admin_email;

                                                                        const queryString = new URLSearchParams(queryParams).toString();
                                                                        const url = `/change-plan?${queryString}`;
                                                                        console.log('[DEBUG] RegisterPublic: Navigating to change-plan:', url);
                                                                        router.visit(url);
                                                                    }}
                                                                    className="text-xs"
                                                                >
                                                                    Change Plan
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Continue Button */}
                                                    <div className="pt-2 sm:pt-3">
                                                        <Button
                                                            type="button"
                                                            onClick={nextStep}
                                                            className="w-full h-11 sm:h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-medium shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200 text-base"
                                                            disabled={!data.admin_name || !data.company_name || !data.admin_email || !data.domain || sendingOtp || checkingEmail}
                                                        >
                                                            {(sendingOtp || checkingEmail) && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                                            {checkingEmail ? 'Checking email...' : 'Continue'}
                                                        </Button>
                                                    </div>

                                                    {otpError && (
                                                        <div className="text-sm text-red-500 text-center">{otpError}</div>
                                                    )}

                                                    {/* Footer Link */}
                                                    <div className="text-center mt-2">
                                                        <p className="text-sm text-gray-600">
                                                            Already have an account?{' '}
                                                            <a 
                                                                href={route('login')} 
                                                                className="font-medium text-purple-600 hover:text-purple-700 no-underline"
                                                            >
                                                                Login
                                                            </a>
                                                        </p>
                                                    </div>
                                            </div>
                                        )}

                                        {/* Step 2 - OTP Verification */}
                                        {currentStep === 2 && (
                                            <div className="space-y-4 sm:space-y-5">
                                                    {/* Email Display */}
                                                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                                                        <p className="text-sm text-gray-600">
                                                            Verification code has been sent to the following email address
                                                        </p>
                                                        <p className="text-base font-semibold text-gray-900 mt-1">
                                                            {data.admin_email}
                                                        </p>
                                                    </div>

                                                    {/* OTP Input - 6 Separate Boxes */}
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium text-gray-700 text-center block">
                                                            Verification Code <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="flex gap-2 sm:gap-3 justify-center" onPaste={handleOtpPaste}>
                                                            {otp.map((digit, index) => (
                                                                <Input
                                                                    key={index}
                                                                    id={`otp-${index}`}
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    maxLength={1}
                                                                    value={digit}
                                                                    autoFocus={index === 0}
                                                                    onChange={(e) => handleOtpChange(index, e.target.value)}
                                                                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                                    className={`w-11 h-11 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-lg border-2 ${otpError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-purple-500 focus:ring-purple-500'} bg-white focus:ring-2`}
                                                                />
                                                            ))}
                                                        </div>
                                                        {otpError && <p className="text-sm text-red-500 text-center">{otpError}</p>}
                                                        <p className="text-xs text-gray-600 text-center">
                                                            Code expires in 10 minutes
                                                        </p>
                                                    </div>

                                                    {/* Verify Button and Back Button */}
                                                    <div className="flex items-center gap-3 pt-2 sm:pt-3">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={previousStep}
                                                            className="text-purple-600 border-purple-200 h-11 sm:h-12 px-4 flex-shrink-0"
                                                        >
                                                            ← Back
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            onClick={verifyOTP}
                                                            className="flex-1 h-11 sm:h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-medium shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200 text-base"
                                                            disabled={verifyingOtp || otp.some(digit => !digit)}
                                                        >
                                                            {verifyingOtp && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                                            Verify Code
                                                        </Button>
                                                    </div>

                                                    {/* Resend Link */}
                                                    <div className="text-center pt-2">
                                                        {resendTimer > 0 ? (
                                                            <p className="text-sm text-gray-600">
                                                                Resend code in <span className="font-semibold">{resendTimer}s</span>
                                                            </p>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={resendOTP}
                                                                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                                                                disabled={sendingOtp}
                                                            >
                                                                {sendingOtp ? 'Sending...' : 'Resend verification code'}
                                                            </button>
                                                        )}
                                                    </div>
                                            </div>
                                        )}

                                        {/* Step 3 - Plan Selection */}
                                        {currentStep === 3 && (
                                            <div className="space-y-6">
                                                    {/* Back Button */}
                                                    <div className="flex justify-start">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={previousStep}
                                                            className="text-purple-600"
                                                        >
                                                            ← Back
                                                        </Button>
                                                    </div>

                                                    {/* Heading */}
                                                    <div className="text-center space-y-2">
                                                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                                                            Simple, Transparent Pricing
                                                        </h2>
                                                        <p className="text-sm text-gray-600">
                                                            Let's make sure Wellovis is the right fit for your team.
                                                        </p>
                                                    </div>

                                                    {/* Billing Toggle */}
                                                    <div className="flex justify-center">
                                                        <div className="inline-flex items-center gap-3 bg-gray-100 p-1 rounded-full">
                                                            <button
                                                                type="button"
                                                                onClick={() => setBillingCycle('monthly')}
                                                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'monthly'
                                                                    ? 'bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white shadow-md'
                                                                    : 'text-gray-700 hover:text-gray-900'
                                                                    }`}
                                                            >
                                                                Billed Monthly
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBillingCycle('annually')}
                                                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'annually'
                                                                    ? 'bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white shadow-md'
                                                                    : 'text-gray-700 hover:text-gray-900'
                                                                    }`}
                                                            >
                                                                Billed Annually
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Plans Grid */}
                                                    <motion.div
                                                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ duration: 0.5 }}
                                                    >
                                                        {plans
                                                            .filter(plan =>
                                                                billingCycle === 'monthly'
                                                                    ? plan.billing_interval === 'month' && plan.billing_interval_count === 1
                                                                    : plan.billing_interval === 'year' && plan.billing_interval_count === 1
                                                            )
                                                            .map((plan, index) => {
                                                                const isFeatured = plan.slug.includes('clinic') || plan.slug.includes('pro');
                                                                const isSelected = selectedPlan === plan.id;

                                                                return (
                                                                    <motion.div
                                                                        key={plan.id}
                                                                        initial={{ opacity: 0, y: 20 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ duration: 0.4, delay: index * 0.1 }}
                                                                        whileHover={{ scale: 1.05 }}
                                                                        whileTap={{ scale: 0.98 }}
                                                                        onClick={() => {
                                                                            setSelectedPlan(plan.id);
                                                                            setData('plan_id', plan.id);
                                                                        }}
                                                                        className={`relative p-6 rounded-2xl cursor-pointer transition-all ${isFeatured
                                                                            ? 'bg-gradient-to-b from-[#A100FF] to-[#0500C9] text-white shadow-2xl'
                                                                            : isSelected
                                                                                ? 'bg-purple-50 border-2 border-purple-600'
                                                                                : 'bg-white border-2 border-gray-200 hover:border-purple-300'
                                                                            }`}
                                                                    >
                                                                        {/* Plan Icon/Name */}
                                                                        <div className="flex items-center gap-2 mb-4">
                                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isFeatured ? 'bg-white/20' : 'bg-purple-100'
                                                                                }`}>
                                                                                <svg className={`w-6 h-6 ${isFeatured ? 'text-white' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                                                </svg>
                                                                            </div>
                                                                            <h3 className={`text-lg font-bold ${isFeatured ? 'text-white' : 'text-gray-900'}`}>
                                                                                {plan.name}
                                                                            </h3>
                                                                        </div>

                                                                        {/* Price */}
                                                                        <div className="mb-6">
                                                                            <div className="flex items-baseline gap-1">
                                                                                <span className={`text-4xl font-bold ${isFeatured ? 'text-white' : 'text-gray-900'}`}>
                                                                                    ${Math.floor(plan.price)}
                                                                                </span>
                                                                                <span className={`text-lg ${isFeatured ? 'text-white/80' : 'text-gray-600'}`}>
                                                                                    /month
                                                                                </span>
                                                                            </div>
                                                                            <p className={`text-sm mt-1 ${isFeatured ? 'text-white/70' : 'text-gray-500'}`}>
                                                                                {plan.description}
                                                                            </p>
                                                                        </div>

                                                                        {/* Features */}
                                                                        <ul className="space-y-3 mb-6">
                                                                            {plan.features.map((feature, index) => (
                                                                                <li key={index} className="flex items-start gap-3">
                                                                                    <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isFeatured ? 'text-white' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                    <span className={`text-sm ${isFeatured ? 'text-white' : 'text-gray-700'}`}>
                                                                                        {feature}
                                                                                    </span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>

                                                                        {/* Get Started Button */}
                                                                        <Button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedPlan(plan.id);
                                                                                setData('plan_id', plan.id);
                                                                            }}
                                                                            className={`w-full ${isFeatured
                                                                                ? 'bg-white text-purple-600 hover:bg-gray-100'
                                                                                : isSelected
                                                                                    ? 'bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white'
                                                                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                                                                }`}
                                                                        >
                                                                            {isSelected ? 'Selected ✓' : 'Get Started'}
                                                                        </Button>

                                                                        {/* Selected Indicator */}
                                                                        {isSelected && !isFeatured && (
                                                                            <div className="absolute top-4 right-4">
                                                                                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                                                                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </motion.div>
                                                                );
                                                            })}
                                                    </motion.div>

                                                    {/* Continue Button */}
                                                    <div className="pt-4">
                                                        <Button
                                                            type="button"
                                                            onClick={() => {
                                                                setDirection('forward');
                                                                setCurrentStep(4);
                                                            }}
                                                            className="w-full h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-medium shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200"
                                                            disabled={!selectedPlan}
                                                        >
                                                            Continue to Password
                                                        </Button>
                                                    </div>
                                            </div>
                                        )}

                                        {/* Step 4 - Password Setup */}
                                        {currentStep === 4 && (
                                            <div className="space-y-4 sm:space-y-5">
                                                    {/* Pre-selected Plan Display */}
                                                    {/* {preSelectedPlan && (
                                                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 sm:p-5 border-2 border-purple-200">
                                                            <div className="flex items-start gap-4">
                                                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#A100FF] to-[#0500C9] flex items-center justify-center flex-shrink-0">
                                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                                                                        {preSelectedPlan.name}
                                                                    </h3>
                                                                    <p className="text-sm text-gray-600 mb-2">
                                                                        {preSelectedPlan.description}
                                                                    </p>
                                                                    <div className="flex items-baseline gap-1 mb-3">
                                                                        <span className="text-2xl font-bold text-gray-900">
                                                                            ${Math.floor(preSelectedPlan.price)}
                                                                        </span>
                                                                        <span className="text-sm text-gray-600">
                                                                            /{preSelectedPlan.billing_interval}
                                                                        </span>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        {preSelectedPlan.features.slice(0, 3).map((feature, index) => (
                                                                            <div key={index} className="flex items-start gap-2">
                                                                                <svg className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                                <span className="text-xs text-gray-700">{feature}</span>
                                                                            </div>
                                                                        ))}
                                                                        {preSelectedPlan.features.length > 3 && (
                                                                            <p className="text-xs text-gray-500 italic pl-6">
                                                                                + {preSelectedPlan.features.length - 3} more features
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )} */}

                                                    {/* Password Field */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="admin_password" className="text-sm font-medium text-gray-700">
                                                            Password <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Input
                                                                id="admin_password"
                                                                type={showPassword ? "text" : "password"}
                                                                autoFocus
                                                                value={data.admin_password}
                                                                onChange={(e) => setData('admin_password', e.target.value)}
                                                                placeholder="Enter your password"
                                                                className="h-11 sm:h-12 rounded-lg border-gray-300 bg-white pr-12 text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                            >
                                                                {showPassword ? (
                                                                    <EyeOff className="h-5 w-5" />
                                                                ) : (
                                                                    <Eye className="h-5 w-5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                        {errors.admin_password && <p className="text-sm text-red-500">{errors.admin_password}</p>}
                                                    </div>

                                                    {/* Confirm Password Field */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="admin_password_confirmation" className="text-sm font-medium text-gray-700">
                                                            Confirm Password <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Input
                                                                id="admin_password_confirmation"
                                                                type={showConfirmPassword ? "text" : "password"}
                                                                value={data.admin_password_confirmation}
                                                                onChange={(e) => setData('admin_password_confirmation', e.target.value)}
                                                                placeholder="Enter your confirm password"
                                                                className="h-11 sm:h-12 rounded-lg border-gray-300 bg-white pr-12 text-base placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                            >
                                                                {showConfirmPassword ? (
                                                                    <EyeOff className="h-5 w-5" />
                                                                ) : (
                                                                    <Eye className="h-5 w-5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                        {errors.admin_password_confirmation && <p className="text-sm text-red-500">{errors.admin_password_confirmation}</p>}
                                                        
                                                        {/* Passwords Match Indicator */}
                                                        {data.admin_password_confirmation && (
                                                            <div className="mt-2 flex items-center gap-2 text-xs">
                                                                {passwordsMatch() ? (
                                                                    <>
                                                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                                                        <span className="text-green-700">Passwords match</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                                                        <span className="text-red-600">Passwords do not match</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Password Requirements Checklist - Always Visible */}
                                                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                                                        <p className="text-sm font-medium text-gray-700">Password Requirements:</p>
                                                        <ul className="space-y-2">
                                                            {getPasswordRequirements().map((requirement, index) => (
                                                                <li key={index} className="flex items-center gap-2 text-sm">
                                                                    {requirement.met ? (
                                                                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                                                    ) : (
                                                                        <div className="h-4 w-4 flex-shrink-0" />
                                                                    )}
                                                                    <span className={requirement.met ? 'text-green-600' : 'text-gray-500'}>
                                                                        {requirement.label}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {/* Submit Button and Back Button */}
                                                    <div className="pt-2 sm:pt-3">
                                                        {validationErrors.submit && (
                                                            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                                <p className="text-sm text-red-600">{validationErrors.submit}</p>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-3">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={previousStep}
                                                                className="text-purple-600 border-purple-200 h-11 sm:h-12 px-4 flex-shrink-0"
                                                            >
                                                                ← Back
                                                            </Button>
                                                            <Button
                                                                type="submit"
                                                                disabled={isSubmitting || !data.admin_password || !data.admin_password_confirmation}
                                                                className="flex-1 h-11 sm:h-12 bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white rounded-lg font-medium shadow-lg hover:from-[#8A00E0] hover:to-[#3A00B8] transition-all duration-200 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                                                {isSubmitting ? 'Processing...' : (preSelectedPlan ? 'Confirm Password' : 'Continue')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                            </div>
                                        )}
                                    </form>
                                </CardContent>
                            </Card>
                    </motion.div>
                </AnimatePresence>
            </OnboardingLayout>
            {/* Interactive Setup Loader Overlay */}
            <AnimatePresence>
                {showSetupLoader && (
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
                                            <Loader2 className="w-10 h-10 text-purple-600" />
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
                                    {currentSetupStep < SETUP_STEPS.length ? (
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
                )}
            </AnimatePresence>
        </>
    );
}
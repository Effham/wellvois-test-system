import React, { useEffect, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { useAppearance } from '@/hooks/use-appearance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { LogIn, Eye, EyeOff } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    title?: string;
    tenant: {
        id: string;
        company_name: string;
    };
    appearanceSettings?: {
        appearance_theme_color?: string;
        appearance_logo_path?: string;
        appearance_font_family?: string;
    };
    websiteSettings?: {
        navigation?: {
            items?: Array<{
                id: string;
                label: string;
                enabled: boolean;
                customLabel?: string;
                order: number;
            }>;
        };
        appearance?: {
            colors?: {
                use_custom: boolean;
                primary: string;
                accent: string;
            };
            typography?: {
                use_custom: boolean;
                heading_font: string;
                body_font: string;
            };
            footer?: {
                enabled: boolean;
                copyright: string;
                links: Array<{ label: string; url: string }>;
            };
        };
    };
    requireLogout?: boolean;
    redirectAfterLogout?: string;
}

export default function PublicPortalLayout({ children, title, tenant, appearanceSettings, websiteSettings, requireLogout = false, redirectAfterLogout }: Props) {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showLogoutRequiredModal, setShowLogoutRequiredModal] = useState(false);
    const [logoutMessage, setLogoutMessage] = useState('');
    const [email, setEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCrossTenantModal, setShowCrossTenantModal] = useState(false);
    
    // Additional state variables for two-step login
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [loginProcessing, setLoginProcessing] = useState(false);
    
    const [crossTenantData, setCrossTenantData] = useState<{
        type: string;
        message: string;
        details?: string;
    } | null>(null);
    const [showJoinTenantModal, setShowJoinTenantModal] = useState(false);
    const [joinTenantData, setJoinTenantData] = useState<{
        currentTenantName: string;
        linkedTenantNames: string[];
        patientId: number;
        userId: number;
        email: string;
    } | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [showUserChoiceModal, setShowUserChoiceModal] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<{
        isLoggedIn: boolean;
        userType: 'admin' | 'practitioner' | 'patient' | null;
        message: string | null;
        patientInfo?: {
            name: string;
            initials: string;
            email?: string;
            phone?: string;
            id?: number;
        };
    }>({
        isLoggedIn: false,
        userType: null,
        message: null
    });

    const [showCentralLogoutModal, setShowCentralLogoutModal] = useState(false);

    // Function to check current session status
    const checkSessionStatus = async () => {
        try {
            console.log('🔍 Starting session check...');
            const response = await fetch(route('session-check'), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            if (response.ok) {
                const sessionInfo = await response.json();
                console.log('📋 Session check response:', sessionInfo);

                if (sessionInfo.auth_check && sessionInfo.auth_user) {
                    console.log('✅ User is authenticated:', sessionInfo.auth_user);
                    const userType = sessionInfo.user_type || 'admin';

                    // For v2: Show central logout modal for admin/practitioner sessions ONLY on booking pages
                    if (userType === 'admin' || userType === 'practitioner') {
                        setSessionStatus({
                            isLoggedIn: true,
                            userType: userType as 'admin' | 'practitioner' | 'patient',
                            message: 'Already logged in on platform. Please logout to continue.'
                        });
                        // Only show the modal if this page requires logout
                        if (requireLogout) {
                            setShowCentralLogoutModal(true);
                        }
                    } else if (userType === 'patient') {
                        // For patient sessions, extract patient info for profile display
                        const patientName = sessionInfo.auth_user?.name || 'Patient';
                        const patientEmail = sessionInfo.auth_user?.email || '';
                        const patientPhone = sessionInfo.auth_user?.phone_number || sessionInfo.auth_user?.phone || '';
                        const patientId = sessionInfo.auth_user?.id || null;
                        const initials = patientName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                        setSessionStatus({
                            isLoggedIn: true,
                            userType: 'patient',
                            message: null,
                            patientInfo: {
                                name: patientName,
                                initials: initials,
                                email: patientEmail,
                                phone: patientPhone,
                                id: patientId
                            }
                        });
                    }
                    console.log('🚨 Setting user state:', { userType });
                } else {
                    console.log('❌ No authenticated user found');
                    setSessionStatus({
                        isLoggedIn: false,
                        userType: null,
                        message: null
                    });
                }
            } else {
                console.log('❌ Session check request failed:', response.status);
            }
        } catch (error) {
            console.log('❌ Session check failed:', error);
            setSessionStatus({
                isLoggedIn: false,
                userType: null,
                message: null
            });
        }
    };

    // Helper function to check for cross-tenant visits
    const checkCrossTenantVisits = () => {
        try {
            const currentDomain = window.location.host;
            const timestamp = Date.now();
            const allKeys = Object.keys(localStorage);
            const wellovicVisitKeys = allKeys.filter(key => key.startsWith('wellovis_visit_'));
            
            const otherTenantVisits = wellovicVisitKeys.filter(key => {
                try {
                    const storedData = localStorage.getItem(key);
                    if (!storedData) return false;
                    
                    const data = JSON.parse(storedData);
                    const isOtherTenant = data.domain !== currentDomain;
                    const isRecent = data.timestamp && (timestamp - data.timestamp) < (2 * 60 * 60 * 1000); // 2 hours
                    
                    return isOtherTenant && isRecent;
                } catch (e) {
                    return false;
                }
            });
            
            if (otherTenantVisits.length > 0) {
                const otherDomains = otherTenantVisits.map(key => {
                    const data = JSON.parse(localStorage.getItem(key) || '{}');
                    return data.domain;
                }).join(', ');
                
                return {
                    exists: true,
                    type: 'cross_tenant_visit',
                    message: 'Cross-Tenant Access Detected',
                    details: `You recently visited: ${otherDomains}. Please ensure you're logged out from other clinics before proceeding.`
                };
            }
            
            return { exists: false };
        } catch (error) {
            console.error('Cross-tenant check failed:', error);
            return { exists: false };
        }
    };
    
    const handleLoginClick = async () => {
        // For v2: If any session exists, show central logout modal
        if (sessionStatus.isLoggedIn) {
            setShowCentralLogoutModal(true);
            return;
        }

        // No active session detected, show login modal
        setShowLoginModal(true);
    };

    // Check session status on component mount and when requireLogout changes
    useEffect(() => {
        checkSessionStatus();
    }, [requireLogout]);

    // Expose global helpers so page components can open modals
    useEffect(() => {
        (window as any).openPublicPortalLogin = handleLoginClick;
        (window as any).openUserChoiceModal = () => setShowUserChoiceModal(true);
        (window as any).sessionStatus = sessionStatus; // Expose session status globally
        console.log('🌐 Updated global session status:', sessionStatus);
        return () => {
            try {
                delete (window as any).openPublicPortalLogin;
                delete (window as any).openUserChoiceModal;
                delete (window as any).sessionStatus;
            } catch {}
        };
    }, [sessionStatus]);

    // Email submission handler (Step 1)
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Please enter your email address.');
            return;
        }
        if (!email.includes('@')) {
            toast.error('Please enter a valid email address.');
            return;
        }

        setIsProcessing(true);

        try {
            const response = await fetch(route('public-portal.check-patient-exists'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ email: email.trim(), tenant_id: tenant.id }),
                credentials: 'include',
            });

            const data = await response.json();
            
            if (response.ok && data.exists) {
                // Patient exists and is linked to this tenant.
                // Store the email and show the password input.
                setLoginEmail(email.trim());
                setShowPasswordInput(true);
                toast.success("Account found. Please enter your password.");
            } else if (response.ok && !data.exists && data.patient_id) {
                // Patient exists in central DB but not for this tenant.
                // We now have the `patient_id` and can prompt the user to join.
                setJoinTenantData({
                    currentTenantName: tenant.company_name,
                    linkedTenantNames: [], // This could be fetched from another endpoint if needed
                    patientId: data.patient_id,
                    userId: data.user_id, // Ensure your `checkPatientExists` returns this
                    email: email.trim(),
                });
                setShowLoginModal(false);
                setShowJoinTenantModal(true);
            } else {
                // No patient found at all, or a generic error occurred.
                toast.error(data.message || 'No account found with this email address for this healthcare provider.');
            }

        } catch (error) {
            console.error('Error validating email:', error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Password submission handler (Step 2)
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!loginPassword.trim()) {
            toast.error('Please enter your password.');
            return;
        }

        setLoginProcessing(true);

        try {
            // Get appointment data from localStorage if it exists
            const appointmentData = localStorage.getItem('appointment_booking_data');
            const parsedAppointmentData = appointmentData ? JSON.parse(appointmentData) : {};

            const response = await fetch(route('public-portal.login-and-book'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: loginEmail,
                    password: loginPassword,
                    tenant_id: tenant.id,
                    ...parsedAppointmentData, // Include appointment data if available
                }),
                credentials: 'include',
            });

            const responseData = await response.json();

            if (response.ok && responseData.success) {
                toast.success(responseData.message || 'Login successful! Redirecting...');
                
                // Clear states and redirect
                clearLoginStates();
                localStorage.removeItem('appointment_booking_data');
                
                setTimeout(() => {
                    const redirectUrl = responseData.redirect_url || '/central/patient-dashboard';
                    window.location.href = redirectUrl;
                }, 2000);
            } else {
                // Check for specific error messages returned from the back-end
                if (responseData.message === 'Patient not registered in this clinic.') {
                    // Patient exists but not linked to this tenant
                    setShowLoginModal(false);
                    clearLoginStates();
                    toast.error('Your account exists but is not linked to this clinic. Please contact the clinic to register.');
                } else if (responseData.action === 'role_conflict') {
                    setLogoutMessage(responseData.message);
                    setShowLoginModal(false);
                    clearLoginStates();
                    setShowLogoutRequiredModal(true);
                } else {
                    toast.error(responseData.message || 'Login failed. Please check your credentials.');
                }
            }
        } catch (error) {
            console.error('Error during login:', error);
            toast.error('Login failed due to a network error. Please try again.');
        } finally {
            setLoginProcessing(false);
        }
    };

    // Helper function to clear all login-related states
    const clearLoginStates = () => {
        setShowLoginModal(false);
        setShowPasswordInput(false);
        setEmail('');
        setLoginEmail('');
        setLoginPassword('');
        setShowLoginPassword(false);
        setIsProcessing(false);
        setLoginProcessing(false);
    };

    // Handle new user registration
    const handleNewUserRegistration = () => {
        setShowUserChoiceModal(false);
        router.visit(route('public-portal.register'));
    };

    // Handle existing user login
    const handleExistingUserLogin = () => {
        setShowUserChoiceModal(false);
        handleLoginClick();
    };

    // Handle join tenant request
    const handleJoinTenant = async () => {
        if (!joinTenantData) return;

        setIsJoining(true);
        
        try {
            const response = await fetch(route('public-portal.request-join-tenant'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    email: joinTenantData.email,
                    patient_id: joinTenantData.patientId,
                    user_id: joinTenantData.userId,
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success(data.message);
                setShowJoinTenantModal(false);
                setJoinTenantData(null);
                
                // Redirect to patient dashboard
                setTimeout(() => {
                    const redirectUrl = data.redirect_url || data.fallback_login_url;
                    window.location.href = redirectUrl;
                }, 2000);
            } else {
                toast.error(data.message || 'Failed to join healthcare provider. Please try again.');
            }
        } catch (error) {
            console.error('Error joining tenant:', error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsJoining(false);
        }
    };

    // Apply tenant-specific appearance settings (independent of user authentication)
    useEffect(() => {
        const root = document.documentElement;
        
        console.log('Public Portal Layout: Applying appearance settings', {
            websiteSettings,
            appearanceSettings
        });
        
        // Priority 1: Website-specific appearance settings
        if (websiteSettings?.appearance?.colors?.use_custom && websiteSettings?.appearance?.colors?.primary) {
            root.style.setProperty('--primary', websiteSettings.appearance.colors.primary);
            root.style.setProperty('--sidebar-accent', websiteSettings.appearance.colors.primary);
            
            // Convert hex to oklch for better CSS compatibility
            const hexToOklch = (hex: string): string => {
                // For now, just use the hex value directly - can be enhanced later
                return hex;
            };
            
            root.style.setProperty('--primary', hexToOklch(websiteSettings.appearance.colors.primary));
            root.style.setProperty('--sidebar-accent', websiteSettings.appearance.colors.primary);
            console.log('✅ Applied website-specific theme:', websiteSettings.appearance.colors.primary);
        }
        // Priority 2: General tenant appearance settings (fallback)
        else if (appearanceSettings?.appearance_theme_color) {
            const themeColor = appearanceSettings.appearance_theme_color;
            
            // Convert hex to oklch for better CSS compatibility
            const hexToOklch = (hex: string): string => {
                // For now, just use the hex value directly - can be enhanced later
                return hex;
            };
            
            root.style.setProperty('--primary', hexToOklch(themeColor));
            root.style.setProperty('--sidebar-accent', themeColor);
            console.log('✅ Applied tenant theme:', themeColor);
        }
        else {
            // Apply default theme if no settings found
            const defaultColor = '#7c3aed';
            root.style.setProperty('--primary', defaultColor);
            root.style.setProperty('--sidebar-accent', defaultColor);
            console.log('✅ Applied default theme (no settings found):', defaultColor);
        }
        
        // Apply custom fonts
        if (websiteSettings?.appearance?.typography?.use_custom) {
            if (websiteSettings.appearance.typography.heading_font) {
                root.style.setProperty('--dynamic-heading-font', websiteSettings.appearance.typography.heading_font);
            }
            if (websiteSettings.appearance.typography.body_font) {
                root.style.setProperty('--dynamic-font-family', websiteSettings.appearance.typography.body_font);
            }
            console.log('✅ Applied website-specific fonts:', websiteSettings.appearance.typography);
        }
        // Fallback to general tenant font settings
        else if (appearanceSettings?.appearance_font_family) {
            root.style.setProperty('--dynamic-font-family', appearanceSettings.appearance_font_family);
            console.log('✅ Applied tenant font:', appearanceSettings.appearance_font_family);
        }
        else {
            // Apply default font
            const defaultFont = 'Axiforma';
            root.style.setProperty('--dynamic-font-family', defaultFont);
            console.log('✅ Applied default font (no settings found):', defaultFont);
        }
        
        // Ensure light theme for public portal
        document.documentElement.classList.remove('dark');
        
        console.log('🎨 Public Portal appearance setup complete');
        
    }, [websiteSettings, appearanceSettings]);

    // DO NOT call useAppearance() - it interferes with tenant-specific settings

    const pageTitle = title ? `${title} - ${tenant.company_name}` : tenant.company_name;
    
    // Build meta description
    const metaDescription = title === 'Welcome' 
        ? `Welcome to ${tenant.company_name} - Your trusted healthcare partner providing comprehensive medical services with a focus on quality care and patient satisfaction.`
        : title === 'Services'
        ? `Explore our comprehensive range of healthcare services at ${tenant.company_name}. Professional medical care designed to meet your health and wellness needs.`
        : title === 'Locations'
        ? `Find ${tenant.company_name} clinic locations, contact information, and operating hours to plan your visit.`
        : title === 'Staff'
        ? `Meet our experienced healthcare professionals at ${tenant.company_name}. Dedicated practitioners committed to your health and wellbeing.`
        : title === 'Book Appointment'
        ? `Schedule your appointment online with ${tenant.company_name}. Easy, convenient booking for professional healthcare services.`
        : `${tenant.company_name} - Professional healthcare services with a focus on quality care and patient satisfaction.`;

    // Use website-specific appearance settings if available, fallback to general appearance settings
    const logoUrl = appearanceSettings?.appearance_logo_path 
        ? `${appearanceSettings.appearance_logo_path}`
        : null;
        
    const faviconUrl = logoUrl || '/favicon.ico';
    const themeColor = websiteSettings?.appearance?.colors?.primary 
        || appearanceSettings?.appearance_theme_color 
        || '#3b82f6';

    return (
        <>
            <Head title={pageTitle}>
                <meta name="description" content={metaDescription} />
                <meta name="keywords" content={`${tenant.company_name}, healthcare, medical services, clinic, appointment booking, health, wellness`} />
                <meta name="author" content={tenant.company_name} />
                
                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={metaDescription} />
                {logoUrl && <meta property="og:image" content={logoUrl} />}
                <meta property="og:site_name" content={tenant.company_name} />
                
                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={pageTitle} />
                <meta name="twitter:description" content={metaDescription} />
                {logoUrl && <meta name="twitter:image" content={logoUrl} />}
                
                {/* Favicon and Theme */}
                <link rel="icon" type="image/x-icon" href={faviconUrl} />
                <link rel="apple-touch-icon" href={logoUrl || '/favicon.ico'} />
                <meta name="theme-color" content={themeColor} />
                <meta name="msapplication-TileColor" content={themeColor} />
                
                {/* Mobile optimization */}
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="format-detection" content="telephone=no" />
            </Head>
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="border-b border-border bg-card">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-6">
                            {/* Logo and Company Name */}
                            <div className="flex items-center">
                                <Link
                                    href={route('public-portal.index')}
                                    className="flex items-center space-x-3"
                                >
                                    {logoUrl ? (
                                        <img
                                            src={logoUrl}
                                            alt={`${tenant.company_name} logo`}
                                            className="h-10 w-auto"
                                        />
                                    ) : (
                                        <>
                                            <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                                                <span className="text-primary-foreground font-bold text-lg">
                                                    {tenant.company_name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="text-xl font-bold text-foreground">
                                                {tenant.company_name}
                                            </span>
                                        </>
                                    )}
                                </Link>
                            </div>

                            {/* Navigation */}
                            <nav className="hidden md:flex items-center space-x-8">
                                {websiteSettings?.navigation?.items
                                    ?.filter(item => item.enabled)
                                    ?.sort((a, b) => a.order - b.order)
                                    ?.map(item => {
                                        const isBookAppointment = item.id === 'book-appointment';
                                        const href = route(`public-portal.${item.id}`);
                                        const label = item.customLabel || item.label;
                                        
                                        return (
                                            <Link
                                                key={item.id}
                                                href={href}
                                                className={isBookAppointment 
                                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium px-4 py-2 rounded-lg"
                                                    : "text-muted-foreground hover:text-primary transition-colors font-medium"
                                                }
                                            >
                                                {label}
                                            </Link>
                                        );
                                    })
                                }
                                {/* Patient Profile or Login/Register Buttons */}
                                {(() => {
                                    console.log('🎯 Navigation render - Session Status:', {
                                        isLoggedIn: sessionStatus.isLoggedIn,
                                        userType: sessionStatus.userType,
                                        patientInfo: sessionStatus.patientInfo
                                    });

                                    // Show patient profile for logged in patients
                                    if (sessionStatus.isLoggedIn && sessionStatus.userType === 'patient' && sessionStatus.patientInfo) {
                                        return (
                                            <div className="flex items-center space-x-3">
                                                <div className="flex items-center space-x-3 bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                                                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center ring-2 ring-primary/20">
                                                        <span className="text-primary-foreground font-bold text-sm">
                                                            {sessionStatus.patientInfo.initials}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-primary">
                                                            {sessionStatus.patientInfo.name}
                                                        </span>
                                                        {sessionStatus.patientInfo.email && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {sessionStatus.patientInfo.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const form = document.createElement('form');
                                                        form.method = 'POST';
                                                        form.action = route('logout');

                                                        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                                                        if (csrfToken) {
                                                            const csrfInput = document.createElement('input');
                                                            csrfInput.type = 'hidden';
                                                            csrfInput.name = '_token';
                                                            csrfInput.value = csrfToken;
                                                            form.appendChild(csrfInput);
                                                        }

                                                        const publicPortalInput = document.createElement('input');
                                                        publicPortalInput.type = 'hidden';
                                                        publicPortalInput.name = 'from_public_portal';
                                                        publicPortalInput.value = 'true';
                                                        form.appendChild(publicPortalInput);

                                                        if (redirectAfterLogout) {
                                                            const redirectInput = document.createElement('input');
                                                            redirectInput.type = 'hidden';
                                                            redirectInput.name = 'redirect_after_logout';
                                                            redirectInput.value = redirectAfterLogout;
                                                            form.appendChild(redirectInput);
                                                        }

                                                        document.body.appendChild(form);
                                                        form.submit();
                                                    }}
                                                    className="text-muted-foreground hover:text-primary flex items-center gap-1"
                                                >
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                    </svg>
                                                    Logout
                                                </Button>
                                            </div>
                                        );
                                    }

                                    // For admin/practitioner or no session, show login/register buttons
                                    // (Central modal will handle admin/practitioner logout)
                                    return (
                                        <div className="flex items-center space-x-3">
                                            <Button
                                                variant="outline"
                                                onClick={handleLoginClick}
                                                className="flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors font-medium"
                                            >
                                                <LogIn className="h-4 w-4" />
                                                <span>Login</span>
                                            </Button>
                                            <Link href={route('public-portal.register')}>
                                                <Button
                                                    variant="default"
                                                    className="flex items-center space-x-2 font-medium"
                                                >
                                                    <span>Register</span>
                                                </Button>
                                            </Link>
                                        </div>
                                    );
                                })()}
                            </nav>

                            {/* Mobile menu button */}
                            <div className="md:hidden">
                                <button className="text-muted-foreground hover:text-primary">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Mobile Navigation */}
                        <div className="md:hidden pb-6">
                            <div className="space-y-2">
                                {websiteSettings?.navigation?.items
                                    ?.filter(item => item.enabled)
                                    ?.sort((a, b) => a.order - b.order)
                                    ?.map(item => {
                                        const isBookAppointment = item.id === 'book-appointment';
                                        const href = route(`public-portal.${item.id}`);
                                        const label = item.customLabel || item.label;
                                        
                                        return (
                                            <Link
                                                key={item.id}
                                                href={href}
                                                className={isBookAppointment 
                                                    ? "block bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium py-2 px-4 rounded-lg mt-4"
                                                    : "block text-muted-foreground hover:text-primary transition-colors font-medium py-2"
                                                }
                                            >
                                                {label}
                                            </Link>
                                        );
                                    })
                                }
                                {/* Mobile Patient Profile or Login/Register Buttons */}
                                {(() => {
                                    // Show patient profile for logged in patients (Mobile)
                                    if (sessionStatus.isLoggedIn && sessionStatus.userType === 'patient' && sessionStatus.patientInfo) {
                                        return (
                                            <div className="space-y-2 mt-4">
                                                <div className="flex items-center space-x-3 bg-primary/10 px-4 py-3 rounded-lg border border-primary/20">
                                                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center ring-2 ring-primary/20">
                                                        <span className="text-primary-foreground font-bold text-sm">
                                                            {sessionStatus.patientInfo.initials}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col flex-1">
                                                        <span className="text-sm font-semibold text-primary">
                                                            {sessionStatus.patientInfo.name}
                                                        </span>
                                                        {sessionStatus.patientInfo.email && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {sessionStatus.patientInfo.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const form = document.createElement('form');
                                                            form.method = 'POST';
                                                            form.action = route('logout');

                                                            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                                                            if (csrfToken) {
                                                                const csrfInput = document.createElement('input');
                                                                csrfInput.type = 'hidden';
                                                                csrfInput.name = '_token';
                                                                csrfInput.value = csrfToken;
                                                                form.appendChild(csrfInput);
                                                            }

                                                            const publicPortalInput = document.createElement('input');
                                                            publicPortalInput.type = 'hidden';
                                                            publicPortalInput.name = 'from_public_portal';
                                                            publicPortalInput.value = 'true';
                                                            form.appendChild(publicPortalInput);

                                                            if (redirectAfterLogout) {
                                                                const redirectInput = document.createElement('input');
                                                                redirectInput.type = 'hidden';
                                                                redirectInput.name = 'redirect_after_logout';
                                                                redirectInput.value = redirectAfterLogout;
                                                                form.appendChild(redirectInput);
                                                            }

                                                            document.body.appendChild(form);
                                                            form.submit();
                                                        }}
                                                        className="text-muted-foreground hover:text-primary flex items-center gap-1"
                                                    >
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                        </svg>
                                                        Logout
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // For admin/practitioner or no session, show login/register buttons
                                    return (
                                        <div className="space-y-2 mt-4">
                                            <Button
                                                variant="outline"
                                                onClick={handleLoginClick}
                                                className="flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors font-medium w-full"
                                            >
                                                <LogIn className="h-4 w-4" />
                                                <span>Login</span>
                                            </Button>
                                            <Link href={route('public-portal.register')} className="block">
                                                <Button
                                                    variant="default"
                                                    className="flex items-center justify-center space-x-2 font-medium w-full"
                                                >
                                                    <span>Register</span>
                                                </Button>
                                            </Link>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main>
                    {children}
                </main>

                {/* Footer */}
                {websiteSettings?.appearance?.footer?.enabled !== false && (
                    <footer className="border-t border-border bg-card relative">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                            <div className="text-center text-muted-foreground">
                                <p>&copy; {new Date().getFullYear()} {tenant.company_name}. {websiteSettings?.appearance?.footer?.copyright || 'All rights reserved.'}</p>
                                {websiteSettings?.appearance?.footer?.links && websiteSettings.appearance.footer.links.length > 0 && (
                                    <div className="mt-4 space-x-4">
                                        {websiteSettings.appearance.footer.links.map((link, index) => (
                                            <a
                                                key={index}
                                                href={link.url}
                                                className="text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                {link.label}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Powered by Wellovis */}
                            <div className="flex justify-center mt-6 pt-6 border-t border-border/50">
                                <div className="flex items-center space-x-2 text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors">
                                    <span className="text-xs">Powered by</span>
                                    <img 
                                        src="/brand/images/mainLogo.png" 
                                        alt="Wellovis" 
                                        className="h-4 w-auto"
                                    />
                                </div>
                            </div>
                        </div>
                    </footer>
                )}


                {/* Two-Step Login Modal */}
                <Dialog open={showLoginModal} onOpenChange={(open) => {
                    if (!open) {
                        clearLoginStates();
                    }
                    setShowLoginModal(open);
                }}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {showPasswordInput ? 'Enter Your Password' : 'Enter Your Email'}
                            </DialogTitle>
                            <DialogDescription>
                                {showPasswordInput 
                                    ? `Welcome back! Please enter your password for ${loginEmail}`
                                    : 'Please enter your email address to continue with the login process.'
                                }
                            </DialogDescription>
                        </DialogHeader>
                        
                        {!showPasswordInput ? (
                            // Step 1: Email input
                            <form onSubmit={handleEmailSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email address"
                                        required
                                        disabled={isProcessing}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => clearLoginStates()}
                                        disabled={isProcessing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isProcessing}>
                                        {isProcessing ? 'Processing...' : 'Continue'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        ) : (
                            // Step 2: Password input
                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="login_password">Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="login_password"
                                            type={showLoginPassword ? "text" : "password"}
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            placeholder="Enter your password"
                                            required
                                            disabled={loginProcessing}
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                                            disabled={loginProcessing}
                                        >
                                            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setShowPasswordInput(false);
                                            setLoginPassword('');
                                            setShowLoginPassword(false);
                                        }}
                                        disabled={loginProcessing}
                                    >
                                        Back
                                    </Button>
                                    <Button type="submit" disabled={loginProcessing}>
                                        {loginProcessing ? 'Logging in...' : 'Login'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>

               {/* Central Logout Modal for Admin/Practitioner - Mandatory Logout */}
<Dialog open={showCentralLogoutModal} onOpenChange={() => {}}>
    <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                Already Logged In
            </DialogTitle>
            <DialogDescription className="space-y-2">
                <p>You are already logged in on the platform as {sessionStatus.userType}.</p>
                <p className="font-medium text-destructive">You must logout to continue accessing the public portal.</p>
            </DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button
                type="button"
                onClick={() => {
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = route('logout');

                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                    if (csrfToken) {
                        const csrfInput = document.createElement('input');
                        csrfInput.type = 'hidden';
                        csrfInput.name = '_token';
                        csrfInput.value = csrfToken;
                        form.appendChild(csrfInput);
                    }

                    const publicPortalInput = document.createElement('input');
                    publicPortalInput.type = 'hidden';
                    publicPortalInput.name = 'from_public_portal';
                    publicPortalInput.value = 'true';
                    form.appendChild(publicPortalInput);

                    if (redirectAfterLogout) {
                        const redirectInput = document.createElement('input');
                        redirectInput.type = 'hidden';
                        redirectInput.name = 'redirect_after_logout';
                        redirectInput.value = redirectAfterLogout;
                        form.appendChild(redirectInput);
                    }

                    document.body.appendChild(form);
                    form.submit();
                }}
                className="w-full bg-destructive hover:bg-destructive/90"
            >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout Now
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
                {/* Cross-Tenant Detection Modal */}
                <Dialog open={showCrossTenantModal} onOpenChange={setShowCrossTenantModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                {crossTenantData?.message || 'Session Conflict Detected'}
                            </DialogTitle>
                            <DialogDescription>
                                {crossTenantData?.details || 'Multiple clinic access detected. Please resolve before continuing.'}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowCrossTenantModal(false);
                                    setCrossTenantData(null);
                                }}
                                className="flex-1"
                            >
                                Continue Anyway
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    // Clear localStorage visit data and close modal
                                    const allKeys = Object.keys(localStorage);
                                    const wellovicVisitKeys = allKeys.filter(key => key.startsWith('wellovis_visit_'));
                                    
                                    wellovicVisitKeys.forEach(key => {
                                        try {
                                            const data = JSON.parse(localStorage.getItem(key) || '{}');
                                            if (data.domain !== window.location.host) {
                                                localStorage.removeItem(key);
                                            }
                                        } catch (e) {
                                            localStorage.removeItem(key);
                                        }
                                    });
                                    
                                    toast.success('Clinic visit history cleared. You can now proceed.');
                                    setShowCrossTenantModal(false);
                                    setCrossTenantData(null);
                                }}
                                className="flex-1"
                            >
                                Clear & Continue
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Join Tenant Modal */}
                <Dialog open={showJoinTenantModal} onOpenChange={setShowJoinTenantModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-2-5.5V9.5m0 0V6a2 2 0 012-2h4a2 2 0 012 2v3.5M7 7h3m0 0h3m-3 0v8m0 0V9.5m0 5.5h3m-6 0h3" />
                                    </svg>
                                </div>
                                Join {joinTenantData?.currentTenantName}
                            </DialogTitle>
                            <DialogDescription>
                                {joinTenantData && (
                                    <div className="space-y-3">
                                        <p>
                                            We found your account in our system! You're currently registered with{' '}
                                            {joinTenantData.linkedTenantNames.length === 1 
                                                ? joinTenantData.linkedTenantNames[0]
                                                : `${joinTenantData.linkedTenantNames.slice(0, -1).join(', ')} and ${joinTenantData.linkedTenantNames[joinTenantData.linkedTenantNames.length - 1]}`
                                            }.
                                        </p>
                                        <p>
                                            Would you like to also register with <strong>{joinTenantData.currentTenantName}</strong>? 
                                            This will allow you to book appointments and access services from both healthcare providers.
                                        </p>
                                    </div>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowJoinTenantModal(false);
                                    setJoinTenantData(null);
                                }}
                                disabled={isJoining}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleJoinTenant}
                                disabled={isJoining}
                                className="flex-1"
                            >
                                {isJoining ? 'Joining...' : `Join ${joinTenantData?.currentTenantName}`}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* User Choice Modal */}
                <Dialog open={showUserChoiceModal} onOpenChange={setShowUserChoiceModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Complete Your Appointment</DialogTitle>
                            <DialogDescription>
                                To book your appointment, you can either create a new account or login with an existing account.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col space-y-4 pt-4">
                            <Button 
                                onClick={handleNewUserRegistration}
                                size="lg" 
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Create New Account
                            </Button>
                            <Button 
                                onClick={handleExistingUserLogin}
                                variant="outline" 
                                size="lg" 
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <LogIn className="h-4 w-4" />
                                Login with Existing Account
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Toaster position="top-right" />
            </div>
        </>
    );
}
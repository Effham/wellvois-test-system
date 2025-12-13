import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, Link, usePage } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Clock,
    MapPin,
    Heart,
    AlertCircle,
    CheckCircle,
    Activity,
    Pill,
    CalendarDays,
    Plus,
    FileText,
    Video,
    MapPinIcon,
    User,
    Building2,
    Filter
} from 'lucide-react';
import { usePatientDashboardConfig, useSectionLayout } from '@/hooks/use-patient-dashboard-config';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { convertToTenantTimezone, formatDate as formatDateUtil, formatTime as formatTimeUtil } from '@/hooks/use-time-locale';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Patient Dashboard',
        href: '/patient-dashboard',
    },
];

interface PendingConsent {
    id: number;
    key: string;
    title: string;
    description: string | null;
    content: string;
    version: number;
}

interface Props {
    isCentral?: boolean;
    fromPublicPortal?: boolean;
    waitingListSuccess?: boolean;
    appointmentSuccess?: boolean;
    availableTenants?: Array<{
        id: string;
        name: string;
        domain: string;
    }>;
    selectedTenant?: string;
    dashboardConfig?: Record<string, any>;
    organizationSettings?: Record<string, any>;
    userPreferences?: Record<string, any>;
    tenantTimezone?: string;
    tenantTimezoneDisplay?: string;
}

export default function PatientDashboard({
    isCentral = false,
    fromPublicPortal = false,
    waitingListSuccess = false,
    appointmentSuccess = false,
    availableTenants = [],
    selectedTenant,
    dashboardConfig = {},
    organizationSettings = {},
    userPreferences = {},
    tenantTimezone = 'UTC',
    tenantTimezoneDisplay = 'UTC'
}: Props) {
    // Get page props and user tenants
    const { props } = usePage<{
        auth: {
            user: {
                tenants?: Array<{
                    id: string;
                    name: string;
                    domain: string;
                }>;
            };
        };
    }>();
    console.log('userTenants', props.auth?.user?.tenants)
    console.log('availableTenants', availableTenants)
    const userTenants = props.auth?.user?.tenants || [];
    
    // Use userTenants if availableTenants is empty
    const tenantsList = availableTenants.length > 0 ? availableTenants : userTenants;
    
    // Check localStorage for public portal registration
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
    const [showWaitingListMessage, setShowWaitingListMessage] = useState(false);
    const [showAppointmentMessage, setShowAppointmentMessage] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    // Memoize the configuration options to prevent infinite re-renders
    const configOptions = useMemo(() => ({
        isCentral,
        organizationSettings,
        userPreferences
    }), [isCentral, organizationSettings, userPreferences]);

    // Dynamic dashboard configuration
    const {
        config,
        isLoading: isConfigLoading,
        enabledSections,
        isSectionEnabled,
        isWidgetEnabled
    } = usePatientDashboardConfig(configOptions);

    // Fetch dashboard data from API
    const {
        data: dashboardData,
        isLoading: isDataLoading,
        error: dataError,
        refreshData
    } = useDashboardData({ isCentral });

    // Update current time every second for live preview
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Helper function to get formatted date/time based on context
    const getFormattedDateTime = () => {
        if (isCentral) {
            // Central: Use browser's local time
            return {
                date: currentDateTime.toLocaleDateString(),
                time: currentDateTime.toLocaleTimeString()
            };
        } else {
            // Tenant: Convert to tenant timezone
            const convertedDate = convertToTenantTimezone(currentDateTime, tenantTimezone);
            return {
                date: formatDateUtil(convertedDate),
                time: formatTimeUtil(convertedDate)
            };
        }
    };

    useEffect(() => {
        // Check for waiting list success message
        if (waitingListSuccess) {
            setShowWaitingListMessage(true);

            // Hide the message after 10 seconds
            setTimeout(() => {
                setShowWaitingListMessage(false);
            }, 10000);
        }
    }, [waitingListSuccess]);

    // Handle API data loading errors with toast
    useEffect(() => {
        if (dataError) {
            toast.error('Error loading dashboard data', {
                description: typeof dataError === 'string' ? dataError : 'Unable to load dashboard information. Please try refreshing the page.',
                action: {
                    label: 'Retry',
                    onClick: () => refreshData()
                }
            });
        }
    }, [dataError, refreshData]);

    useEffect(() => {
        console.log('PatientDashboard props received:', {
            appointmentSuccess,
            waitingListSuccess,
            isCentral,
            fromPublicPortal
        });

        // Check for appointment success message
        if (appointmentSuccess) {
            console.log('Setting appointment success message to true');
            setShowAppointmentMessage(true);

            // Hide the message after 10 seconds
            setTimeout(() => {
                setShowAppointmentMessage(false);
            }, 10000);
        }
    }, [appointmentSuccess]);

    useEffect(() => {
        // Check localStorage for public portal flag
        const isFromPublicPortal = localStorage.getItem('from_public_portal') === 'true';
        const registrationTimestamp = localStorage.getItem('registration_timestamp');

        if (isFromPublicPortal && registrationTimestamp) {
            // Show welcome message if registration was within last 5 minutes
            const registrationTime = new Date(registrationTimestamp);
            const now = new Date();
            const timeDifferenceMinutes = (now.getTime() - registrationTime.getTime()) / (1000 * 60);

            if (timeDifferenceMinutes <= 5) {
                setShowWelcomeMessage(true);

                // Clear the flags after showing the message
                setTimeout(() => {
                    localStorage.removeItem('from_public_portal');
                    localStorage.removeItem('registration_timestamp');
                    setShowWelcomeMessage(false);
                }, 10000); // Hide after 10 seconds
            } else {
                // Clean up old flags
                localStorage.removeItem('from_public_portal');
                localStorage.removeItem('registration_timestamp');
            }
        }
    }, []);

    // Patient info from API data or fallback
    const patientInfo:any = dashboardData?.patientInfo || {
        full_name: 'Loading...',
        preferred_name: 'Loading...',
    };

    // Extract first name for greeting
    const firstName = patientInfo.full_name ? patientInfo.full_name.split(' ')[0] : 'Loading';

    // Mock clinic data
    const clinics = [
        { id: 'all', name: 'All Clinics' },
        { id: 'downtown-medical', name: 'Downtown Medical Center' },
        { id: 'heart-center', name: 'Heart & Wellness Center' },
        { id: 'family-clinic', name: 'Family Health Clinic' },
    ];

    const [selectedClinic, setSelectedClinic] = useState('all');
    const [selectedTenantState, setSelectedTenantState] = useState(selectedTenant || 'all');
    const [isLoadingTenant, setIsLoadingTenant] = useState(false);
    const [showTenantSelectDialog, setShowTenantSelectDialog] = useState(false);
    const [selectedTenantForBooking, setSelectedTenantForBooking] = useState('');

    // Function to handle tenant change with loading animation
    const handleTenantChange = async (tenantId: string) => {
        if (tenantId === selectedTenantState) return;

        setIsLoadingTenant(true);
        setSelectedTenantState(tenantId);

        try {
            // Find the tenant details from tenantsList
            const tenant = tenantsList.find(t => t.id === tenantId);

            if (tenant && tenant.domain) {
                // Switch to the tenant domain
                const newUrl = `${tenant.domain}/patient-dashboard`;
                window.location.href = newUrl;
            } else {
                // Stay in current context but refresh data
                router.get('/patient-dashboard', {}, {
                    preserveState: false,
                    onError: (errors) => {
                        console.error('Error refreshing dashboard:', errors);
                        setIsLoadingTenant(false);
                        setSelectedTenantState(selectedTenant || 'all');
                        toast.error('Unable to refresh dashboard', {
                            description: 'An error occurred while refreshing the dashboard. Please try again.'
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error switching tenant:', error);
            setIsLoadingTenant(false);
            setSelectedTenantState(selectedTenant || 'all');

            // Show graceful error toast
            toast.error('Unable to switch organization', {
                description: 'An error occurred while switching organizations. Please try again.'
            });
        }
    };

    // Function to handle book appointment click
    const handleBookAppointment = () => {
        console.log('isCentral', isCentral);
        console.log('tenantsList', tenantsList);
        if (isCentral && tenantsList.length > 0) {
            // Show tenant selection dialog
            setShowTenantSelectDialog(true);
        } else {
            // Direct navigation if not central
            router.visit('/appointments/patient-book');
        }
    };

    // Function to proceed with booking after tenant selection
    // const proceedToBooking = () => {
    //     if (!selectedTenantForBooking) {
    //         toast.error('Please select a healthcare provider', {
    //             description: 'You must select a healthcare provider to book an appointment.'
    //         });
    //         return;
    //     }
    //      console.log('tenantsList',tenantsList)
    //     console.log('selectedTenantForBooking',selectedTenantForBooking)
    //     const tenant = tenantsList.find(t => t.id === selectedTenantForBooking);
       

    //     console.log('tenant',tenant)
    //     if (tenant && tenant.domain) {
    //         const newUrl = `${tenant.domain}/appointments/patient-book`;
    //         console.log('tenant.domain',tenant.domain)
    //         console.log('newUrl',newUrl)
    //         window.location.href = newUrl;
    //     } else {
    //         toast.error('Invalid healthcare provider', {
    //             description: 'Unable to navigate to the selected provider. Please try again.'
    //         });
    //     }
    // };
    const normalizeDomain = (raw: string) => {
  const d = raw.trim();
  return /^https?:\/\//i.test(d) ? d : `https://${d}`;
};

const joinUrl = (...parts: string[]) =>
  parts
    .map((p, i) => (i === 0 ? p.replace(/\/+$/,'') : p.replace(/^\/+|\/+$/g,'')))
    .filter(Boolean)
    .join('/');
    const proceedToBooking = (e?: React.MouseEvent | React.FormEvent) => {
  // Guard against forms/buttons interfering
  if (e?.preventDefault) e.preventDefault();

  if (!selectedTenantForBooking) {
    toast.error('Please select a healthcare provider', {
      description: 'You must select a healthcare provider to book an appointment.',
    });
    return;
  }

  const tenant = tenantsList.find(t => t.id === selectedTenantForBooking);
  if (!tenant?.domain) {
    toast.error('Invalid healthcare provider', {
      description: 'Unable to navigate to the selected provider. Please try again.',
    });
    return;
  }

  const base = normalizeDomain(tenant.domain); // already has https:// in your case
  const dest = joinUrl(base, '/appointments/patient-book');

  try {
    // Defer to the next tick so React/Inertia event handling completes first
    setTimeout(() => {
      console.log('Navigating to', dest);
      window.location.assign(dest);   // more explicit than setting href
    }, 0);
  } catch (err) {
    console.error('Navigation failed:', err);
    toast.error('Navigation failed', { description: 'Please try again.' });
  }
};

    // Upcoming appointments from API data
    const upcomingAppointments = dashboardData?.upcomingAppointments || [];

    // Current medications from API data
    const currentMedications = dashboardData?.currentMedications || [];

    // Recent visits from API data
    const recentVisits = dashboardData?.recentVisits || [];

    // Filter data based on selected clinic
    const getFilteredData = () => {
        if (selectedClinic === 'all') {
            return {
                appointments: upcomingAppointments,
                medications: currentMedications,
                visits: recentVisits
            };
        } else {
            // Filter by clinic - in real app this would filter by actual clinic data
            const clinicName = clinics.find(c => c.id === selectedClinic)?.name || '';
            return {
                appointments: upcomingAppointments.filter(apt =>
                    apt.location.includes(clinicName.split(' ')[0]) || selectedClinic === 'downtown-medical'
                ),
                medications: selectedClinic === 'downtown-medical' ? currentMedications : currentMedications.slice(0, 2),
                visits: recentVisits.filter((_, index) =>
                    selectedClinic === 'downtown-medical' ? true : index < 2
                )
            };
        }
    };

    const filteredData = getFilteredData();

    const quickStats = {
        upcomingAppointments: filteredData.appointments.length,
        activeMedications: filteredData.medications.length,
        completedThisYear: dashboardData?.quickStats?.visitsThisYear || 0,
        nextAppointment: filteredData.appointments[0]
    };

    // Show loading state if either config or data is loading
    const isLoading = isConfigLoading || isDataLoading;

    return (
        <>
            <Head title="Patient Dashboard" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-6 bg-primary/5">
                {/* Success Message for Public Portal Registration */}
                {(showWelcomeMessage || fromPublicPortal) && (
                    <Alert className="bg-green-50 border-green-200 text-green-800">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription>
                            <strong>Welcome to your patient dashboard!</strong> Your registration and appointment booking were successful.
                            You can now manage your appointments, view your medical information, and more.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Success Message for Waiting List Signup */}
                {showWaitingListMessage && (
                    <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <AlertDescription>
                            <strong>You've been added to the waiting list!</strong> We'll contact you as soon as a slot becomes available for your preferred time.
                            You can view and manage your waiting list entries from your appointment history.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Success Message for Appointment Booking */}
                {showAppointmentMessage && (
                    <Alert className="bg-green-50 border-green-200 text-green-800">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription>
                            <strong>Appointment booked successfully!</strong> Your appointment has been scheduled and you'll receive a confirmation soon.
                            You can view and manage your appointments from your appointment history below.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Timezone Banner - Styled like Time and Locale Settings Preview */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-green-700">
                            {isCentral ? 'Timezone Information (Local)' : 'Timezone Information (Tenant Level)'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-green-600" />
                            <span className="text-gray-600">Timezone: </span>
                            <span className="font-semibold text-green-800">{tenantTimezoneDisplay}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Date: </span>
                            <span className="font-medium">{getFormattedDateTime().date}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Time: </span>
                            <span className="font-medium">{getFormattedDateTime().time}</span>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-muted-foreground">Loading your dashboard...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Welcome Header */}
                            {isSectionEnabled('welcomeHeader') && (
                                <div className="lg:col-span-2 bg-gradient-to-br from-primary/8 via-white to-white border-2 border-primary/30 rounded-xl p-6 shadow-md relative overflow-hidden">
                                    {/* Background Pattern */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16"></div>
                                    <div className="absolute bottom-0 right-0 w-20 h-20 bg-primary/10 rounded-full translate-y-10 translate-x-8"></div>

                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="bg-primary/15 rounded-full p-2 border border-primary/20">
                                                        <Heart className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <h1 className="text-2xl font-bold text-primary">
                                                        Welcome back, {firstName}!
                                                    </h1>
                                                </div>
                                                <p className="text-muted-foreground mb-3">
                                                    Stay on top of your health with your personalized dashboard
                                                </p>

                                                {/* Health Status Summary */}
                                                <div className="flex items-center gap-4 text-sm">
                                                    <div className="flex items-center gap-1 text-green-600">
                                                        <CheckCircle className="w-4 h-4" />
                                                        <span className="font-medium">Health on track</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-blue-600">
                                                        <CalendarDays className="w-4 h-4" />
                                                        <span>{quickStats.upcomingAppointments} upcoming</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-purple-600">
                                                        <Pill className="w-4 h-4" />
                                                        <span>{quickStats.activeMedications} active meds</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tenant Switcher - Only show when enabled in config */}
                                        {isSectionEnabled('welcomeHeader') && isWidgetEnabled('welcomeHeader', 'tenantSwitcher') &&
                                            config.filters.showTenantSwitcher && tenantsList.length > 1 && (
                                                <div className="flex items-center gap-3 bg-white/50 rounded-lg p-3 border border-primary/20 mb-3">
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Building2 className="w-4 h-4" />
                                                        <span className="font-medium">Current Healthcare Provider:</span>
                                                    </div>
                                                    <Select value={selectedTenantState} onValueChange={handleTenantChange}>
                                                        <SelectTrigger className="w-80 h-9 bg-white border-gray-300 focus:ring-primary focus:border-primary shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                                                                <SelectValue className="truncate" />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {tenantsList.map((tenant) => (
                                                                <SelectItem key={tenant.id} value={tenant.id}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                                        <span className="truncate">{tenant.name}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    {selectedTenantState !== 'all' && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Current Provider
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}

                                        {/* Clinic Filter - Only show when enabled in config */}
                                        {isSectionEnabled('welcomeHeader') && isWidgetEnabled('welcomeHeader', 'clinicFilter') &&
                                            config.filters.showClinicFilter && (
                                                <div className="flex items-center gap-3 bg-white/50 rounded-lg p-3 border border-primary/20">
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Filter className="w-4 h-4" />
                                                        <span className="font-medium">View data from:</span>
                                                    </div>
                                                    <Select value={selectedClinic} onValueChange={setSelectedClinic}>
                                                        <SelectTrigger className="w-80 h-9 bg-white border-gray-300 focus:ring-primary focus:border-primary shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                                                                <SelectValue className="truncate" />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {clinics.map((clinic) => (
                                                                <SelectItem key={clinic.id} value={clinic.id}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                                        <span className="truncate">{clinic.name}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    {selectedClinic !== 'all' && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Clinic-specific view
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions Widget */}
                            {isSectionEnabled('quickActions') && (
                                <div className="lg:col-span-1 bg-white border-2 border-primary/30 rounded-xl p-6 shadow-md">
                                    <div className="text-center mb-4">
                                        <h3 className="text-sm font-semibold text-primary mb-1">Quick Actions</h3>
                                        <p className="text-xs text-amber-600 font-medium">
                                            Actions for your current clinic session only
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button 
                                            onClick={handleBookAppointment}
                                            className="bg-primary hover:bg-primary/90 h-12 text-xs font-medium flex-col gap-1 p-2 w-full"
                                        >
                                            <Calendar className="w-5 h-5" />
                                            <span>Book Appointment</span>
                                        </Button>
                                         <Link
                                                            href={isCentral ? '/central/calendar' : '/calendar'}
                                                            className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2 inline-flex items-center justify-center rounded-md border"
                                                            >
                                            <FileText className="w-5 h-5" />
                                            <span>Schedule</span>
                                        </Link>
                                       <Link
                                                            href={isCentral ? '/central/my-details/health-history' : '/my-details'}
                                                            className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2 inline-flex items-center justify-center rounded-md border"
                                                            >
                                            <User className="w-5 h-5" />
                                            <span>{isCentral ? 'Update profile' : 'My details'}</span>
                                        </Link>
                                         <Link
                                                            href={isCentral ? '/central/appointments' : '/appointments'}
                                                            className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2 inline-flex items-center justify-center rounded-md border"
                                                            >
                                            <FileText className="w-5 h-5" />
                                            <span>Appointments</span>
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Loading Indicator for Tenant Switching */}
                        <AnimatePresence>
                            {isLoadingTenant && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
                                >
                                    <div className="bg-white/90 backdrop-blur-md border border-primary/30 rounded-xl p-6 shadow-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full"></div>
                                            <span className="text-primary font-medium">Switching healthcare provider...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Quick Stats */}
                        {isSectionEnabled('quickStats') && (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={selectedClinic}
                                    initial={{ opacity: 0, filter: "blur(4px)" }}
                                    animate={{ opacity: isLoadingTenant ? 0.6 : 1, filter: isLoadingTenant ? "blur(4px)" : "blur(0px)" }}
                                    exit={{ opacity: 0, filter: "blur(4px)" }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                >
                                    <Card className="border-2 border-primary/40 bg-white shadow-lg hover:shadow-xl transition-shadow">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-gray-600 text-sm font-medium">Next Confirmed Appointment</p>
                                                    <p className="text-xl font-bold text-primary">{quickStats.nextAppointment?.date || 'None confirmed'}</p>
                                                    <p className="text-gray-600 text-sm">{quickStats.nextAppointment?.time || ''}</p>
                                                </div>
                                                <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-2.5">
                                                    <CalendarDays className="w-6 h-6 text-primary" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-2 border-primary/40 bg-white shadow-lg hover:shadow-xl transition-shadow">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-gray-600 text-sm font-medium">Active Medications</p>
                                                    <p className="text-xl font-bold text-primary">{quickStats.activeMedications}</p>
                                                    <p className="text-gray-600 text-sm">Current prescriptions</p>
                                                </div>
                                                <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-2.5">
                                                    <Pill className="w-6 h-6 text-primary" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-2 border-primary/40 bg-white shadow-lg hover:shadow-xl transition-shadow">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-gray-600 text-sm font-medium">Visits This Year</p>
                                                    <p className="text-xl font-bold text-primary">{quickStats.completedThisYear}</p>
                                                    <p className="text-gray-600 text-sm">Healthcare visits</p>
                                                </div>
                                                <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-2.5">
                                                    <Activity className="w-6 h-6 text-primary" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </AnimatePresence>
                        )}

                        {(isSectionEnabled('upcomingAppointments') || isSectionEnabled('currentMedications')) && (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`appointments-${selectedClinic}`}
                                    initial={{ opacity: 0, filter: "blur(4px)" }}
                                    animate={{ opacity: isLoadingTenant ? 0.6 : 1, filter: isLoadingTenant ? "blur(4px)" : "blur(0px)" }}
                                    exit={{ opacity: 0, filter: "blur(4px)" }}
                                    transition={{ duration: 0.3, ease: "easeInOut", delay: 0.1 }}
                                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                                >
                                    {/* Upcoming Appointments */}
                                    {isSectionEnabled('upcomingAppointments') && (
                                        <Card className="shadow-lg border-0">
                                            <CardHeader className="pb-4">
                                            <CardTitle className="flex items-center gap-3 text-primary text-xl">
                                                <Calendar className="w-6 h-6" />
                                                Upcoming Appointments
                                            </CardTitle>
                                            <CardDescription className="text-base">
                                                Your confirmed scheduled healthcare visits
                                            </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {filteredData.appointments.length > 0 ? filteredData.appointments.map((appointment:any) => (
                                                    <div key={appointment.id} className="border-l-4 border-l-primary bg-primary/5 rounded-r-lg p-4 hover:bg-primary/10 transition-colors">
                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge
                                                                            variant={appointment.status === 'confirmed' ? 'default' : 'secondary'}
                                                                            className="font-medium"
                                                                        >
                                                                            {appointment.status === 'confirmed' ? (
                                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                            ) : (
                                                                                <Clock className="w-3 h-3 mr-1" />
                                                                            )}
                                                                            {appointment.status}
                                                                        </Badge>
                                                                        <Badge variant="outline" className="text-primary border-primary">
                                                                            {appointment.mode === 'Virtual' ? (
                                                                                <Video className="w-3 h-3 mr-1" />
                                                                            ) : (
                                                                                <MapPinIcon className="w-3 h-3 mr-1" />
                                                                            )}
                                                                            {appointment.mode}
                                                                        </Badge>
                                                                    </div>
                                                                    <h4 className="font-semibold text-primary text-lg">{appointment.service}</h4>
                                                                    <p className="text-muted-foreground font-medium">
                                                                        {appointment.practitioner} • {appointment.specialty}
                                                                    </p>
                                                                    <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                                                                        <div className="flex items-center gap-2">
                                                                            <Calendar className="w-4 h-4 text-primary" />
                                                                            <span className="font-medium">{appointment.date} at {appointment.time}</span>
                                                                            <span className="text-xs bg-muted px-2 py-1 rounded">
                                                                                {appointment.duration}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <MapPin className="w-4 h-4 text-primary" />
                                                                            <span>{appointment.location}</span>
                                                                        </div>
                                                                        {appointment.address !== 'Video Call' && (
                                                                            <div className="text-xs text-muted-foreground ml-6">
                                                                                {appointment.address}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="text-center py-8 text-muted-foreground">
                                                        <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                        <p>No confirmed upcoming appointments</p>
                                                        <p className="text-xs mt-1">Pending appointments will show here once confirmed</p>
                                                    </div>
                                                )}
                                                <Button 
                                                    onClick={handleBookAppointment}
                                                    className="w-full bg-primary hover:bg-primary/90 h-12 text-base font-medium"
                                                >
                                                    <Plus className="w-5 h-5 mr-2" />
                                                    Schedule New Appointment
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Current Medications */}
                                    {isSectionEnabled('currentMedications') && (
                                        <Card className="shadow-lg border-0">
                                            <CardHeader className="pb-4">
                                                <CardTitle className="flex items-center gap-3 text-primary text-xl">
                                                    <Pill className="w-6 h-6" />
                                                    Current Medications
                                                </CardTitle>
                                                <CardDescription className="text-base">
                                                    Your active prescriptions and supplements
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {filteredData.medications.length > 0 ? filteredData.medications.map((medication:any) => (
                                                    <div key={medication.id} className="border-l-4 border-l-primary bg-primary/5 rounded-r-lg p-4 hover:bg-primary/10 transition-colors">
                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className="space-y-2">
                                                                    <h4 className="font-bold text-primary text-lg">
                                                                        {medication.name} {medication.dosage}
                                                                    </h4>
                                                                    <div className="space-y-1">
                                                                        <p className="text-sm font-medium">
                                                                            <span className="text-muted-foreground">Take:</span> {medication.frequency} • {medication.timeToTake}
                                                                        </p>
                                                                        <p className="text-sm">
                                                                            <span className="text-muted-foreground">For:</span> {medication.purpose}
                                                                        </p>
                                                                        <p className="text-sm">
                                                                            <span className="text-muted-foreground">Prescribed by:</span> {medication.prescribedBy}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Next refill: {medication.nextRefill}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="text-center py-8 text-muted-foreground">
                                                        <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                        <p>No medications from this clinic</p>
                                                    </div>
                                                )}
                                                <Button variant="outline" className="w-full h-12 text-base font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                                                    <FileText className="w-5 h-5 mr-2" />
                                                    View All Prescriptions
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        )}

                        {/* Recent Visits */}
                        {isSectionEnabled('recentVisits') && (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`visits-${selectedClinic}`}
                                    initial={{ opacity: 0, filter: "blur(4px)" }}
                                    animate={{ opacity: isLoadingTenant ? 0.6 : 1, filter: isLoadingTenant ? "blur(4px)" : "blur(0px)" }}
                                    exit={{ opacity: 0, filter: "blur(4px)" }}
                                    transition={{ duration: 0.3, ease: "easeInOut", delay: 0.2 }}
                                >
                                    <Card className="shadow-lg border-0">
                                        <CardHeader className="pb-4">
                                            <CardTitle className="flex items-center gap-3 text-primary text-xl">
                                                <Activity className="w-6 h-6" />
                                                Recent Visits
                                            </CardTitle>
                                            <CardDescription className="text-base">
                                                Your latest healthcare appointments and outcomes
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {filteredData.visits.length > 0 ? filteredData.visits.map((visit:any) => (
                                                <div key={visit.id} className="border-l-4 border-l-primary bg-primary/5 rounded-r-lg p-4 hover:bg-primary/10 transition-colors">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-3 flex-1">
                                                            <div className="flex items-center gap-4">
                                                                <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800">
                                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                                    {visit.status}
                                                                </Badge>
                                                                <span className="text-sm text-muted-foreground font-medium">{visit.date}</span>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-primary text-lg">{visit.service}</h4>
                                                                <p className="text-muted-foreground font-medium">
                                                                    {visit.practitioner} • {visit.specialty}
                                                                </p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-700">Visit Summary:</p>
                                                                    <p className="text-sm text-muted-foreground">{visit.summary}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-700">Follow-up:</p>
                                                                    <p className="text-sm text-muted-foreground">{visit.followUp}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="sm" className="text-primary hover:bg-primary hover:text-primary-foreground">
                                                            <FileText className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                    <p>No recent visits for this clinic</p>
                                                </div>
                                            )}
                                            <Button variant="outline" className="w-full h-12 text-base font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                                                <Activity className="w-5 h-5 mr-2" />
                                                View All Visit History
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </>
                )}

                {/* Tenant Selection Dialog for Booking */}
                <Dialog open={showTenantSelectDialog} onOpenChange={setShowTenantSelectDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-primary" />
                                Select Healthcare Provider
                            </DialogTitle>
                            <DialogDescription>
                                Choose which healthcare provider you'd like to book an appointment with.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <Select value={selectedTenantForBooking} onValueChange={setSelectedTenantForBooking}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a healthcare provider..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {tenantsList.map((tenant) => (
                                        <SelectItem key={tenant.id} value={tenant.id}>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-gray-500" />
                                                <span>{tenant.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowTenantSelectDialog(false);
                                        setSelectedTenantForBooking('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={proceedToBooking}
                                    disabled={!selectedTenantForBooking}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Continue to Booking
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}

// Define the layout property for Inertia.js
interface PatientDashboardWithLayout {
    layout?: (page: React.ReactElement) => React.ReactElement;
}

// Set the layout using the same pattern as PractitionerDashboard
(PatientDashboard as typeof PatientDashboard & PatientDashboardWithLayout).layout = (page: React.ReactElement) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
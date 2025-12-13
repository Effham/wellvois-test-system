import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { withAppLayout, withLayout } from '@/utils/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { useState, useEffect } from 'react';
import PracticeQuestionnaire from '@/components/practice-questionnaire';

import { router } from '@inertiajs/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Calendar, Users, UserCheck, Activity, TrendingUp, MoreHorizontal, Clock, Inbox, MapPin } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { applyTimeLocaleSettings, previewTimeLocaleSettings } from '@/hooks/use-time-locale';
import { PageContentLoader } from '@/components/page-content-loader';
import type React from 'react';

interface DashboardData {
    statsData: {
        totalPatients: number;
        totalPractitioners: number;
        upcomingAppointments: number;
        attendanceToday: number;
    };
    upcomingAppointments: Array<{
        id: number;
        patient: string;
        practitioner: string;
        time: string;
        type: string;
        status: string;
    }>;
    recentAttendance: Array<{
        id: number;
        practitioner: string;
        checkIn: string | null;
        checkOut: string | null;
        status: string;
    }>;
    patientDemographics: Array<{
        ageGroup: string;
        value: number;
    }>;
    practitionerPerformance: Array<{
        name: string;
        appointments: number;
        satisfaction: number;
        trend: string;
    }>;
    locationsWithMostAppointments: Array<{
        id: number;
        name: string;
        address: string;
        appointmentCount: number;
    }>;
    tenantTimezone?: string;
    tenantTimezoneDisplay?: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

function Dashboard() {
    const pageProps = usePage<any>().props;
    const { tenancy, flash } = pageProps;
    const tenantTimezone = pageProps.tenantTimezone || 'UTC';
    const tenantTimezoneDisplay = pageProps.tenantTimezoneDisplay || 'UTC';
    const onboardingStatus = pageProps.onboardingStatus || {
        hasLocation: false,
        hasService: false,
        locationCount: 0,
        serviceCount: 0,
        isComplete: false,
    };
    
    
    // Debug logging for timezone props
    useEffect(() => {
        console.log('Dashboard timezone props:', {
            tenantTimezone,
            tenantTimezoneDisplay,
            allProps: pageProps
        });
    }, [tenantTimezone, tenantTimezoneDisplay, pageProps]);
    
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [onboardingStatusLoaded, setOnboardingStatusLoaded] = useState(false);
    
    // State for real-time preview (same as TimeLocale.tsx)
    const [previewData, setPreviewData] = useState<{
        sampleDate: string;
        sampleTime: string;
        sampleDateTime: string;
    } | null>(null);

    // Apply tenant timezone settings on mount
    useEffect(() => {
        if (tenantTimezone && pageProps.tenantDateFormat && pageProps.tenantTimeFormat) {
            applyTimeLocaleSettings(tenantTimezone, pageProps.tenantDateFormat, pageProps.tenantTimeFormat);
            console.log('Applied tenant time/locale settings on Dashboard mount');
        }
    }, [tenantTimezone, pageProps.tenantDateFormat, pageProps.tenantTimeFormat]);

    // Update preview every second for live clock (same logic as TimeLocale.tsx but with live updates)
    useEffect(() => {
        const updatePreview = () => {
            if (tenantTimezone && pageProps.tenantDateFormat && pageProps.tenantTimeFormat) {
                const preview = previewTimeLocaleSettings(
                    tenantTimezone,
                    pageProps.tenantDateFormat,
                    pageProps.tenantTimeFormat
                );
                setPreviewData(preview);
            }
        };

        // Initial update
        updatePreview();

        // Update every second for live clock
        const timer = setInterval(updatePreview, 1000);

        return () => clearInterval(timer);
    }, [tenantTimezone, pageProps.tenantDateFormat, pageProps.tenantTimeFormat]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/dashboard/data', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                setDashboardData(data);
                setOnboardingStatusLoaded(true);
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data');

                // Fallback to default data
                setDashboardData({
                    statsData: {
                        totalPatients: 0,
                        totalPractitioners: 0,
                        upcomingAppointments: 0,
                        attendanceToday: 0
                    },
                    upcomingAppointments: [],
                    recentAttendance: [],
                    patientDemographics: [
                        { ageGroup: '0-18', value: 22 },
                        { ageGroup: '19-35', value: 35 },
                        { ageGroup: '36-50', value: 28 },
                        { ageGroup: '51-65', value: 12 },
                        { ageGroup: '65+', value: 3 }
                    ],
                    practitionerPerformance: []
                });
                setOnboardingStatusLoaded(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Use dynamic data or fallback to defaults
    const statsData = dashboardData?.statsData || {
        totalPatients: 0,
        totalPractitioners: 0,
        upcomingAppointments: 0,
        attendanceToday: 0
    };

    const upcomingAppointments = dashboardData?.upcomingAppointments || [];
    const recentAttendance = dashboardData?.recentAttendance || [];
    const patientDemographics = dashboardData?.patientDemographics || [];
    const practitionerPerformance = dashboardData?.practitionerPerformance || [];
    const locationsWithMostAppointments = dashboardData?.locationsWithMostAppointments || [];
    
    // Get onboarding status from API response or props
    // Use API response if available, otherwise fall back to props
    const apiOnboardingStatus = dashboardData?.onboardingStatus || onboardingStatus;
    
    // Show loading state only if we don't have onboarding status from props AND API is still loading
    const shouldShowLoading = !onboardingStatusLoaded && isLoading;
    
    if (shouldShowLoading) {
        return (
            <>
                <Head title="Loading..." />
                <PageContentLoader delay={0} mode="full">
                    <div></div>
                </PageContentLoader>
            </>
        );
    }
    

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-6">
                {/* Live Preview (Tenant Level) - Same as TimeLocale.tsx */}
                {previewData && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">Live Preview (Tenant Level)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Date: </span>
                                <span className="font-medium dark:text-gray-300">{previewData.sampleDate}</span>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Time: </span>
                                <span className="font-medium dark:text-gray-300">{previewData.sampleTime}</span>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">DateTime: </span>
                                <span className="font-medium dark:text-gray-300">{previewData.sampleDateTime}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Flash Messages */}
                {flash?.success && (
                    <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                            {flash.success}
                        </AlertDescription>
                    </Alert>
                )}
                {flash?.error && (
                    <Alert className="bg-red-50 border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                            {flash.error}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Dashboard Data Loading Error */}
                {error && (
                    <Alert className="bg-red-50 border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                            <strong>Dashboard Error:</strong> {error}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Stats Overview */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border border-border bg-white hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-foreground">
                                Total Patients
                            </CardTitle>
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <Users className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{statsData.totalPatients}</div>
                            {statsData.totalPatients > 0 && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <TrendingUp className="h-3 w-3 text-primary" />
                                    <span className="text-primary font-medium">+12%</span> from last month
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    
                    <Card className="border border-border bg-white hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-foreground">
                                Practitioners
                            </CardTitle>
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <UserCheck className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{statsData.totalPractitioners}</div>
                            {statsData.totalPractitioners > 0 && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <TrendingUp className="h-3 w-3 text-primary" />
                                    <span className="text-primary font-medium">+2</span> new this month
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    
                    <Card className="border border-border bg-white hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-foreground">
                                Upcoming Appointments
                            </CardTitle>
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <Calendar className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{statsData.upcomingAppointments}</div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3 text-primary" />
                                <span className="font-medium">Today</span>
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card className="border border-border bg-white hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-foreground">
                                Attendance Today
                            </CardTitle>
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <Activity className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{statsData.attendanceToday}</div>
                            {statsData.attendanceToday > 0 && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <TrendingUp className="h-3 w-3 text-primary" />
                                    <span className="text-primary font-medium">+8%</span> from yesterday
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
                
                <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                    {/* Upcoming Appointments - Top Left */}
                    <Card className="border border-border hover:shadow-md transition-shadow self-start">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-lg">
                                        <Calendar className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-foreground">Upcoming Appointments</CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Today's scheduled appointments
                                        </CardDescription>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-0 py-1.5 px-2.5">
                                    {upcomingAppointments.length}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {upcomingAppointments.length > 0 ? (
                                <>
                                    <div className="space-y-4">
                                        {upcomingAppointments.slice(0, 3).map((appt) => (
                                            <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                                <div className="space-y-1 flex-1">
                                                    <p className="text-sm font-semibold text-foreground">{appt.patient}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <UserCheck className="h-3 w-3" />
                                                        {appt.practitioner}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{appt.type}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <p className="text-sm font-semibold text-primary flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {appt.time}
                                                    </p>
                                                    <Badge 
                                                        variant={
                                                            appt.status === 'confirmed' ? 'default' : 
                                                            appt.status === 'pending' ? 'secondary' : 'destructive'
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Link href="/appointments">
                                        <Button variant="outline" className="w-full mt-4 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                                            View All Appointments
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <div className="py-6 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-muted rounded-full p-3">
                                            <Inbox className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">No data found</p>
                                        <p className="text-xs text-muted-foreground">There are no upcoming appointments at this time</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    
                    {/* Practitioner Attendance - Top Right */}
                    <Card className="border border-border hover:shadow-md transition-shadow self-start">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-lg">
                                        <Activity className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-foreground">Practitioner Attendance</CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Today's check-ins
                                        </CardDescription>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-0 py-1.5 px-2.5">
                                    {recentAttendance.length}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {recentAttendance.length > 0 ? (
                                <>
                                    <div className="space-y-3">
                                        {recentAttendance.map((record) => (
                                            <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                                <div className="space-y-1 flex-1">
                                                    <p className="text-sm font-semibold text-foreground">{record.practitioner}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3 text-primary" />
                                                        <span className="text-primary font-medium">In:</span> {record.checkIn}
                                                        {record.checkOut && (
                                                            <>
                                                                <span className="mx-1">•</span>
                                                                <span className="text-primary font-medium">Out:</span> {record.checkOut}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge 
                                                    variant={record.status === 'completed' ? 'default' : 'secondary'}
                                                    className="text-xs bg-primary/10 text-primary border-0"
                                                >
                                                    {record.status === 'completed' ? 'Completed' : 'Present'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                    <Link href="/attendance-logs">
                                        <Button variant="outline" className="w-full mt-4 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                                            View All Attendance
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <div className="py-6 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-muted rounded-full p-3">
                                            <Inbox className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">No data found</p>
                                        <p className="text-xs text-muted-foreground">No attendance records available for today</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    
                    {/* Practitioner Performance - Bottom Left */}
                    <Card className="border border-border hover:shadow-md transition-shadow self-start">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-lg">
                                        <TrendingUp className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-foreground">Practitioner Performance</CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Appointment volume and patient satisfaction
                                        </CardDescription>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {practitionerPerformance.length > 0 ? (
                                <div className="space-y-3">
                                    {practitionerPerformance.map((practitioner, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                            <div className="space-y-1 flex-1">
                                                <p className="text-sm font-semibold text-foreground">{practitioner.name}</p>
                                                <p className="text-xs text-muted-foreground">This week</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-primary">{practitioner.appointments}</p>
                                                    <p className="text-xs text-muted-foreground">Appointments</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-primary">{practitioner.satisfaction}%</p>
                                                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-6 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-muted rounded-full p-3">
                                            <Inbox className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">No data found</p>
                                        <p className="text-xs text-muted-foreground">No performance data available at this time</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    
                    {/* Locations with Most Appointments - Bottom Right */}
                    <Card className="border border-border hover:shadow-md transition-shadow self-start">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-lg">
                                        <MapPin className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-foreground">Locations with Most Appointments</CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Top locations by appointment volume
                                        </CardDescription>
                                    </div>
                                </div>
                                {locationsWithMostAppointments.length > 0 && (
                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0 py-1.5 px-2.5">
                                        {locationsWithMostAppointments.length}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {locationsWithMostAppointments.length > 0 ? (
                                <div className="space-y-3">
                                    {locationsWithMostAppointments.map((location) => (
                                        <div key={location.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                            <div className="space-y-1 flex-1">
                                                <p className="text-sm font-semibold text-foreground">{location.name}</p>
                                                {location.address && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {location.address}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-primary">{location.appointmentCount}</p>
                                                <p className="text-xs text-muted-foreground">Appointments</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-6 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-muted rounded-full p-3">
                                            <Inbox className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">No data found</p>
                                        <p className="text-xs text-muted-foreground">No location data available at this time</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

// Layout wrapper component that conditionally applies layout based on props
function ConditionalLayout({ children }: { children: React.ReactElement }) {
    const pageProps = usePage<any>().props;
    const showQuestionnaire = pageProps.showQuestionnaire;
    const onboardingStatus = pageProps.onboardingStatus || {};
    // Get practice questionnaire answers to check if we're showing questionnaire or operating hours
    const appointmentType = pageProps.appointmentType || null;
    const hasCompletedQuestionnaire = pageProps.practiceType && pageProps.appointmentType;
    
    // Get hasMultipleLocations from props
    const hasMultipleLocations = pageProps.hasMultipleLocations === true || pageProps.hasMultipleLocations === 'true';
    
    // Check if we need to show operating hours step
    // Skip if: onboarding is complete OR has virtual location with hours OR has location OR has multiple locations
    // For virtual-only, if operating hours are already saved, we don't need to show operating hours step
    const needsOperatingHours = (appointmentType === 'virtual' || appointmentType === 'hybrid') && 
                                 !onboardingStatus.isComplete &&
                                 !onboardingStatus.hasVirtualLocationWithHours &&
                                 !onboardingStatus.hasLocation && 
                                 !hasMultipleLocations;
    
    // Don't use layout if:
    // 1. Questionnaire needs to be shown (showQuestionnaire prop is true)
    // 2. Questionnaire not completed yet (no practiceType/appointmentType)
    // 3. Operating hours step needs to be shown (virtual/hybrid without location)
    // 4. Onboarding checklist is being shown (onboarding not complete)
    const shouldSkipLayout = showQuestionnaire || 
                             !hasCompletedQuestionnaire ||
                             needsOperatingHours ||
                             !onboardingStatus.isComplete;
    
    if (shouldSkipLayout) {
        // Return children without layout wrapper (questionnaire, operating hours, or checklist)
        return children;
    }
    
    // Otherwise wrap with AppLayout (actual dashboard content)
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {children}
        </AppLayout>
    );
}

// Wrapper component
function DashboardWrapper() {
    return <Dashboard />;
}

// Set layout property to use conditional layout component
DashboardWrapper.layout = (page: React.ReactElement) => {
    return <ConditionalLayout>{page}</ConditionalLayout>;
};

export default DashboardWrapper;
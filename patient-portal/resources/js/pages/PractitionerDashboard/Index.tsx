import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { convertToTenantTimezone, formatDate, formatTime } from '@/hooks/use-time-locale';
import {
    Calendar,
    Clock,
    MapPin,
    Stethoscope,
    AlertCircle,
    CheckCircle,
    Activity,
    CalendarDays,
    MessageSquare,
    Plus,
    FileText,
    Video,
    User,
    Building2,
    Filter,
    Users,
    TrendingUp,
    Bell,
    BookOpen,
    ClipboardList,
    Star,
    DollarSign,
    Phone,
    ChevronRight,
    MoreHorizontal,
    Pill,
    Download,
    ChevronDown,
    AlertTriangle,
    RefreshCw,
    ExternalLink,
    Loader2
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Practitioner Dashboard',
        href: '/practitioner-dashboard',
    },
];

interface PractitionerDashboardProps {
    practitionerInfo: {
        name: string;
        preferredName: string;
        title: string;
        specialty: string;
        licenseNumber: string;
        rating: number;
        totalReviews: number;
    };
    todayAppointments?: Array<{
        id: number;
        time: string;
        patient: string;
        age?: number;
        service: string;
        duration: string;
        status: string;
        room: string;
        location_id?: number;
        mode: string;
    }> | null;
    statistics?: {
        todayAppointments: number;
        completedToday: number;
        pendingApprovals: number;
        totalPatients: number;
        thisWeekRevenue: number;
        newPatientsThisMonth: number;
        prescriptionsThisWeek: number;
    } | null;
    recentActivities?: Array<{
        id: number;
        patient: string;
        action: string;
        time: string;
        priority: string;
        details: string;
    }> | null;
    upcomingSchedule?: Array<{
        date: string;
        fullDate?: string;
        appointments: number;
        timeSlots: string;
        isAvailable?: boolean;
    }> | null;
    availableLocations: Array<{
        id: number;
        name: string;
        location: string;
    }>;
    selectedLocation: string;
    selectedPeriod: string;
    isCentral?: boolean;
    error?: string;
    tenantTimezone?: string;
    loadedData?: boolean;
}

export default function PractitionerDashboard({
    practitionerInfo,
    todayAppointments,
    statistics,
    recentActivities,
    upcomingSchedule,
    availableLocations,
    selectedLocation: initialSelectedLocation,
    selectedPeriod: initialSelectedPeriod,
    isCentral = false,
    error,
    tenantTimezone = 'UTC',
    tenantTimezoneDisplay = 'UTC',
    loadedData = false
}: PractitionerDashboardProps) {

    const [selectedPeriod, setSelectedPeriod] = useState(initialSelectedPeriod || 'today');
    const [selectedClinic, setSelectedClinic] = useState(initialSelectedLocation || 'all');
    const [isLoading, setIsLoading] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    // Update current time every second for live preview
    React.useEffect(() => {
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
                date: formatDate(convertedDate),
                time: formatTime(convertedDate)
            };
        }
    };

    // Safe practitioner info with fallback
    const safePractitionerInfo = practitionerInfo || {
        name: 'Unknown Practitioner',
        preferredName: 'Dr.',
        title: 'Physician',
        specialty: 'General Practice',
        licenseNumber: 'N/A',
        rating: 4.8,
        totalReviews: 0
    };

    // Mock time period data
    const timePeriods = [
        { id: 'today', name: 'Today' },
        { id: 'week', name: 'This Week' },
        { id: 'month', name: 'This Month' }
    ];

    // Dynamic clinics data from server
    const clinics = [
        { id: 'all', name: 'All Locations', location: 'All Locations' },
        ...(availableLocations || []).map(location => ({
            id: location.id.toString(),
            name: location.name,
            location: location.location
        }))
    ];

    // Function to handle clinic change with loading animation
    const handleClinicChange = async (clinicId: string) => {
        setIsLoading(true);
        setSelectedClinic(clinicId);
        
        // Navigate with new parameters using Inertia
        // For central context, use central route; for tenant context, use tenant route
        const route = isCentral ? '/central/practitioner-dashboard' : '/practitioner-dashboard';
        router.get(route, {
            location: clinicId,
            period: selectedPeriod
        });
    };

    // Use server-side data directly with fallback
    const practitionerStats = statistics || {
        todayAppointments: 0,
        completedToday: 0,
        pendingApprovals: 0,
        totalPatients: 0,
        thisWeekRevenue: 0,
        newPatientsThisMonth: 0,
        prescriptionsThisWeek: 0
    };

    // Safe arrays with fallbacks
    const safeTodayAppointments = todayAppointments || [];
    const safeRecentActivities = recentActivities || [];
    // Filter out unavailable days from upcoming schedule
    const safeUpcomingSchedule = (upcomingSchedule || []).filter(day => day.isAvailable !== false);

    // Static pending tasks (can be made dynamic later)
    const pendingTasks = [
        {
            id: 1,
            task: 'Review lab results for 3 patients',
            priority: 'high',
            dueTime: 'Due in 2 hours',
            category: 'Lab Review'
        },
        {
            id: 2,
            task: 'Approve prescription refills',
            priority: 'medium',
            dueTime: 'Due today',
            category: 'Prescriptions'
        },
        {
            id: 3,
            task: 'Complete patient notes for morning visits',
            priority: 'high',
            dueTime: 'Due in 1 hour',
            category: 'Documentation'
        },
        {
            id: 4,
            task: 'Return patient calls',
            priority: 'medium',
            dueTime: 'Due before 5 PM',
            category: 'Communication'
        },
        {
            id: 5,
            task: 'Update treatment plans',
            priority: 'low',
            dueTime: 'Due tomorrow',
            category: 'Treatment'
        }
    ];

    // Use server-side upcoming schedule data

    const quickStats = {
        todayAppointments: practitionerStats.todayAppointments,
        completedToday: practitionerStats.completedToday,
        pendingApprovals: practitionerStats.pendingApprovals,
        totalPatients: practitionerStats.totalPatients,
        nextAppointment: safeTodayAppointments[practitionerStats.completedToday]
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-800 border-red-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'completed': return 'bg-blue-100 text-blue-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <>
            <Head title="Practitioner Dashboard" />
            
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-6">
                <div className="w-full space-y-6">

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

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 text-red-800">
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-medium">Dashboard Error</span>
                            </div>
                            <p className="text-red-700 text-sm mt-1">{error}</p>
                        </div>
                    )}


                    {/* Header Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Welcome Header */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-primary/8 via-white to-white border-2 border-primary/30 rounded-xl p-6 shadow-md relative overflow-hidden">
                            {/* Background Pattern */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16"></div>
                            <div className="absolute bottom-0 right-0 w-20 h-20 bg-primary/10 rounded-full translate-y-10 translate-x-8"></div>
                            
                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1 pr-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-primary/15 rounded-full p-2 border border-primary/20">
                                                <Stethoscope className="w-5 h-5 text-primary" />
                                            </div>
                                            <h1 className="text-2xl font-bold text-primary">
                                                Welcome back, {safePractitionerInfo.preferredName}!
                                            </h1>
                                        </div>
                                        <p className="text-muted-foreground mb-3">
                                            {safePractitionerInfo.title} - Manage your practice efficiently
                                        </p>
                                    </div>
                                    
                                    {/* Clinic Selector - Only show in central context */}
                                    {isCentral && (
                                        <div className="flex flex-col gap-2 min-w-[240px]">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-primary" />
                                                <span className="text-sm font-medium text-primary">Current Clinic:</span>
                                            </div>
                                            <Select value={selectedClinic} onValueChange={handleClinicChange}>
                                                <SelectTrigger className="w-full border-primary/30 focus:border-primary">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {clinics.map((clinic) => (
                                                        <SelectItem key={clinic.id} value={clinic.id}>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{clinic.name}</span>
                                                                <span className="text-xs text-muted-foreground">{clinic.location}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            
                                            {selectedClinic !== 'all' && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex items-center gap-2 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium"
                                                >
                                                    <MapPin className="w-3 h-3" />
                                                    Active Clinic
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Rating & License Info */}
                                <div className="flex items-center gap-6 bg-white/50 rounded-lg p-3 border border-primary/20">
                                    <div className="flex items-center gap-2">
                                        <Star className="w-4 h-4 text-yellow-500" />
                                        <span className="text-sm font-medium">{safePractitionerInfo.rating} Rating</span>
                                        <span className="text-xs text-gray-500">({safePractitionerInfo.totalReviews} reviews)</span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <span className="font-medium">License:</span> {safePractitionerInfo.licenseNumber}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <span className="font-medium">Specialty:</span> {safePractitionerInfo.specialty}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions Widget */}
                        <div className="lg:col-span-1 bg-white border-2 border-primary/30 rounded-xl p-6 shadow-md">
                            <div className="text-center mb-4">
                                <h3 className="text-sm font-semibold text-primary mb-1">Quick Actions</h3>
                                <p className="text-xs text-amber-600 font-medium">
                                    Common practice management tasks
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                       <Link
                    href={isCentral ? '/central/appointments' : '/appointments'}
                    className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2 inline-flex items-center justify-center rounded-md border"
                    >
                                    <Users className="w-5 h-5" />
                                    <span>View Appointments</span>
                                </Link>
                                 <Link
                    href={isCentral ? '/central/calendar' : '/calendar'}
                    className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2 inline-flex items-center justify-center rounded-md border"
                    >
                            {/* <Button variant="outline" className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2"
                                              
                                                > */}
                                                    <Calendar className="w-5 h-5" />
                                                    <span>Schedule</span>
                                                {/* </Button> */}
                    </Link>
                              
                                 <Link
                    href={isCentral ? '/central/my-details' : '/invoices'}
                    className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2 inline-flex items-center justify-center rounded-md border"
                    >
                                    <FileText className="w-5 h-5" />
                                    <span>{isCentral ? 'My details' : 'Invoices'}</span>
                                </Link>
                                <Link
                                    href={isCentral ? '/central/personal-information' : '/attendance-logs'}
                                    className="h-12 text-xs font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground flex-col gap-1 p-2 inline-flex items-center justify-center rounded-md border"
                                >
                                <ClipboardList className="w-5 h-5" />
                                <span>{isCentral ? 'Personal Information' : 'Attendance Logs'}</span>
                                </Link>
                            </div>
                        </div>
                    </div>



                    {/* Loading Indicator */}
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
                            >
                                <div className="bg-white/90 backdrop-blur-md border border-primary/30 rounded-xl p-6 shadow-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full"></div>
                                        <span className="text-primary font-medium">Switching clinic...</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Quick Stats */}
                    <motion.div
                            className={`grid grid-cols-1 md:grid-cols-4 gap-4 transition-all duration-300 ${
                                isLoading ? 'blur-sm opacity-60' : 'blur-0 opacity-100'
                            }`}
                            layout
                        >
                            <Card className="border-2 border-primary/40 bg-white shadow-lg hover:shadow-xl transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-600 text-sm font-medium">Today's Appointments</p>
                                            <p className="text-xl font-bold text-primary">{quickStats.todayAppointments}</p>
                                            <p className="text-gray-600 text-sm">{quickStats.completedToday} completed</p>
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
                                            <p className="text-gray-600 text-sm font-medium">Pending Approvals</p>
                                        <p className="text-xl font-bold text-primary">{quickStats.pendingApprovals}</p>
                                        <p className="text-gray-600 text-sm">Require attention</p>
                                    </div>
                                    <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-2.5">
                                        <Bell className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="border-2 border-primary/40 bg-white shadow-lg hover:shadow-xl transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-600 text-sm font-medium">Total Patients</p>
                                        <p className="text-xl font-bold text-primary">{quickStats.totalPatients}</p>
                                        <p className="text-gray-600 text-sm">Under your care</p>
                                    </div>
                                    <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-2.5">
                                        <Users className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                            <Card className="border-2 border-primary/40 bg-white shadow-lg hover:shadow-xl transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-600 text-sm font-medium">Week Revenue</p>
                                            <p className="text-xl font-bold text-primary">${practitionerStats.thisWeekRevenue.toLocaleString()}</p>
                                            <p className="text-gray-600 text-sm">This week</p>
                                        </div>
                                        <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-2.5">
                                            <DollarSign className="w-6 h-6 text-primary" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                    {/* Main Content Grid */}
                    <motion.div 
                        className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-300 ${
                            isLoading ? 'blur-sm opacity-60' : 'blur-0 opacity-100'
                        }`}
                        layout
                        key={selectedClinic}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: isLoading ? 0.6 : 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                        
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* Today's Appointments */}
                            <Card className="border border-gray-200 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-primary">Today's Appointments</h3>
                                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                                            {safeTodayAppointments.length} scheduled
                                        </Badge>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <AnimatePresence mode="wait">
                                            {safeTodayAppointments.map((appointment, index) => (
                                                <motion.div 
                                                    key={`${selectedClinic}-${appointment.id}`}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    transition={{ delay: index * 0.1, duration: 0.3 }}
                                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                                                >
                                                <div className="flex items-center gap-4">
                                                    <div className="text-center">
                                                        <div className="text-sm font-semibold text-primary">{appointment.time}</div>
                                                        <div className="text-xs text-gray-500">{appointment.duration}</div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-medium text-gray-900">{appointment.patient}</h4>
                                                            <span className="text-sm text-gray-500">({appointment.age}y)</span>
                                                            <Badge variant="outline" className={getStatusColor(appointment.status)}>
                                                                {appointment.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-gray-600">{appointment.service}</p>
                                                        <p className="text-xs text-gray-500">{appointment.room}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="outline" className="h-8 px-3">
                                                        <FileText className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 px-3">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    
                                    <div className="mt-4 text-center">
                                        <Button variant="outline" className="text-primary border-primary hover:bg-primary hover:text-primary-foreground">
                                            View Full Schedule
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent Patient Activities */}
                            {/* <Card className="border border-gray-200 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-primary">Recent Patient Activities</h3>
                                        <Button size="sm" variant="outline">
                                            View All
                                        </Button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {safeRecentActivities.map((activity) => (
                                            <div key={activity.id} className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                                    activity.priority === 'high' ? 'bg-red-500' :
                                                    activity.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}></div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-gray-900">{activity.patient}</span>
                                                        <Badge className={`text-xs ${getPriorityColor(activity.priority)}`}>
                                                            {activity.priority}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-1">{activity.action}</p>
                                                    <p className="text-xs text-gray-500">{activity.details}</p>
                                                </div>
                                                <span className="text-xs text-gray-500">{activity.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card> */}
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            
                            {/* Pending Tasks */}
                            {/* <Card className="border border-gray-200 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-primary">Pending Tasks</h3>
                                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                                            {pendingTasks.filter(task => task.priority === 'high').length} urgent
                                        </Badge>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {pendingTasks.map((task) => (
                                            <div key={task.id} className="p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                                                                {task.priority}
                                                            </Badge>
                                                            <span className="text-xs text-gray-500">{task.category}</span>
                                                        </div>
                                                        <p className="text-sm font-medium text-gray-900">{task.task}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{task.dueTime}</p>
                                                    </div>
                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                                        <CheckCircle className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="mt-4">
                                        <Button variant="outline" className="w-full text-primary border-primary hover:bg-primary hover:text-primary-foreground">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add New Task
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card> */}

                            {/* Upcoming Schedule */}
                            <Card className="border border-gray-200 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-primary">Upcoming Schedule</h3>
                                            <p className="text-xs text-gray-500 mt-1">Rest of the week</p>
                                        </div>
                                        <Button size="sm" variant="outline">
                                            <Calendar className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {safeUpcomingSchedule.map((day, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                <div>
                                                    <div className="font-medium text-gray-900">{day.date}</div>
                                                    {day.fullDate && (
                                                        <div className="text-xs text-gray-500">{day.fullDate}</div>
                                                    )}
                                                    <div className="text-sm text-gray-600">{day.timeSlots}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-primary">{day.appointments}</div>
                                                    <div className="text-xs text-gray-500">appointments</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quick Statistics */}
                            {/* <Card className="border border-gray-200 shadow-sm">
                                <CardContent className="p-6">
                                    <h3 className="text-lg font-semibold text-primary mb-4">Practice Statistics</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-blue-600" />
                                                <span className="text-sm text-gray-600">New Patients (Month)</span>
                                            </div>
                                            <span className="font-semibold text-gray-900">{practitionerStats.newPatientsThisMonth}</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Pill className="w-4 h-4 text-green-600" />
                                                <span className="text-sm text-gray-600">Prescriptions (Week)</span>
                                            </div>
                                            <span className="font-semibold text-gray-900">{practitionerStats.prescriptionsThisWeek}</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Star className="w-4 h-4 text-yellow-600" />
                                                <span className="text-sm text-gray-600">Average Rating</span>
                                            </div>
                                            <span className="font-semibold text-gray-900">4.8/5.0</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-purple-600" />
                                                <span className="text-sm text-gray-600">Revenue Growth</span>
                                            </div>
                                            <span className="font-semibold text-green-600">+12.5%</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card> */}
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    );
}

PractitionerDashboard.layout = (page: React.ReactElement) => <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>; 
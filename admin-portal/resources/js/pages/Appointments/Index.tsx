import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { withAppLayout } from '@/utils/layout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Calendar, Clock, MapPin, Phone, Mail, User, FileText, MoreHorizontal, Eye, CheckCircle, XCircle, AlertCircle, Hourglass, Stethoscope, UserCheck, Shield, Brain, Plus, Edit, Save, Star, History, ClipboardList, UserCog } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { formatDateTime, getTenantTimezone, convertToTenantTimezone } from '@/hooks/use-time-locale';
import { smartFormatDateTime, debugTimezoneConversion } from '@/utils/time-locale-helpers';
import AppointmentHistoryTable from '@/components/AppointmentHistoryTable';


interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    email: string;
    phone_number: string;
    health_number?: string;
    date_of_birth: string;
    gender_pronouns?: string;
    client_type?: string;
    emergency_contact_phone?: string;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
}

interface Service {
    id: number;
    name: string;
    category?: string;
}

interface Location {
    id: number;
    name: string;
    street_address?: string;
    city?: string;
    province?: string;
}

interface Appointment {
    id: number;
    status: string;
    appointment_datetime: string;
    appointment_datetime_local?: string; // Timezone-converted datetime
    tenant_timezone?: string; // Tenant's timezone
    start_time?: string;
    end_time?: string;
    mode: string;
    booking_source: string;
    date_time_preference: string;
    contact_person?: string;
    notes?: string;
    patient: Patient;
    primary_practitioner_id?: number; // Primary practitioner ID
    practitioners_list?: Array<{id: number; name: string}>; // New structure for multiple practitioners
    practitioners_detail?: Array<{
        id: number; 
        name: string; 
        start_time: string; 
        end_time: string;
    }>; // Detailed practitioner info with individual times
    service: Service;
    location?: Location;
    send_intake_form: boolean;
    send_appointment_confirmation: boolean;
    add_to_calendar: boolean;
    tag_with_referral_source: boolean;
    created_at: string;
    updated_at: string;
    encounter?: {
        id: number;
        status: string;
        session_started_at: string;
        session_completed_at: string;
        session_duration_seconds: number;
        has_data: boolean;
    } | null;
    ai_summary_status: string; // 'generated', 'pending', 'no', 'insufficient_data'
}

interface Props {
    appointments?: {
        data: Appointment[];
        current_page: number;
        per_page: number;
        total: number;
        last_page: number;
        from: number;
        to: number;
    };
    statuses?: string[];
    practitioners?: { id: number; name: string }[];
    user_role?: string; // 'practitioner', 'patient', 'staff'
    filters: {
        status: string;
        practitioner_id: string;
        search: string;
        date_from: string;
        date_to: string;
        perPage: number;
    };
}

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '' },
];

function AppointmentsIndex({ appointments, statuses, practitioners, user_role, filters }: Props) {
    const { auth, flash, organizationSettings, tenancy }: any = usePage().props;
    const userPerms: string[] = auth?.user?.permissions || [];
    const theme = organizationSettings?.appearance || {};
    const isCentral = tenancy?.is_central;
    
    // Tenant-specific checks (only in tenant context)
    const isTenantPractitioner = !isCentral && (auth?.user?.is_tenant_practitioner || false);
    const isTenantPatient = !isCentral && (auth?.user?.is_tenant_patient || false);
    console.log('appointments',appointments)
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showDetailsSheet, setShowDetailsSheet] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [showHistorySheet, setShowHistorySheet] = useState(false);
    const [appointmentHistory, setAppointmentHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
    const [sendingConsent, setSendingConsent] = useState<number | null>(null);
    const [updatingAppointment, setUpdatingAppointment] = useState(false);

    // Helper function to check if appointment is scheduled for today in tenant timezone
    const isAppointmentToday = (appointment: Appointment): boolean => {
        // Get today's date in YYYY-MM-DD format in tenant timezone
        const todayInTenantTz = convertToTenantTimezone(new Date());
        const todayDateStr = todayInTenantTz.getFullYear() + '-' +
                             String(todayInTenantTz.getMonth() + 1).padStart(2, '0') + '-' +
                             String(todayInTenantTz.getDate()).padStart(2, '0');

        // Extract date portion from appointment (YYYY-MM-DD)
        const appointmentDateStr = appointment.appointment_datetime_local || appointment.appointment_datetime;
        // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
        const appointmentDate = appointmentDateStr.split('T')[0].split(' ')[0];

        // Simple string comparison
        return todayDateStr === appointmentDate;
    };

    // Filter states
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [status, setStatus] = useState(filters.status || '');
    const [practitionerId, setPractitionerId] = useState(filters.practitioner_id || '');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    // Handle flash messages from Laravel (centralized toast notifications)
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                description: 'Operation completed successfully.',
                duration: 4000,
            });
        }
        if (flash?.error) {
            toast.error(flash.error, {
                description: 'Please try again or contact support if the issue persists.',
                duration: 5000,
            });
        }
    }, [flash]);

    // Fetch data using partial reload when deferred props are null
    useEffect(() => {
        if (!appointments || !statuses || !practitioners) {
            router.reload({
                only: ['appointments', 'statuses', 'practitioners'],
                data: filters, // Ensure filters are included in the request
                onError: (errors) => {
                    console.error('Failed to load appointments data:', errors);
                    toast.error('Failed to load appointments', {
                        description: 'Please refresh the page to try again.',
                        duration: 6000,
                    });
                },
            });
        }
    }, []);

    const handleSearch = () => {
        const filterParams = {
            search,
            perPage,
            status: status === 'all' ? '' : status,
            practitioner_id: practitionerId === 'all' ? '' : practitionerId,
            date_from: dateFrom,
            date_to: dateTo,
        };
        router.get(route('appointments.index'), filterParams, { preserveState: true });
    };

    const handlePerPageChange = (e:any) => {
        setPerPage(e)
        const filterParams = {
            search,
            perPage:e,
            status: status === 'all' ? '' : status,
            practitioner_id: practitionerId === 'all' ? '' : practitionerId,
            date_from: dateFrom,
            date_to: dateTo,
        };
        router.get(route('appointments.index'), filterParams, { preserveState: true });
    };

    const handleStatusUpdate = async (appointmentId: number, newStatus: string) => {
        setUpdatingStatus(appointmentId);

        try {
            await router.patch(route('appointments.updateStatus', appointmentId), {
                status: newStatus,
            }, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    // Flash message will show toast automatically via useEffect
                },
                onError: () => {
                    toast.error('Failed to update appointment status');
                },
            });
        } finally {
            setUpdatingStatus(null);
        }
    };

    const handleApproveAndConfirm = async (appointmentId: number, newStatus: 'pending' | 'confirmed') => {
        setUpdatingStatus(appointmentId);

        try {
            await router.post(route('appointments.approve-and-confirm', appointmentId), {
                new_status: newStatus,
            }, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    // Flash message will show toast automatically via useEffect
                },
                onError: () => {
                    toast.error('Failed to approve appointment');
                },
            });
        } finally {
            setUpdatingStatus(null);
        }
    };

    const handleResendConsent = async (appointmentId: number) => {
        setSendingConsent(appointmentId);

        try {
            await router.post(route('appointments.resend-consent', appointmentId), {}, {
                preserveState: true,
                preserveScroll: true,
                onFinish: () => {
                    setSendingConsent(null);
                },
            });
        } catch (error) {
            setSendingConsent(null);
        }
    };

    // Fetch appointment history for a given appointment
    const fetchAppointmentHistory = async (appointment: Appointment) => {
        setLoadingHistory(true);
        setSelectedAppointment(appointment);
        
        try {
            const response = await fetch(route('appointments.history', appointment.id), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            if (response.ok) {
                const historyData = await response.json();
                console.log('📦 Received appointment history data:', historyData);
                
                if (historyData.success) {
                    setAppointmentHistory(historyData.appointments || []);
                    setShowHistorySheet(true);
                } else {
                    toast.error(historyData.message || 'Failed to load appointment history');
                    console.error('❌ Backend error:', historyData.error);
                }
            } else {
                const errorText = await response.text();
                toast.error('Failed to load appointment history');
                console.error('❌ HTTP Error:', response.status, errorText);
            }
        } catch (error) {
            toast.error('Error loading appointment history');
            console.error('Error fetching appointment history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'requested':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'confirmed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'cancelled':
            case 'declined':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'requested':
                return <ClipboardList className="h-4 w-4" />;
            case 'pending':
                return <Hourglass className="h-4 w-4" />;
            case 'confirmed':
                return <CheckCircle className="h-4 w-4" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4" />;
            case 'cancelled':
            case 'declined':
                return <XCircle className="h-4 w-4" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
        }
    };

    // Use the hook's formatDateTime function instead of custom implementation

    // Generate columns based on user role
    const generateColumns = () => {
        const baseColumns = [];
        
        // Patient column - hidden for patients themselves
        if (user_role !== 'patient') {
            baseColumns.push({
                accessorKey: 'patient',
                header: 'Patient',
                cell: ({ row }:any) => (
                    <div>
                        <div className="font-medium">
                            {row.original.patient?.first_name || 'Unknown'} {row.original.patient?.last_name || 'Patient'}
                        </div>
                        <div className="text-sm text-gray-500">
                            {row.original.patient?.email || 'No email'}
                        </div>
                    </div>
                ),
            });
        }

        // Practitioner column - visible to all
        baseColumns.push({
            accessorKey: 'practitioners_list',
            header: 'Practitioner(s)',
            cell: ({ row }:any) => (
                <div className="font-medium">
                    {row.original.practitioners_list && row.original.practitioners_list.length > 0 
                        ? row.original.practitioners_list.map((p:any) => p.name).join(', ')
                        : 'No practitioners assigned'
                    }
                </div>
            ),
        });

        // Service column - visible to all
        baseColumns.push({
            accessorKey: 'service',
            header: 'Service',
            cell: ({ row }:any) => (
                <div className="font-medium">
                    {row.original.service?.name || 'Unknown Service'}
                </div>
            ),
        });

        // Requested Date & Time column - visible to all (merged date/time and date requested)
        baseColumns.push({
            accessorKey: 'appointment_datetime',
            header: 'Requested Date & Time',
            cell: ({ row }:any) => (
                <div className="text-sm">
                    <div className="font-medium">{smartFormatDateTime(row.original)}</div>
                    <div className="text-xs text-gray-500">
                        {getTenantTimezone().split('/').pop()}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        Requested: {formatDateTime(row.original.created_at)}
                    </div>
                </div>
            ),
        });

        // Location & Mode column - visible to all
        baseColumns.push({
            accessorKey: 'location',
            header: 'Location & Mode',
            cell: ({ row }:any) => (
                <div className="text-sm">
                    <div>{row.original.location?.name || 'Not specified'}</div>
                    <div className="text-xs text-gray-500 capitalize">
                        {row.original.mode === 'virtual' ? 'Virtual' : row.original.mode || 'In-person'}
                    </div>
                </div>
            ),
        });

        // Documents column - visible to all
        baseColumns.push({
            id: 'documents',
            header: 'Documents',
            cell: ({ row }:any) => {
                const docsCount = (row.original.encounter?.documents?.length || 0) 
                const docText = docsCount === 0 ? 'No docs' : `${docsCount} doc${docsCount > 1 ? 's' : ''}`;
                
                return (
                    <div className="flex items-center gap-2">
                        {/* For practitioners - make clickable to view documents */}
                        {user_role === 'practitioner' && row.original.encounter ? (
                            <Link href={route('encounters.documents.upload', row.original.encounter.id)}>
                                <Button variant="ghost" size="sm" className="h-auto p-1 text-left">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-3 w-3" />
                                        <span className="text-sm">{docText}</span>
                                    </div>
                                </Button>
                            </Link>
                        ) : (
                            <span className="text-sm">{docText}</span>
                        )}
                        
                        {/* Add document button - only for patients */}
                        {user_role === 'patient' && row.original.encounter && (
                            <Link href={route('encounters.documents.upload', row.original.encounter.id)}>
                                <Button variant="outline" size="sm" className="h-6 w-6 p-0">
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </Link>
                        )}
                    </div>
                );
            },
        });

        // Status column - visible to all (including patients now)
        baseColumns.push({
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }:any) => (
                <Badge className={getStatusColor(row.original.status)}>
                    {getStatusIcon(row.original.status)}
                    <span className="ml-1 capitalize">{row.original.status}</span>
                </Badge>
            ),
        });

        // Session column - visible to practitioners and admins
        if (user_role !== 'patient') {
            baseColumns.push({
                id: 'session',
                header: 'Session',
                cell: ({ row }:any) => (
                    <div>
                        {row.original.encounter ? (
                            <Badge className="bg-green-100 text-green-800">
                                <Stethoscope className="h-3 w-3 mr-1" />
                                Session
                            </Badge>
                        ) : (
                            <span className="text-sm text-gray-400">No session</span>
                        )}
                    </div>
                ),
            });
        }

        return baseColumns;
    };

    const table = useReactTable({
        data: appointments?.data || [],
        columns: [
            ...generateColumns(),
            // Actions column
            {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }:any) => (
                    <div className="flex items-center gap-2">
                        <Link href={route('appointments.show', row.original.id)}>
                            <Button
                                variant="outline"
                                size="sm"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        </Link>

                        {/* Manage Button - Only for admins with pending or Requested status */}
                        {user_role === 'admin' && userPerms.includes('update-appointment') && (row.original.status === 'pending' || row.original.status === 'Requested') && (
                            <Link href={route('appointments.manage', row.original.id)}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    title={row.original.status === 'Requested' ? 'Edit appointment details' : 'Manage appointment'}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </Link>
                        )}
                        
                        {/* Start/Continue Session Button - Only for practitioners, confirmed appointments scheduled for today */}
                        {isTenantPractitioner && row.original.status === 'confirmed' && isAppointmentToday(row.original) && (
                            <Link href={`/current-session/${row.original.id}`}>
                                <Button
  variant={row.original.encounter ? "outline" : "default"}
  size="icon"
  title={row.original.encounter ? "Continue Session" : "Start Session"}
  className={`h-8 w-8 rounded-md transition-all duration-150 ${
    row.original.encounter
      ? "hover:bg-gray-100"
      : "bg-green-600 hover:bg-green-700 text-white hover:shadow-sm"
  }`}
>
  <Stethoscope className="h-4 w-4" />
</Button>


                            </Link>
                         )} 
                        
                        {/* AI Summary Button - Hide for patients and only show for completed/confirmed appointments */}
                        {user_role !== 'patient' && (row.original.status === 'completed' || row.original.status === 'confirmed') && (
                            <Link href={`/appointments/${row.original.id}/ai-summary`}>
                                <Button variant="outline" size="sm">
                                    <Brain className="h-4 w-4" />
                                </Button>
                            </Link>
                        )}

                        {/* Rate Appointment Button - Only for completed appointments and patients */}
                        {user_role === 'patient' && row.original.status === 'completed' && (
                            <Link href={`/appointments/${row.original.id}/feedback`}>
                                <Button variant="outline" size="sm" className="text-yellow-600 hover:text-yellow-700">
                                    <Star className="h-4 w-4" />
                                </Button>
                            </Link>
                        )}
                        
                        {/* History Button - Only for admins and practitioners */}
                        {(user_role === 'admin' || user_role === 'practitioner') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchAppointmentHistory(row.original)}
                                disabled={loadingHistory}
                                title="View appointment history"
                            >
                                <History className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Resend Consent button - Only for pending-consent appointments */}
                        {row.original.status === 'pending-consent' && user_role === 'admin' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendConsent(row.original.id)}
                                disabled={sendingConsent === row.original.id}
                                title="Resend consent email to patient"
                            >
                                <Mail className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Status dropdown - Only for admins */}
                        {user_role === 'admin' && userPerms.includes('update-appointment') && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={updatingStatus === row.original.id}
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {row.original.status === 'Requested' ? (
                                        // Special actions for Requested appointments
                                        <>
                                            <DropdownMenuItem
                                                onClick={() => handleApproveAndConfirm(row.original.id, 'confirmed')}
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Approve & Confirm
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleApproveAndConfirm(row.original.id, 'pending')}
                                            >
                                                <UserCog className="h-4 w-4 mr-2" />
                                                Approve (Set Pending)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(row.original.id, 'declined')}
                                            >
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Decline
                                            </DropdownMenuItem>
                                        </>
                                    ) : (
                                        // Normal actions for other statuses
                                        <>
                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(row.original.id, 'confirmed')}
                                                disabled={row.original.status === 'confirmed' || row.original.status === 'completed' || row.original.status === 'cancelled' || row.original.status === 'declined' || row.original.status === 'pending-consent'}
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirm
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(row.original.id, 'declined')}
                                                disabled={row.original.status === 'declined' || row.original.status === 'confirmed' || row.original.status === 'completed' || row.original.status === 'cancelled'}
                                            >
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Decline
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(row.original.id, 'completed')}
                                                disabled={row.original.status === 'completed' || row.original.status === 'cancelled' || row.original.status === 'declined' || row.original.status === 'pending-consent'}
                                            >
                                                <UserCheck className="h-4 w-4 mr-2" />
                                                Mark Complete
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(row.original.id, 'cancelled')}
                                                disabled={row.original.status === 'cancelled' || row.original.status === 'confirmed' || row.original.status === 'completed'}
                                            >
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Cancel
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                ),
            },
        ],
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <>
            <Card className="shadow-none border-none m-3 sm:m-6">
<CardContent className="space-y-4 p-3 sm:p-6">


            <Head title="Appointments" />
            
            <PageHeader
                title="Appointments"
                description={user_role === 'patient' ? "View and manage your appointments" : "Manage and track all appointments"}
                actions={
                    user_role === 'patient' ? (
                        <Link href="/appointments/patient-book">
                            <Button className='bg-primary text-xs sm:text-sm px-3 sm:px-4'>
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Book Patient Appointment</span>
                                <span className="sm:hidden">Book</span>
                            </Button>
                        </Link>
                    ) : userPerms.includes('add-appointment') && !isTenantPatient && !isTenantPractitioner ? (
                        <Link href="/appointments/create">
                            <Button className='bg-black text-xs sm:text-sm px-3 sm:px-4'>
                                <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Add Appointment</span>
                                <span className="sm:hidden">Add</span>
                            </Button>
                        </Link>
                    ) : null
                }
            />
            
            <FilterBar
                        searchPlaceholder="Search by patient name or email..."
                        filters={[
                            {
                                name: 'status',
                                label: 'Status',
                                type: 'select',
                                options: [
                                    { label: 'All Statuses', value: '' },
                                    ...(statuses || []).map(status => ({
                                        label: status.charAt(0).toUpperCase() + status.slice(1),
                                        value: status
                                    }))
                                ]
                            },
                            // Hide practitioner filter for practitioners themselves
                            ...(user_role !== 'practitioner' ? [{
                                name: 'practitioner_id',
                                label: 'Practitioner',
                                type: 'select' as const,
                                options: [
                                    { label: 'All Practitioners', value: '' },
                                    ...(practitioners || []).map(practitioner => ({
                                        label: practitioner.name,
                                        value: practitioner.id.toString()
                                    }))
                                ]
                            }] : []),
                            {
                                name: 'date_from',
                                label: 'From Date',
                                type: 'date'
                            },
                            {
                                name: 'date_to',
                                label: 'To Date',
                                type: 'date'
                            }
                        ]}
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={handlePerPageChange}
                    />

            

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Appointments</h3>
                        <div className="text-sm text-gray-500">
                            {userPerms.includes('add-appointment') && (
                                <Link href="/appointments/create">
                                    <Button className='bg-primary mx-3'>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Appointment
                                    </Button>
                                </Link>
                            )}
                            Showing {appointments?.from || 0} to {appointments?.to || 0} of {appointments?.total || 0} appointments
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px]">
                                <thead className="bg-gray-50">
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => (
                                                <th key={header.id} className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {table.getRowModel().rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            {row.getVisibleCells().map((cell) => (
                                                <td key={cell.id} className="px-4 py-3 text-sm">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="mt-4">
                        <Pagination
                            currentPage={appointments?.current_page || 1}
                            lastPage={appointments?.last_page || 1}
                            total={appointments?.total || 0}
                            url="/appointments"
                        />
                    </div>
                </CardContent>
            </Card>
            </CardContent>
            </Card>

            {/* Appointment Details Sheet */}
            <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
                <SheetContent className="w-[50vw] min-w-[50vw] max-w-[50vw] overflow-hidden flex flex-col bg-gradient-to-br from-white to-gray-50/50" side="right">
                    <SheetHeader className="pb-8 border-b border-gray-200/80 flex-shrink-0 bg-white/80 backdrop-blur-sm">
                        <SheetTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
                                    <Calendar className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Appointment Details</h2>
                                    <p className="text-sm text-gray-500 font-medium mt-1">
                                        {selectedAppointment && `Appointment ID: #${selectedAppointment.id}`}
                                    </p>
                                </div>
                            </div>
                            {selectedAppointment && (
                                <div className="flex flex-col items-end gap-2">
                                    <Badge className={`${getStatusColor(selectedAppointment.status)} px-4 py-2 text-sm font-semibold shadow-sm`}>
                                        {getStatusIcon(selectedAppointment.status)}
                                        <span className="ml-2 capitalize">{selectedAppointment.status}</span>
                                    </Badge>
                                    <p className="text-xs text-gray-400 font-medium">Status</p>
                                </div>
                            )}
                        </SheetTitle>
                    </SheetHeader>

                    {selectedAppointment && (
                        <div className="flex-1 overflow-y-auto py-6 pr-1">
                            <div className="space-y-8">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100/50 shadow-sm">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                            <Clock className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Schedule Information</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-white/80 rounded-xl p-4 backdrop-blur-sm border border-white/50">
                                            <p className="text-sm font-medium text-gray-600 mb-1">Appointment Date & Time</p>
                                            <p className="text-2xl font-bold text-gray-900 mb-1">
                                                {smartFormatDateTime(selectedAppointment)}
                                            </p>
                                            <p className="text-sm text-gray-600">{getTenantTimezone()}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <Badge variant="secondary" className="capitalize font-medium px-3 py-1">
                                                {selectedAppointment.mode} Session
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100/50 shadow-sm">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Patient Information</h3>
                                    </div>

                                    <div className="bg-white/80 rounded-xl p-5 backdrop-blur-sm border border-white/50">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center border-2 border-emerald-200">
                                                <User className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-gray-900">
                                                    {selectedAppointment.patient?.first_name} {selectedAppointment.patient?.last_name}
                                                </p>
                                                <p className="text-sm text-gray-500 font-medium">Primary Patient</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {selectedAppointment.patient?.email && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                        <Mail className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email Address</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedAppointment.patient.email}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedAppointment.patient?.phone_number && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                        <Phone className="w-4 h-4 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone Number</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedAppointment.patient.phone_number}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedAppointment.patient?.date_of_birth && (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                                        <Calendar className="w-4 h-4 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Birth</p>
                                                        <p className="text-sm font-medium text-gray-900">{new Date(selectedAppointment.patient.date_of_birth).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100/50 shadow-sm">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                                            <Stethoscope className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Service Details</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-white/80 rounded-xl p-5 backdrop-blur-sm border border-white/50">
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                        <Stethoscope className="w-4 h-4 text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Service Type</p>
                                                        <p className="text-sm font-bold text-gray-900">{selectedAppointment.service?.name || 'Unknown Service'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                                        <UserCheck className="w-4 h-4 text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Healthcare Provider</p>
                                                        <p className="text-sm font-bold text-gray-900">
                                                            {selectedAppointment.practitioners_list && selectedAppointment.practitioners_list.length > 0 
                                                                ? selectedAppointment.practitioners_list.map(p => p.name).join(', ')
                                                                : 'No practitioners assigned'
                                                            }
                                                        </p>
                                                    </div>
                                                </div>

                                                {selectedAppointment.location && (
                                                    <div className="flex items-start gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                                                            <MapPin className="w-4 h-4 text-rose-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</p>
                                                            <p className="text-sm font-bold text-gray-900">{selectedAppointment.location.name}</p>
                                                            {selectedAppointment.location.street_address && (
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    {selectedAppointment.location.street_address}
                                                                    {selectedAppointment.location.city && `, ${selectedAppointment.location.city}`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
                                                    <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                                                        <Calendar className="w-4 h-4 text-cyan-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Booking Source</p>
                                                        <Badge variant="secondary" className="capitalize font-medium mt-1">{selectedAppointment.booking_source}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {(selectedAppointment.notes || selectedAppointment.contact_person) && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-5">
                                            <FileText className="w-5 h-5 text-primary" />
                                            <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                                        </div>

                                        <div className="space-y-4">
                                            {selectedAppointment.contact_person && (
                                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                    <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Contact Person</p>
                                                    <p className="font-semibold text-gray-900">{selectedAppointment.contact_person}</p>
                                                </div>
                                            )}

                                            {selectedAppointment.notes && (
                                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                    <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Notes</p>
                                                    <div className="bg-gray-50 rounded-lg p-3">
                                                        <p className="text-sm text-gray-700 leading-relaxed">{selectedAppointment.notes}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-gray-50 rounded-lg p-4 border-t">
                                    <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">System Information</p>
                                    <div className="text-xs text-gray-600 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Created:</span>
                                            <span>{new Date(selectedAppointment.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Last Updated:</span>
                                            <span>{new Date(selectedAppointment.updated_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Appointment History Sheet */}
            <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
                <SheetContent className="w-[80vw] min-w-[80vw] max-w-[80vw] overflow-hidden flex flex-col bg-gradient-to-br from-white to-gray-50/50" side="right">
                    <SheetHeader className="pb-8 border-b border-gray-200/80 flex-shrink-0 bg-white/80 backdrop-blur-sm">
                        <SheetTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
                                    <History className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Appointment History</h2>
                                    <p className="text-sm text-gray-500 font-medium mt-1">
                                        {selectedAppointment && `For appointment #${selectedAppointment.id}`}
                                    </p>
                                </div>
                            </div>
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto py-6 pr-1">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                                    <p className="text-gray-500">Loading appointment history...</p>
                                </div>
                            </div>
                        ) : (
                            <AppointmentHistoryTable appointmentHistoryData={appointmentHistory} />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}

export default withAppLayout(AppointmentsIndex, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments' }
    ]
});
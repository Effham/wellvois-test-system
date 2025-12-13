import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, Calendar } from "lucide-react"
import { toast } from 'sonner';
import { formatTime, formatDate, getTenantTimezone } from '@/hooks/use-time-locale';

// Safe timezone display function - now uses backend-provided abbreviation
const getTimezoneAbbreviation = (backendTimezoneAbbr?: string): string => {
    // Use backend-provided abbreviation if available
    if (backendTimezoneAbbr) {
        return backendTimezoneAbbr;
    }

    // Fallback to client-side logic
    try {
        const timezone = getTenantTimezone();
        if (!timezone) return 'Local Time'; // Better fallback

        // Map known timezones to their abbreviations
        const timezoneMap: Record<string, string> = {
            'America/Toronto': 'EST/EDT',
            'America/New_York': 'EST/EDT',
            'America/Chicago': 'CST/CDT',
            'America/Denver': 'MST/MDT',
            'America/Vancouver': 'PST/PDT',
            'America/Los_Angeles': 'PST/PDT',
            'America/Halifax': 'AST/ADT',
            'America/St_Johns': 'NST/NDT',
            'UTC': 'UTC',
            'Europe/London': 'GMT/BST',
            'Europe/Paris': 'CET/CEST',
            'Asia/Tokyo': 'JST',
            'Australia/Sydney': 'AEST/AEDT',
            'Pacific/Auckland': 'NZST/NZDT'
        };

        // Return mapped abbreviation or fallback to city name
        const abbreviation = timezoneMap[timezone];
        if (abbreviation) {
            return abbreviation;
        }

        // Fallback: extract city name from timezone
        const parts = timezone.split('/');
        return parts.length > 1 ? parts[1].replace('_', ' ') : timezone;
    } catch (error) {
        console.warn('Error getting timezone abbreviation:', error);
        return 'Local Time'; // Better fallback
    }
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Attendance Logs', href: '/attendance-logs' },
];

type AttendanceLog = {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    date: string;
    clock_in_time: string | null;
    clock_out_time: string | null;
    total_duration_minutes: number | null;
    status: 'clocked_in' | 'clocked_out' | 'not_clocked_in';
};

type AttendanceLogsPageProps = {
    attendanceLogs: {
        data: AttendanceLog[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search: string;
        perPage: number;
        sortBy: string;
        sortOrder: string;
    };
    isPractitioner: boolean;
    currentTimezone?: string;
    timezoneAbbreviation?: string;
};

export default function Index() {
    const { attendanceLogs, filters, flash, auth, isPractitioner, currentTimezone, timezoneAbbreviation }: any = usePage<AttendanceLogsPageProps>().props;
    const userPerms: string[] = auth?.user?.permissions || [];
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 15);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Format duration to HH:MM
    const formatDuration = (minutes: number | null) => {
        if (!minutes) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    // Use timezone-aware formatting functions from the hook
    const formatDateDisplay = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Define user column for admin view
    const userColumn = {
        accessorKey: 'user_name',
        header: 'User',
        cell: ({ row }) => {
            const userName = row.getValue('user_name') as string;
            const userEmail = row.original.user_email;
            return (
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                        <div className="font-medium">{userName}</div>
                        <div className="text-sm text-gray-500">{userEmail}</div>
                    </div>
                </div>
            );
        },
    };

    // Define base columns (always shown)
    const baseColumns = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ row }) => {
                const date = row.getValue('date') as string;
                return (
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <div>
                            <span>{formatDateDisplay(date)}</span>
                            <div className="text-xs text-gray-500">{getTimezoneAbbreviation(timezoneAbbreviation)}</div>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: 'clock_in_time',
            header: 'Clock In',
            cell: ({ row }) => {
                const clockInTime = row.getValue('clock_in_time') as string | null;
                return (
                    <div className={clockInTime ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        <div>{formatTime(clockInTime || '')}</div>
                        {clockInTime && <div className="text-xs text-gray-500">{getTimezoneAbbreviation(timezoneAbbreviation)}</div>}
                    </div>
                );
            },
        },
        {
            accessorKey: 'clock_out_time',
            header: 'Clock Out',
            cell: ({ row }) => {
                const clockOutTime = row.getValue('clock_out_time') as string | null;
                return (
                    <div className={clockOutTime ? 'text-red-600 font-medium' : 'text-gray-400'}>
                        <div>{formatTime(clockOutTime || '')}</div>
                        {clockOutTime && <div className="text-xs text-gray-500">{getTimezoneAbbreviation(timezoneAbbreviation)}</div>}
                    </div>
                );
            },
        },
        {
            accessorKey: 'total_duration_minutes',
            header: 'Duration',
            cell: ({ row }) => {
                const duration = row.getValue('total_duration_minutes') as number | null;
                const status = row.original.status;
                
                if (status === 'clocked_in') {
                    return (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-600 font-medium">Active</span>
                        </div>
                    );
                }
                
                return (
                    <span className={duration ? 'font-medium' : 'text-gray-400'}>
                        {formatDuration(duration)}
                    </span>
                );
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.getValue('status') as string;
                
                const statusConfig = {
                    clocked_in: { label: 'Clocked In', variant: 'default' as const, icon: '🟢' },
                    clocked_out: { label: 'Clocked Out', variant: 'secondary' as const, icon: '🔴' },
                    not_clocked_in: { label: 'Not Clocked In', variant: 'outline' as const, icon: '⚪' },
                };
                
                const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_clocked_in;
                
                return (
                    <Badge variant={config.variant} className="gap-1">
                        <span>{config.icon}</span>
                        {config.label}
                    </Badge>
                );
            },
        },
    ];

    // Combine columns based on user type
    const columns: ColumnDef<AttendanceLog>[] = isPractitioner ? baseColumns : [userColumn, ...baseColumns];

    const table = useReactTable({
        data: attendanceLogs.data,
        columns: columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/attendance-logs', { search, perPage }, { preserveState: true });
    };

    // Calculate summary stats
    const todayStats = attendanceLogs.data.filter(log => {
        const today = new Date().toISOString().split('T')[0];
        return log.date === today;
    });

    const currentlyClocked = todayStats.filter(log => log.status === 'clocked_in').length;
    const todayTotal = todayStats.length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Attendance Logs" />
            <Card className="shadow-none border-none m-3 sm:m-6">
                <CardContent className="space-y-4 p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="truncate">{isPractitioner ? 'My Attendance Logs' : 'Attendance Logs'}</span>
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600 mt-1">
                                {isPractitioner
                                    ? 'View your personal attendance'
                                    : 'Monitor staff attendance'
                                }
                            </p>
                        </div>
                        
                        {/* Summary Stats */}
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="text-center">
                                <div className="text-xl sm:text-2xl font-bold text-green-600">{currentlyClocked}</div>
                                <div className="text-xs sm:text-sm text-gray-500">Active</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl sm:text-2xl font-bold text-blue-600">{todayTotal}</div>
                                <div className="text-xs sm:text-sm text-gray-500">Total</div>
                            </div>
                        </div>
                    </div>

                    <FilterBar
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={(value) => {
                            setPerPage(value);
                            router.get('/attendance-logs', { search, perPage: value }, { preserveState: true });
                        }}
                        searchPlaceholder={isPractitioner
                            ? "Search by date..."
                            : "Search by user name, email, or date..."
                        }
                    />

                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm min-w-[700px]">
                            <thead className="bg-gray-50">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <th key={header.id} className="border-b px-4 py-3 text-left font-medium text-gray-700">
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row, index) => (
                                    <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="border-b px-4 py-3">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {attendanceLogs.data.length === 0 && (
                        <div className="text-center py-12">
                            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance logs found</h3>
                            <p className="text-gray-500">
                                {search
                                    ? 'Try adjusting your search criteria.'
                                    : isPractitioner
                                        ? 'Your attendance logs will appear here once you start clocking in.'
                                        : 'Attendance logs will appear here once users start clocking in.'
                                }
                            </p>
                        </div>
                    )}

                    <Pagination 
                        currentPage={attendanceLogs.current_page} 
                        lastPage={attendanceLogs.last_page} 
                        total={attendanceLogs.total} 
                        url="/attendance-logs" 
                    />
                </CardContent>
            </Card>
        </AppLayout>
    );
}

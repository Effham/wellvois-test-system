import { useState } from 'react';
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { EyeIcon, PlusIcon, MinusIcon, UserIcon, FileTextIcon, CalendarIcon, SettingsIcon, CheckCircleIcon, AlertCircleIcon, XCircleIcon, RefreshCwIcon, ClockIcon, InfoIcon } from 'lucide-react';

type ActivityLog = {
    id: number;
    log_name: string;
    description: string;
    event: string | null;
    causer_type: string;
    causer_id: number;
    causer: {
        id: number;
        name: string;
        email: string;
    } | null;
    subject_type: string;
    subject_id: number;
    subject: any;
    properties: {
        attributes?: Record<string, any>;
        old?: Record<string, any>;
    };
    batch_uuid: string | null;
    created_at: string;
    updated_at: string;
};

type ActivityLogPageProps = {
    activityLogs: {
        data: ActivityLog[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search: string;
        perPage: number;
    };
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Activity History', href: '/activity-logs' },
];

// Helper function to render the changes
const renderChanges = (properties: ActivityLog['properties']) => {
    if (!properties) return null;
    
    const { attributes, old } = properties;
    
    // If there are no attributes or old values, just show the raw properties
    if (!attributes && !old) {
        return (
            <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">
                No specific changes tracked
            </div>
        );
    }
    
    // Get all unique keys from both attributes and old objects
    const allKeys = [...new Set([
        ...(attributes ? Object.keys(attributes) : []),
        ...(old ? Object.keys(old) : [])
    ])];
    
    // Filter out timestamps and other common fields we don't need to show
    const filteredKeys = allKeys.filter(key => 
        !['id', 'created_at', 'updated_at'].includes(key)
    );
    
    if (filteredKeys.length === 0) return <div className="text-gray-500 italic p-4 bg-gray-50 rounded-lg text-sm">No changes were made</div>;
    
    return (
        <div className="space-y-4">
            {filteredKeys.map(key => {
                const newValue = attributes?.[key];
                const oldValue = old?.[key];
                const hasChanged = attributes && old && JSON.stringify(newValue) !== JSON.stringify(oldValue);
                
                // Format field names to be more user-friendly
                const formatFieldName = (field: string) => {
                    const fieldNameMap: Record<string, string> = {
                        'value': 'Setting Value',
                        'name': 'Name',
                        'email': 'Email Address',
                        'phone': 'Phone Number',
                        'address': 'Address',
                        'status': 'Status',
                        'description': 'Description',
                        'date': 'Date',
                        'time': 'Time',
                        'location': 'Location',
                        'type': 'Type',
                        'category': 'Category',
                        'notes': 'Notes',
                        'first_name': 'First Name',
                        'last_name': 'Last Name',
                        'date_of_birth': 'Date of Birth',
                        'appointment_date': 'Appointment Date',
                        'appointment_time': 'Appointment Time',
                        'practitioner_id': 'Practitioner',
                        'patient_id': 'Patient',
                        'service_id': 'Service',
                        'location_id': 'Location',
                        'duration': 'Duration',
                        'fee': 'Fee',
                        'is_active': 'Active Status',
                        'is_enabled': 'Enabled Status',
                        'created_at': 'Created Date',
                        'updated_at': 'Last Modified',
                    };
                    
                    return fieldNameMap[field] || field
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                };
                
                // Function to format values in a user-friendly way
                const formatValue = (value: any, fieldName: string) => {
                    if (value === null || value === undefined) {
                        return <span className="text-gray-400 italic text-sm">Not set</span>;
                    }
                    
                    // Handle arrays
                    if (Array.isArray(value)) {
                        if (value.length === 0) {
                            return <span className="text-gray-400 italic text-sm">Empty</span>;
                        }
                        return (
                            <div className="space-y-1">
                                {value.map((item, index) => (
                                    <div key={index} className="flex items-center">
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></div>
                                        <span className="text-sm text-gray-900">
                                            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                                        </span>
                                    </div>
                                ))}
                                {value.length > 3 && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        +{value.length - 3} more items
                                    </div>
                                )}
                            </div>
                        );
                    }
                    
                    // Handle boolean values
                    if (typeof value === 'boolean') {
                        return (
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                value ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                                {value ? 'Yes' : 'No'}
                            </span>
                        );
                    }
                    
                    // Handle status fields
                    if (fieldName.toLowerCase().includes('status') && typeof value === 'string') {
                        const statusColors: Record<string, string> = {
                            'active': 'bg-green-50 text-green-700',
                            'inactive': 'bg-red-50 text-red-700',
                            'pending': 'bg-yellow-50 text-yellow-700',
                            'completed': 'bg-blue-50 text-blue-700',
                            'cancelled': 'bg-gray-50 text-gray-700',
                        };
                        const colorClass = statusColors[value.toLowerCase()] || 'bg-gray-50 text-gray-700';
                        return (
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
                                {value.charAt(0).toUpperCase() + value.slice(1)}
                            </span>
                        );
                    }
                    
                    // Handle dates
                    if (fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('time')) {
                        try {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                return (
                                    <div className="text-sm">
                                        <div className="font-medium">{date.toLocaleDateString()}</div>
                                        <div className="text-xs text-gray-500">{date.toLocaleTimeString()}</div>
                                    </div>
                                );
                            }
                        } catch (e) {
                            // Fall through to default handling
                        }
                    }
                    
                    // Handle objects (non-arrays)
                    if (typeof value === 'object') {
                        return (
                            <div className="text-sm">
                                <pre className="text-xs whitespace-pre-wrap break-words bg-gray-50 p-2 rounded text-gray-600">
                                    {JSON.stringify(value, null, 2)}
                                </pre>
                            </div>
                        );
                    }
                    
                    // Default handling for strings and numbers
                    return (
                        <TruncatedText 
                            text={String(value)}
                            className="text-sm font-medium text-gray-900"
                            maxLength={50}
                        />
                    );
                };

                return (
                    <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-900">{formatFieldName(key)}</h4>
                            {hasChanged && (
                                <Badge className="bg-blue-50 text-blue-700 text-xs">
                                    Modified
                                </Badge>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                                    Previous
                                </Label>
                                <div className="text-sm">
                                    {formatValue(oldValue, key)}
                                </div>
                            </div>
                            
                            <div>
                                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                                    Current
                                </Label>
                                <div className="text-sm">
                                    {formatValue(newValue, key)}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

function getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // in seconds
  
    const units = [
      { max: 60, value: 1, name: 'second' },
      { max: 3600, value: 60, name: 'minute' },
      { max: 86400, value: 3600, name: 'hour' },
      { max: 2592000, value: 86400, name: 'day' },
      { max: 31104000, value: 2592000, name: 'month' },
      { max: Infinity, value: 31104000, name: 'year' },
    ];
  
    for (const unit of units) {
      if (diff < unit.max) {
        const value = Math.floor(diff / unit.value);
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        return rtf.format(-value, unit.name as Intl.RelativeTimeFormatUnit);
      }
    }
  
    return 'just now';
  }

// Component for truncated text with tooltip
const TruncatedText = ({ text, className = "", maxLength = 30 }: { text: string; className?: string; maxLength?: number }) => {
    const shouldTruncate = text.length > maxLength;
    const truncatedText = shouldTruncate ? text.substring(0, maxLength) + '...' : text;

    if (!shouldTruncate) {
        return <span className={className}>{text}</span>;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={`${className} cursor-help`}>
                        {truncatedText}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="max-w-xs break-words">{text}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// Helper function to get user-friendly subject type names
const getSubjectTypeName = (subjectType: string | null) => {
    // Handle null or undefined subjectType
    if (!subjectType) return 'Unknown Item';

    const typeMap: Record<string, string> = {
        'App\\Models\\Patient': 'Patient Record',
        'App\\Models\\Practitioner': 'Practitioner Profile',
        'App\\Models\\Appointment': 'Appointment',
        'App\\Models\\User': 'User Account',
        'App\\Models\\Service': 'Service',
        'App\\Models\\Location': 'Location',
        'App\\Models\\Tenant\\Patient': 'Patient Record',
        'App\\Models\\Tenant\\Appointment': 'Appointment',
        'App\\Models\\Tenant\\Note': 'Clinical Note',
        'App\\Models\\OrganizationSetting': 'Organization Settings',
        'OrganizationSetting': 'Organization Settings',
    };

    // If not in map, try to format the class name nicely
    const rawName = typeMap[subjectType] || (subjectType.split('\\').pop() || 'Item');

    // Convert camelCase/PascalCase to spaced words
    return rawName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
};

// Helper function to get event display name
const getEventDisplayName = (event: string | null) => {
    if (!event) return 'Unknown';
    
    const eventMap: Record<string, string> = {
        'created': 'Created',
        'updated': 'Updated',
        'deleted': 'Deleted',
        'restored': 'Restored',
        'login': 'Login',
        'logout': 'Logout',
        'login_failed': 'Login Failed',
        'account_locked': 'Account Locked',
        'password_reset': 'Password Reset',
        'clock_in': 'Clock In',
        'clock_out': 'Clock Out',
        'session_started': 'Session Started',
        'session_ended': 'Session Ended',
        'document_uploaded': 'Document Uploaded',
        'document_accessed': 'Document Accessed',
        'document_requested': 'Document Requested',
        'document_request_fulfilled': 'Document Request Fulfilled',
        'patient_registered_public_portal': 'Patient Registered',
        'appointment_booked_public_portal': 'Appointment Booked',
        'patient_joined_tenant_public_portal': 'Patient Joined',
        'patient_tenant_switch': 'Patient Switched Tenant',
        'practitioner_tenant_switch': 'Practitioner Switched Tenant',
        'appointment_status_updated': 'Appointment Status Updated',
        'public_portal_registration_tracked': 'Portal Registration Tracked',
        'tenant_switch': 'Tenant Switch',
        'admin_tenant_login': 'Admin Tenant Login',
        'public_portal_login': 'Portal Login',
    };
    return eventMap[event] || event.charAt(0).toUpperCase() + event.slice(1);
};

// Helper function to get icon for subject type
const getSubjectIcon = (subjectType: string) => {
    const iconMap: Record<string, React.ReactNode> = {
        'Patient Record': <UserIcon className="h-4 w-4 text-blue-600" />,
        'Practitioner Profile': <UserIcon className="h-4 w-4 text-green-600" />,
        'Appointment': <CalendarIcon className="h-4 w-4 text-purple-600" />,
        'User Account': <UserIcon className="h-4 w-4 text-gray-600" />,
        'Service': <SettingsIcon className="h-4 w-4 text-orange-600" />,
        'Location': <SettingsIcon className="h-4 w-4 text-indigo-600" />,
        'Clinical Note': <FileTextIcon className="h-4 w-4 text-yellow-600" />,
        'Organization Settings': <SettingsIcon className="h-4 w-4 text-emerald-600" />,
    };
    const typeName = getSubjectTypeName(subjectType);
    return iconMap[typeName] || <FileTextIcon className="h-4 w-4 text-gray-500" />;
};

const columns: ColumnDef<ActivityLog>[] = [
    {
        accessorKey: 'created_at',
        header: 'When',
        cell: ({ row }) => {
          const createdAt = new Date(row.getValue('created_at'));
          return (
            <div className="text-sm">
              <div className="font-medium">{getRelativeTime(createdAt)}</div>
              <div className="text-gray-500 text-xs">
                {createdAt.toLocaleDateString()}
              </div>
            </div>
          );
        },
      },
    {
        accessorKey: 'event',
        header: 'Action',
        cell: ({ row }) => {
          const event = row.original.event;
          const eventColors = {
            'created': 'bg-green-100 text-green-800',
            'updated': 'bg-blue-100 text-blue-800',
            'deleted': 'bg-red-100 text-red-800',
            'restored': 'bg-purple-100 text-purple-800',
          };
          const colorClass = eventColors[event as keyof typeof eventColors] || 'bg-gray-100 text-gray-800';
          
          return (
            <Badge className={`${colorClass} border-0`}>
              {getEventDisplayName(event)}
            </Badge>
          );
        },
    },
    {
        accessorKey: 'subject_type',
        header: 'Item',
        cell: ({ row }) => {
          const subjectType = row.original.subject_type;
          const typeName = getSubjectTypeName(subjectType);
          const icon = getSubjectIcon(subjectType);
          
          return (
            <div className="flex items-center space-x-2">
              {icon}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">
                  <TruncatedText 
                    text={typeName}
                    className="font-medium text-sm"
                    maxLength={20}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  <TruncatedText 
                    text={`ID: ${row.original.subject_id}`}
                    className="text-xs text-gray-500"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>
          );
        },
    },
    {
        accessorKey: 'causer',
        header: 'Changed By',
        cell: ({ row }) => (
            <div className="text-sm">
                {row.original.causer ? (
                  <div>
                    <div className="font-medium">
                        <TruncatedText 
                            text={row.original.causer.name}
                            className="font-medium"
                            maxLength={20}
                        />
                    </div>
                    <div className="text-gray-500 text-xs">
                        <TruncatedText 
                            text={row.original.causer.email}
                            className="text-gray-500 text-xs"
                            maxLength={25}
                        />
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 italic">System</div>
                )}
            </div>
        ),
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <EyeIcon className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-6">
                        <DialogTitle className="sr-only">Activity Details</DialogTitle>
                        
                        {/* Clean Header Section */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-center mb-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                                    <RefreshCwIcon className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>
                            <h1 className="text-xl font-semibold text-gray-900 text-center">
                                {getSubjectTypeName(row.original.subject_type)} Updated
                            </h1>
                            <p className="text-gray-500 text-center text-sm">
                                Existing information was modified
                            </p>
                        </div>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        {/* Key Information Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* When */}
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-center mb-2">
                                    <ClockIcon className="h-4 w-4 text-blue-600 mr-1" />
                                    <span className="text-sm font-medium text-gray-600">When did this happen?</span>
                                </div>
                                <div className="text-lg font-semibold text-blue-600 mb-1">
                                    {getRelativeTime(new Date(row.original.created_at))}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {new Date(row.original.created_at).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </div>
                            </div>

                            {/* Who */}
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-center mb-2">
                                    <UserIcon className="h-4 w-4 text-green-600 mr-1" />
                                    <span className="text-sm font-medium text-gray-600">Who made this change?</span>
                                </div>
                                {row.original.causer ? (
                                    <>
                                        <div className="text-lg font-semibold text-green-600 mb-1 px-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="truncate cursor-help">
                                                            {row.original.causer.name}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{row.original.causer.name}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="text-xs text-gray-500 mb-2 px-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="truncate cursor-help" title={row.original.causer.email}>
                                                            {row.original.causer.email}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{row.original.causer.email}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="mt-2">
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                                Manual Action
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-lg font-semibold text-orange-600 mb-1">
                                            System
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Automatic process
                                        </div>
                                        <div className="mt-2">
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                                Automated Action
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* What */}
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-center mb-2">
                                    {getSubjectIcon(row.original.subject_type)}
                                    <span className="text-sm font-medium text-gray-600 ml-1">What was affected?</span>
                                </div>
                                <div className="text-lg font-semibold text-purple-600 mb-1">
                                    <TruncatedText 
                                        text={getSubjectTypeName(row.original.subject_type)}
                                        className="text-lg font-semibold text-purple-600"
                                        maxLength={20}
                                    />
                                </div>
                                <div className="text-xs text-gray-500 mb-2">
                                    <TruncatedText 
                                        text={`Item ID: ${row.original.subject_id}`}
                                        className="text-xs text-gray-500"
                                        maxLength={25}
                                    />
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 text-xs">
                                    Updated
                                </Badge>
                            </div>
                        </div>

                        {/* Detailed Changes Section */}
                        <div>
                            <div className="flex items-center mb-4">
                                <FileTextIcon className="h-4 w-4 text-gray-600 mr-2" />
                                <h3 className="font-semibold text-gray-900">Detailed Changes</h3>
                            </div>
                            <div className="text-sm text-gray-600 mb-4">
                                See exactly what information was modified
                            </div>
                            <div>
                                {renderChanges(row.original.properties)}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        ),
    },
];

export default function Index() {
    const { activityLogs, filters, isAdmin }: any = usePage<ActivityLogPageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);

    const table = useReactTable({
        data: activityLogs.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/activity-logs', { search, perPage }, { preserveState: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Activity History" />
            <Card className="shadow-none border-none m-6">
                <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Activity History</h1>
                            {!isAdmin && (
                                <p className="text-sm text-gray-500 mt-1">Showing your activity logs only</p>
                            )}
                            {isAdmin && (
                                <p className="text-sm text-gray-500 mt-1">Showing all activity logs (Admin View)</p>
                            )}
                        </div>
                    </div>

                    <FilterBar
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={(value) => {
                            setPerPage(value);
                            router.get('/activity-logs', { search, perPage: value }, { preserveState: true });
                        }}
                    />

                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <th key={header.id} className="border-b px-4 py-2 text-left">
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="border-b px-4 py-2">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={activityLogs.current_page}
                    lastPage={activityLogs.last_page}
                    total={activityLogs.total}
                    url="/activity-logs"
                />
                </CardContent>
            </Card>
        </AppLayout>
    );
}
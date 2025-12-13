import { useRef, useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { withAppLayout } from '@/utils/layout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Pencil, Trash2, Mail, CheckCircle, AlertCircle, MoreHorizontal, Users, Send, Eye, FileEdit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

type Patient = {
    id: number;
    user_id?: number | null;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    email: string;
    phone_number?: string;
    health_number?: string;
    date_of_birth?: string;
    invitation_status?: string; // From tenant_patients pivot
};

interface PatientIndexProps {
    // For standalone page usage
    standalone?: boolean;
    // For settings component usage
    patients?: any;
    invitations?: any;
    filters?: any;
    onCreateClick?: () => void;
    onEditClick?: (patient: Patient) => void;
}

function Index({
    standalone = true,
    patients: propPatients,
    invitations: propInvitations,
    filters: propFilters,
    onCreateClick,
    onEditClick
}: PatientIndexProps) {
    const { items, filters, flash, auth }: any = usePage().props;
    const userPerms: string[] = auth?.user?.permissions || [];

    // Use props if provided (settings mode) or page props (standalone mode)
    const patientsData = standalone ? items : propPatients;
    const filtersData = standalone ? filters : propFilters;

    // Initialize state BEFORE any conditional returns (React Rules of Hooks)
    const [search, setSearch] = useState(filtersData?.search || '');
    const [perPage, setPerPage] = useState(filtersData?.perPage || 10);

    // Fetch data using partial reload when items is null (standalone mode only)
    useEffect(() => {
        if (standalone && !items) {
            router.reload({
                only: ['items'],
                data: filters,
                onError: (errors) => {
                    console.error('Failed to load patients:', errors);
                    toast.error('Failed to load patients', {
                        description: 'Please refresh the page to try again.',
                    });
                },
            });
        }
    }, []);

    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const deletePatientId = useRef<number | null>(null);

    // Handle flash messages with toast notifications
    useEffect(() => {
        if (flash?.success) {
            toast.success('Success', {
                description: flash.success
            });
        }
        if (flash?.error) {
            toast.error('Error', {
                description: flash.error
            });
        }
        if (flash?.info) {
            toast.info('Information', {
                description: flash.info
            });
        }
    }, [flash]);

    const sendInvite = (patientId: number) => {
        router.post(route('patients.invite', patientId), {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Invitation Sent', {
                    description: 'Patient invitation has been sent successfully!'
                });
            },
            onError: (error) => {
                console.error('Error sending invitation:', error);
                toast.error('Invitation Failed', {
                    description: 'Failed to send patient invitation. Please try again.'
                });
            }
        });
    };

    const handleCreateClick = () => {
        if (onCreateClick) {
            onCreateClick();
        } else {
            router.get(route('intake.create'), { from: 'patients' });
        }
    };

    const handleEditClick = (patient: Patient) => {
        if (onEditClick) {
            onEditClick(patient);
        } else {
            // For patients, we don't allow editing - show view instead
            router.get(route('patients.show', patient.id));
        }
    };

    const columns: ColumnDef<Patient>[] = [
        { 
            accessorKey: 'profile', 
            header: 'Profile', 
            cell: ({ row }) => {
                const patient = row.original;
                const initials = `${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}`;
                
                return (
                    <Avatar className="h-10 w-10">
                        <AvatarImage
                            src="/placeholder-avatar.jpg"
                            alt={`${patient.first_name} ${patient.last_name}`}
                        />
                        <AvatarFallback className="bg-gray-200 text-gray-600">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                );
            }
        },
        {
            accessorKey: 'name',
            header: 'Name',
            cell: ({ row }) => {
                const patient = row.original;
                const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
                return fullName || '-';
            }
        },
        { 
            accessorKey: 'health_number', 
            header: 'Health Number', 
            cell: ({ row }) => row.getValue('health_number') || '-'
        },
        { 
            accessorKey: 'email', 
            header: 'Email', 
            cell: ({ row }) => row.getValue('email') || '-'
        },
        { 
            accessorKey: 'phone_number', 
            header: 'Phone', 
            cell: ({ row }) => row.getValue('phone_number') || '-'
        },
        { 
            accessorKey: 'invitation_status', 
            header: 'Status', 
            cell: ({ row }) => {
                const patient = row.original;
                const invitationStatus = patient.invitation_status;
                const hasUserAccount = patient.user_id !== null;
                
                switch (invitationStatus) {
                    case 'ACCEPTED':
                        return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                            </span>
                        );
                    case 'INVITED':
                        return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {hasUserAccount ? 'Invitation Sent' : 'Registration Sent'}
                            </span>
                        );
                    case 'PENDING_INVITATION':
                        return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Pending Invitation
                            </span>
                        );
                    case 'DECLINED':
                        return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Declined
                            </span>
                        );
                    default:
                        return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Unknown
                            </span>
                        );
                }
            }
        },
        {
            id: 'actions',
            header: standalone ? 'Actions' : 'Manage',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => router.get(route('patients.show', row.original.id))}
                        title="View patient details"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {userPerms.includes('view-patient') && (
                            <DropdownMenuItem onClick={() => handleEditClick(row.original)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {standalone ? 'View Patient' : 'View Details'}
                            </DropdownMenuItem>
                        )}
                        
                        {userPerms.includes('update-patient') && (
                            <DropdownMenuItem 
                                onClick={() => router.get(route('patients.edit-medical-history', row.original.id))}
                                className="text-primary"
                            >
                                <FileEdit className="mr-2 h-4 w-4" />
                                Edit Medical History
                            </DropdownMenuItem>
                        )}
                        
                        {userPerms.includes('update-patient') && row.original.invitation_status !== 'ACCEPTED' && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    onClick={() => sendInvite(row.original.id)}
                                    className="text-blue-600"
                                >
                                    <Mail className="mr-2 h-4 w-4" />
                                    {row.original.invitation_status === 'INVITED' 
                                        ? 'Resend Invite'
                                        : row.original.user_id 
                                            ? 'Send Invite' 
                                            : 'Send Registration'
                                    }
                                </DropdownMenuItem>
                            </>
                        )}
         
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
            ),
        },
    ];

    const table = useReactTable({
        data: patientsData?.data || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get(route('patients.index'), { 
            search, 
            perPage
        }, { 
            preserveState: true,
            preserveScroll: true 
        });
    };
    const handlePerPageChange = (e: any) => {
        setPerPage(e);
        router.get(route('patients.index'), { 
            search, 
            perPage: e
        }, { 
            preserveState: true,
            preserveScroll: true 
        });
    };

    const confirmDelete = () => {
        if (deletePatientId.current) {
            router.delete(route('patients.destroy', deletePatientId.current));
            deletePatientId.current = null;
            setDeleteModalOpen(false);
        }
    };

    const content = (
        <div className="space-y-6">
            <Card className={standalone ? '' : 'border-none shadow-none'}>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Patients
                        <div className="flex items-center space-x-2">
                            {userPerms.includes('add-patient') && (
                                <Button
                                    onClick={handleCreateClick}
                                    variant="outline"
                                    className="h-10 sm:h-[44px] bg-white text-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/10"
                                >
                                    Add Patient
                                </Button>
                            )}
                            {standalone && (
                                <Link href="/patient-invitations">
                                    <Button variant="outline" size="sm">
                                        <Send className="h-4 w-4 mr-2" />
                                        View Invitations
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="card-content-mobile">
                    {standalone ? (
                        <div className="space-y-4">
                            <FilterBar 
                                search={search} 
                                onSearchChange={setSearch} 
                                onSearch={handleSearch} 
                                perPage={perPage} 
                                onPerPageChange={handlePerPageChange} 
                            />
                                    
                                    
                                    
                                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[700px]">
                                            <thead className="bg-gray-50 border-b border-gray-300">
                                                {table.getHeaderGroups().map((headerGroup) => (
                                                    <tr key={headerGroup.id}>
                                                        {headerGroup.headers.map((header) => (
                                                            <th key={header.id} className="px-6 py-4 md:px-6 md:py-4 text-left text-sm font-semibold text-gray-900 tracking-wide">
                                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </thead>
                                            <tbody className="divide-y divide-gray-300 bg-white">
                                                {table.getRowModel().rows.length > 0 ? (
                                                    table.getRowModel().rows.map((row) => (
                                                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                                            {row.getVisibleCells().map((cell) => (
                                                                <td key={cell.id} className="px-6 py-4 md:px-6 md:py-4 text-sm text-gray-900">
                                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={columns.length} className="px-6 py-8 text-center">
                                                            <div className="text-gray-500">
                                                                <div className="mx-auto w-12 h-12 mb-3">
                                                                    <svg
                                                                        className="w-full h-full text-gray-300"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            strokeWidth={1}
                                                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                                                        />
                                                                    </svg>
                                                                </div>
                                                                <h3 className="text-base font-medium text-gray-900 mb-2">No patients found</h3>
                                                                <p className="text-sm text-gray-500">Get started by adding your first patient using the button above.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        </div>
                                    </div>
                                    
                                    {patientsData && (
                                        <Pagination 
                                            currentPage={patientsData.current_page} 
                                            lastPage={patientsData.last_page} 
                                            total={patientsData.total} 
                                            url={route('patients.index')}
                                        />
                                    )}
                                </div>
                    ) : (
                        <div className="space-y-4">
                            <FilterBar 
                                search={search} 
                                onSearchChange={setSearch} 
                                onSearch={handleSearch} 
                                perPage={perPage} 
                                onPerPageChange={handlePerPageChange} 
                            />
                            
                            
                            
                            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[700px]">
                                    <thead className="bg-gray-50 border-b border-gray-300">
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <tr key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => (
                                                    <th key={header.id} className="px-6 py-4 md:px-6 md:py-4 text-left text-sm font-semibold text-gray-900 tracking-wide">
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody className="divide-y divide-gray-300 bg-white">
                                        {table.getRowModel().rows.length > 0 ? (
                                            table.getRowModel().rows.map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                                    {row.getVisibleCells().map((cell) => (
                                                        <td key={cell.id} className="px-6 py-4 md:px-6 md:py-4 text-sm text-gray-900">
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={columns.length} className="px-6 py-8 text-center">
                                                    <div className="text-gray-500">
                                                        <div className="mx-auto w-12 h-12 mb-3">
                                                            <svg
                                                                className="w-full h-full text-gray-300"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={1}
                                                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                                                />
                                                            </svg>
                                                        </div>
                                                        <h3 className="text-base font-medium text-gray-900 mb-2">No patients found</h3>
                                                        <p className="text-sm text-gray-500">Get started by adding your first patient using the button above.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                            
                            {patientsData && (
                                <Pagination 
                                    currentPage={patientsData.current_page} 
                                    lastPage={patientsData.last_page} 
                                    total={patientsData.total} 
                                    url={route(standalone ? 'patients.index' : 'settings.index')}
                                />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Modal - only for standalone mode */}
            {standalone && (
                <Dialog open={isDeleteModalOpen} onOpenChange={setDeleteModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Delete</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to delete this patient? This action cannot be undone.</p>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={confirmDelete}>
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );

    // If standalone, wrap in layout container (but layout itself is handled by withAppLayout)
    if (standalone) {
        return (
            <>
                <Head title="Patients" />
                <div className="p-6 md:p-6 page-content-mobile">
                    {content}
                </div>
            </>
        );
    }

    return content;
}

export default withAppLayout(Index, {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Patients', href: '/patients' },
    ]
});
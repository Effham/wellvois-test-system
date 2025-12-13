import React, { useRef, useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { withAppLayout } from '@/utils/layout';
import { Head, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Pencil, Trash2, Mail, CheckCircle, AlertCircle, MoreHorizontal, Users, Send } from 'lucide-react';
import { toast } from 'sonner';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InvitationsTable from './InvitationsTable';

type Practitioner = {
    id: number;
    user_id?: number | null;
    first_name: string;
    last_name: string;
    title?: string;
    phone_number?: string;
    gender?: string;
    pronoun?: string;
    email: string;
    short_bio?: string;
    full_bio?: string;
    profile_picture_path?: string;
    profile_picture_s3_key?: string;
    profile_picture_url?: string; // Generated proxy URL
    invitation_status?: string; // From tenant_practitioners pivot
};

interface PractitionerIndexProps {
    // For standalone page usage
    standalone?: boolean;
    // For settings component usage
    practitioners?: any;
    invitations?: any;
    filters?: any;
    onCreateClick?: () => void;
    onEditClick?: (practitioner: Practitioner) => void;
}

function Index({
    standalone = true,
    practitioners: propPractitioners,
    invitations: propInvitations,
    filters: propFilters,
    onCreateClick,
    onEditClick
}: PractitionerIndexProps) {
    const { items, filters, flash, auth }: any = usePage().props;
    const userPerms: string[] = auth?.user?.permissions || [];

    // Use props if provided (settings mode) or page props (standalone mode)
    const practitionersData = standalone ? items : propPractitioners;
    const invitationsData = standalone ? (usePage().props as any).invitations : propInvitations;
    const filtersData = standalone ? filters : propFilters;

    
    const [search, setSearch] = useState(filtersData?.search || '');
    const [perPage, setPerPage] = useState(filtersData?.perPage || 10);
    const [activeTab, setActiveTab] = useState<string>(
        filtersData?.tab || 'practitioners'
    );

    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const deletePractitionerId = useRef<number | null>(null);

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

    const sendInvite = (practitionerId: number) => {
        router.post(route('practitioners.invite', practitionerId), {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                // Success message is already handled by flash message from backend
                // No need to show duplicate toast
            },
            onError: (error) => {
                console.error('Error sending invitation:', error);
                toast.error('Invitation Failed', {
                    description: 'Failed to send practitioner invitation. Please try again.'
                });
            }
        });
    };

    const handleCreateClick = () => {
        if (onCreateClick) {
            onCreateClick();
        } else {
            router.get(route('practitioners.create'));
        }
    };

    const handleEditClick = (practitioner: Practitioner) => {
        if (onEditClick) {
            onEditClick(practitioner);
        } else {
            router.get(route('practitioners.edit', practitioner.id));
        }
    };

    const columns: ColumnDef<Practitioner>[] = [
        { 
            accessorKey: 'profile', 
            header: 'Profile', 
            cell: ({ row }) => {
                const practitioner = row.original;
                const initials = `${practitioner.first_name?.[0] || ''}${practitioner.last_name?.[0] || ''}`;

                const profileUrl = practitioner.profile_picture_url || practitioner.profile_picture_path || "/placeholder-avatar.jpg";

                return (
                    <Avatar className="h-10 w-10">
                        <AvatarImage
                            src={profileUrl}
                            alt={`${practitioner.first_name} ${practitioner.last_name}`}
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
                const practitioner = row.original;
                const fullName = `${practitioner.first_name || ''} ${practitioner.last_name || ''}`.trim();
                return fullName || '-';
            }
        },
        { 
            accessorKey: 'title', 
            header: 'Title', 
            cell: ({ row }) => row.getValue('title') || '-'
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
                const practitioner = row.original;
                const invitationStatus = practitioner.invitation_status;
                const hasUserAccount = practitioner.user_id !== null;
                
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {userPerms.includes('update-practitioner') && (
                            <DropdownMenuItem onClick={() => handleEditClick(row.original)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {standalone ? 'Edit Practitioner' : 'Manage Locations & Availability'}
                            </DropdownMenuItem>
                        )}
                        
                        {userPerms.includes('update-practitioner') && row.original.invitation_status !== 'ACCEPTED' && (
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
                        )}
                        
                        {/* {standalone && userPerms.includes('delete-practitioner') && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    onClick={() => {
                                        deletePractitionerId.current = row.original.id;
                                        setDeleteModalOpen(true);
                                    }}
                                    className="text-red-600"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Practitioner
                                </DropdownMenuItem>
                            </>
                        )} */}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const table = useReactTable({
        data: practitionersData?.data || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get(route('practitioners.index'), { 
            search, 
            perPage,
            tab: activeTab 
        }, { 
            preserveState: true,
            preserveScroll: true 
        });
    };
    const handlePerPageChange = (e: any) => {
        setPerPage(e);
        router.get(route('practitioners.index'), { 
            search, 
            perPage: e,
            tab: activeTab
        }, { 
            preserveState: true,
            preserveScroll: true 
        });
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        router.get(route('practitioners.index'), { 
            tab: value, 
            search, 
            perPage 
        }, {
            preserveState: true,
            preserveScroll: true
        });
    };
    const confirmDelete = () => {
        if (deletePractitionerId.current) {
            router.delete(route('practitioners.destroy', deletePractitionerId.current));
            deletePractitionerId.current = null;
            setDeleteModalOpen(false);
        }
    };

    const content = (
        <div className="space-y-6">
            <Card className={standalone ? 'card' : 'border-none shadow-none card'}>
                <CardHeader className="card-header-mobile">
                    <CardTitle className="flex items-center justify-between">
                        Practitioners
                        {userPerms.includes('add-practitioner') && (
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => router.visit(route('practitioners.invite-form'))}
                                    variant="default"
                                    className="h-10 sm:h-[44px] bg-sidebar-accent text-white hover:bg-sidebar-accent/90"
                                >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Invite Practitioner
                                </Button>
                                {/* <Button 
                                    onClick={handleCreateClick}
                                    variant="outline"
                                    className="bg-white text-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/10"
                                >
                                    Add Practitioner
                                </Button> */}
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="card-content-mobile">
                    {standalone ? (
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <div className="pb-4">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="practitioners" className="flex items-center space-x-2">
                                        <Users className="h-4 w-4" />
                                        <span>Practitioners</span>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="invitations" 
                                        className="flex items-center space-x-2"
                                    >
                                        <Send className="h-4 w-4" />
                                        <span>Invitations</span>
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="practitioners" className="mt-0">
                                <div className="space-y-4">
                                    <FilterBar 
                                        search={search} 
                                        onSearchChange={setSearch} 
                                        onSearch={handleSearch} 
                                        perPage={perPage} 
                                        onPerPageChange={handlePerPageChange} 
                                    />
                                    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                                        <table className="w-full min-w-[800px]">
                                            <thead className="bg-gray-50 border-b border-gray-300">
                                                {table.getHeaderGroups().map((headerGroup) => (
                                                    <tr key={headerGroup.id}>
                                                        {headerGroup.headers.map((header) => (
                                                            <th
                                                                key={header.id}
                                                                className="px-6 py-4 text-left text-sm font-semibold text-gray-900 tracking-wide whitespace-nowrap"
                                                            >
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
                                                                <td
                                                                    key={cell.id}
                                                                    className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap"
                                                                >
                                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={columns.length} className="px-6 py-8 text-center">
                                                            <div className="text-gray-500">
                                                                <div className="mx-auto w-12 h-12 mb-3">{/* SVG icon */}</div>
                                                                <h3 className="text-base font-medium text-gray-900 mb-2">
                                                                    No practitioners found
                                                                </h3>
                                                                <p className="text-sm text-gray-500">
                                                                    Get started by adding your first practitioner using the button above.
                                                                </p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {practitionersData && (
                                        <Pagination
                                            currentPage={practitionersData.current_page}
                                            lastPage={practitionersData.last_page}
                                            total={practitionersData.total}
                                            url={route('practitioners.index')}
                                        />
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="invitations" className="mt-0">
                                {invitationsData ? (
                                    <InvitationsTable 
                                        invitations={invitationsData} 
                                        filters={filtersData}
                                        standalone={true}
                                    />
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500">No invitations data available.</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <div className="space-y-4">
                            <FilterBar 
                                search={search} 
                                onSearchChange={setSearch} 
                                onSearch={handleSearch} 
                                perPage={perPage} 
                                onPerPageChange={handlePerPageChange} 
                            />
                            <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                                <table className="w-full min-w-[800px]">
                                    <thead className="bg-gray-50 border-b border-gray-300">
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <tr key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => (
                                                    <th
                                                        key={header.id}
                                                        className="px-6 py-4 text-left text-sm font-semibold text-gray-900 tracking-wide whitespace-nowrap"
                                                    >
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
                                                        <td
                                                            key={cell.id}
                                                            className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap"
                                                        >
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={columns.length} className="px-6 py-8 text-center">
                                                    <div className="text-gray-500">
                                                        <div className="mx-auto w-12 h-12 mb-3">{/* SVG icon */}</div>
                                                        <h3 className="text-base font-medium text-gray-900 mb-2">
                                                            No practitioners found
                                                        </h3>
                                                        <p className="text-sm text-gray-500">
                                                            Get started by adding your first practitioner using the button above.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {practitionersData && (
                                <Pagination
                                    currentPage={practitionersData.current_page}
                                    lastPage={practitionersData.last_page}
                                    total={practitionersData.total}
                                    url={route('practitioners.list')}
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
                        <p>Are you sure you want to delete this practitioner? This action cannot be undone.</p>
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
                <Head title="Practitioners" />
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
        { title: 'Practitioners', href: '/practitioners' },
    ]
});
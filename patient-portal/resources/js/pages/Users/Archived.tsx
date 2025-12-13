import { useState, useEffect } from 'react';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RotateCcw, Trash2, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

type User = {
    id: string;
    name: string;
    email: string;
    role_name: string;
    role_id: number;
    deleted_at: string;
};

type UsersPageProps = {
    users: {
        data: User[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
    };
    filters: {
        search?: string;
        perPage?: number;
    };

    flash?: {
        success?: string;
        error?: string;
    };
};

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Users', href: '/users' },
    { title: 'Archived Users', href: '/users-archived' },
];

export default function Archived() {
    const { users, filters, flash } = usePage<UsersPageProps>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(!!flash?.error);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Define columns for archived users
    const columns: ColumnDef<User>[] = [
        {
            accessorKey: 'name',
            header: 'Name',
            cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
        },
        {
            accessorKey: 'email',
            header: 'Email',
        },
        {
            accessorKey: 'role_name',
            header: 'Role',
            cell: ({ row }) => {
                const roleName = row.getValue('role_name') as string;
                return (
                    <Badge variant={roleName === 'No Role' ? 'secondary' : 'default'}>
                        {roleName}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'deleted_at',
            header: 'Archived On',
            cell: ({ row }) => {
                const deletedAt = new Date(row.getValue('deleted_at'));
                return <div className="text-gray-500">{deletedAt.toLocaleDateString()}</div>;
            },
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSelectedUser(user);
                                setShowRestoreModal(true);
                            }}
                            title="Restore user"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                        {/* Commented out permanent delete for now */}
                        {/* <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteModal(true);
                            }}
                            title="Permanently delete user"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button> */}
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: users.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/users-archived', { search, perPage }, { preserveState: true });
    };

    const handleRestoreUser = () => {
        if (selectedUser) {
            router.post(route('users.restore', selectedUser.id), {}, {
                preserveState: false,
                onSuccess: () => {
                    setShowRestoreModal(false);
                    setSelectedUser(null);
                }
            });
        }
    };

    const handleDeleteUser = () => {
        if (selectedUser) {
            router.delete(route('users.force-delete', selectedUser.id), {
                preserveState: false,
                onSuccess: () => {
                    setShowDeleteModal(false);
                    setSelectedUser(null);
                }
            });
        }
    };

        return (
        <>
            <Head title="Archived Users" />
            <AppLayout breadcrumbs={breadcrumbs}>
                <Card className="shadow-none border-none">
                    <CardHeader className="px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.get('/users')}
                                    className="text-gray-600 hover:text-gray-800"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Users
                                </Button>
                                <div>
                                    <CardTitle className="text-xl font-semibold">Archived Users</CardTitle>
                                    <p className="text-sm text-gray-600 mt-1">
                                        View and manage archived users. You can restore them to make them active again.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="px-6">
                        {/* Filter Bar */}
                        <div className="mb-6">
                            <FilterBar
                                onSearch={handleSearch}
                                search={search}
                                setSearch={setSearch}
                                perPage={perPage}
                                setPerPage={setPerPage}
                                showPerPage={true}
                                searchPlaceholder="Search archived users..."
                            />
                        </div>

                        {/* Users Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id} className="bg-gray-50 border-b">
                                            {headerGroup.headers.map((header) => (
                                                <th key={header.id} className="px-4 py-3 text-left text-sm font-medium text-gray-700">
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
                                <tbody className="divide-y divide-gray-200">
                                    {table.getRowModel().rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            {row.getVisibleCells().map((cell) => (
                                                <td key={cell.id} className="px-4 py-3 text-sm text-gray-900">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Empty State */}
                            {users.data.length === 0 && (
                                <div className="px-6 py-8 text-center">
                                    <div className="text-gray-500 mb-4">
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
                                        <h3 className="text-base font-medium text-gray-900 mb-2">No archived users found</h3>
                                        <p className="text-sm text-gray-500">
                                            {search ? 'Try adjusting your search terms.' : 'You have no archived users at the moment.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {users.total > 0 && (
                            <div className="mt-6">
                                <Pagination
                                    currentPage={users.current_page}
                                    lastPage={users.last_page}
                                    perPage={users.per_page}
                                    total={users.total}
                                    from={users.from}
                                    to={users.to}
                                    onPageChange={(page) => {
                                        router.get('/users-archived', {
                                            search,
                                            perPage,
                                            page,
                                        }, { preserveState: true });
                                    }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Restore Modal */}
                <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-green-600" />
                                Restore User
                            </DialogTitle>
                            <DialogDescription>
                                Are you sure you want to restore "{selectedUser?.name}"? This will make the user active again and available for login.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowRestoreModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleRestoreUser} className="bg-green-600 hover:bg-green-700">
                                Restore User
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Permanent Delete Modal - Commented out for now */}
                {/* <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                                Permanently Delete User
                            </DialogTitle>
                            <DialogDescription className="text-red-600">
                                Are you sure you want to permanently delete "{selectedUser?.name}"? This action cannot be undone and will remove all associated data.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteUser}>
                                Permanently Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog> */}

                {/* Error Modal */}
                <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                                Error
                            </DialogTitle>
                            <DialogDescription>
                                {flash?.error}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => setShowErrorModal(false)}>
                                OK
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Toaster />
            </AppLayout>
        </>
    );
}

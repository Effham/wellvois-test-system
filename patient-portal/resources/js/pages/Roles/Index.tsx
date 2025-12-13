import { useState } from 'react';
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Roles', href: '/roles' },
];

export default function Index() {
    const { roles, filters, auth }: { roles: any; filters: any; auth: any } = usePage().props;
    const [search, setSearch] = useState(filters.search || '');
    const [perPage, setPerPage] = useState(filters.perPage || 10);

    const permissions = auth?.user?.permissions || [];

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<any | null>(null);

    const table = useReactTable({
        data: roles.data,
        columns: [
            {
                accessorKey: 'name',
                header: 'Role',
                cell: ({ row }) => (
                    <div className="flex items-center space-x-2">
                        <div className="font-medium">{row.original.name}</div>
                        {row.original.is_protected ? (
                            <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                                Protected
                            </span>
                        ) : <span className="inline-block rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                                Unprotected
                            </span> }
                    </div>
                ),
            },
            {
                accessorKey: 'permissions',
                header: 'Permissions',
                cell: ({ row }) => {
                    const permissionCount = row.original.permissions?.length || 0;
                    return (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                            {permissionCount} permission{permissionCount !== 1 ? 's' : ''}
                        </Badge>
                    );
                },
            },
            {
                accessorKey: 'users_count',
                header: 'Users',
                cell: ({ row }) => {
                    const userCount = row.original.users_count || 0;
                    return (
                        <div className="flex justify-center">
                            <Badge 
                                variant="secondary" 
                                className={userCount > 0 ? 'bg-green-100 text-green-800 border-0' : 'bg-gray-100 text-gray-600 border-0'}
                            >
                                {userCount} user{userCount !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                    );
                },
            },
            {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }) => (
                    <div className="space-x-2">
                        {permissions.includes('update-roles') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => router.get(route('roles.edit', row.original.id))}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {permissions.includes('delete-roles') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-600 hover:text-red-800"
                                onClick={() => {
                                    setSelectedRole(row.original);
                                    setDeleteDialogOpen(true);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ),
            },
        ],
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get(route('roles.index'), { search, perPage }, { preserveState: true });
    };


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles" />

            <Card className="shadow-none border-none m-3 sm:m-6">
                <CardContent className="space-y-4 p-3 sm:p-6">
                    <PageHeader 
                        title="Roles" 
                        breadcrumbs={breadcrumbs} 
                        createRoute={permissions.includes('add-roles') ? route('roles.create') : undefined} 
                        createLabel="New Role" 
                    />

                    <FilterBar
                        search={search}
                        onSearchChange={setSearch}
                        onSearch={handleSearch}
                        perPage={perPage}
                        onPerPageChange={(value) => {
                            setPerPage(value);
                            router.get(route('roles.index'), { search, perPage: value }, { preserveState: true });
                        }}
                    />

                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm min-w-[600px]">
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

                    <Pagination currentPage={roles.current_page} lastPage={roles.last_page} total={roles.total} url="/roles" />

                    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {selectedRole?.is_protected ? 'Cannot Delete Role' : 
                                     selectedRole?.users_count > 0 ? 'Cannot Delete Role' : 
                                     'Confirm Deletion'}
                                </DialogTitle>
                            </DialogHeader>
                            
                            {selectedRole?.is_protected ? (
                                <div className="space-y-3">
                                    <p className="text-red-600 font-medium">
                                        The role "{selectedRole?.name}" is a protected system role and cannot be deleted.
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Protected roles (Admin, Practitioner, Patient) are essential for the system and cannot be removed.
                                    </p>
                                </div>
                            ) : selectedRole?.users_count > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-red-600 font-medium">
                                        Cannot delete role "{selectedRole?.name}" because it is assigned to {selectedRole?.users_count} user(s).
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Please reassign the users to other roles before deleting this role.
                                    </p>
                                </div>
                            ) : (
                                <p>Are you sure you want to delete the role "{selectedRole?.name}"? This action cannot be undone.</p>
                            )}
                            
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                    {selectedRole?.is_protected || selectedRole?.users_count > 0 ? 'Close' : 'Cancel'}
                                </Button>
                                {!selectedRole?.is_protected && selectedRole?.users_count === 0 && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (selectedRole?.id) {
                                                router.delete(route('roles.destroy', selectedRole.id));
                                                setDeleteDialogOpen(false);
                                            }
                                        }}
                                    >
                                        Delete
                                    </Button>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        </AppLayout>
    );
}

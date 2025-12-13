# 📘 PMS Module Creation Guide

This document is the official reference for developers adding new modules to the Practice Management System (PMS). Follow each step exactly to maintain system consistency.

---

## 🧱 Step 1: Create the Model

```bash
php artisan make:model {ModuleName}
```
- Location: `app/Models/`
- Convention: PascalCase (e.g., `Invoice`, `DocumentUpload`)

---

## 🗃️ Step 2: Create the Migration

```bash
php artisan make:migration create_{module_plural}_table
```
- **Tenant module:** Place in `database/migrations/tenant/`
- **Master module:** Place in `database/migrations/`

Use snake_case for the table name and define all columns provided by the user.

---

## 🧩 Step 3: Define Routes and Controller

### 1. Add resource route in `routes/tenant.php`:
```php
Route::resource('{module-slug}', {ModuleName}Controller::class);
```

### 2. Generate controller:
```bash
php artisan make:controller {ModuleName}Controller --resource
```

### 3. Add permission middleware in constructor:
```php
public function __construct()
{
    $this->middleware('permission:view-{module}')->only(['index', 'show']);
    $this->middleware('permission:add-{module}')->only(['create', 'store']);
    $this->middleware('permission:update-{module}')->only(['edit', 'update']);
    $this->middleware('permission:delete-{module}')->only('destroy');
}
```

### ✅ Controller Template:
```php
namespace App\Http\Controllers;

use App\Models\{ModuleName};
use Illuminate\Http\Request;
use Inertia\Inertia;

class {ModuleName}Controller extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-{module}')->only(['index', 'show']);
        $this->middleware('permission:add-{module}')->only(['create', 'store']);
        $this->middleware('permission:update-{module}')->only(['edit', 'update']);
        $this->middleware('permission:delete-{module}')->only('destroy');
    }

    public function index()
    {
        $items = {ModuleName}::paginate(10);
        return Inertia::render('{ModuleName}/Index', compact('items'));
    }

    public function create()
    {
        return Inertia::render('{ModuleName}/Create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // validate columns here
        ]);

        {ModuleName}::create($data);
        return redirect()->route('{module}.index')->with('success', 'Created successfully.');
    }

    public function edit({ModuleName} ${module})
    {
        return Inertia::render('{ModuleName}/Create', compact('{module}'));
    }

    public function update(Request $request, {ModuleName} ${module})
    {
        $data = $request->validate([
            // validate columns here
        ]);

        ${module}->update($data);
        return redirect()->route('{module}.index')->with('success', 'Updated successfully.');
    }

    public function destroy({ModuleName} ${module})
    {
        ${module}->delete();
        return redirect()->route('{module}.index')->with('success', 'Deleted successfully.');
    }
}
```

---

## 🔐 Step 4: Seed Permissions

Add the following to all of these files:
- `PermissionSeeder.php`
- `RolesAndPermissionSeeder.php`
- `RolesAndPermissionSeederNewTenant.php`

```php
'view-{module}',
'add-{module}',
'update-{module}',
'delete-{module}',
```

Ensure they are created and assigned to Admin:
```php
foreach ($perms as $perm) {
    Permission::firstOrCreate(['name' => $perm]);
}

$adminRole->syncPermissions($perms);
```

---

## 🖼️ Step 5: Frontend Structure (Inertia + React)

Create folder:
```
resources/js/Pages/{ModuleName}/
```
Inside it, add:
- `index.tsx`
- `create.tsx`

> Use the full reference templates from this guide to copy-paste the exact format for each file.

---

## 🧭 Step 6: Add Sidebar Entry

### 🔹 For Tenant Modules
In `AppSidebar.tsx`, update `tenantNavItems`:
```ts
{
    title: '{ModuleTitle}',
    href: '/{module-slug}',
    icon: SomeLucideIcon,
    permission: 'view-{module-slug}',
}
```

### 🔸 For Central Modules
Update `centralNavItems` similarly.

Use icons from `lucide-react` such as `Users`, `Lock`, `FileText`, etc.

---

## ✅ Summary
The developer only needs to provide:
- `Module Name`
- `Columns`

> Everything else follows this blueprint exactly.


## 📄 Sample index.tsx Template
```tsx
import FilterBar from '@/components/general/FilterBar';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

type Patient = {
    id: number;
    date_of_birth: string;
    is_active: boolean;
    notes: string;
};

export const columns: ColumnDef<Patient>[] = [
    { accessorKey: 'date_of_birth', header: 'Date of Birth' },
    { accessorKey: 'is_active', header: 'Active', cell: ({ row }) => (row.getValue('is_active') ? 'Yes' : 'No') },
    { accessorKey: 'notes', header: 'Notes' },
    {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
            <div className="space-x-2">
                <Button size="icon" variant="ghost" onClick={() => router.get(`/patients/${row.original.id}/edit`)}>
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-600 hover:text-red-800"
                    onClick={() => router.delete(`/patients/${row.original.id}`)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        ),
    },
];

export default function Index() {
    const { items, filters }: any = usePage().props;
    const [search, setSearch] = useState(filters?.search || '');
    const [perPage, setPerPage] = useState(filters?.perPage || 10);

    const table = useReactTable({
        data: items.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = () => {
        router.get('/patients', { search, perPage }, { preserveState: true });
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Patients', href: '/patients' },
            ]}
        >
            <Head title="Patients" />
            <div className="space-y-4 p-6">
                <PageHeader title="Patients" createRoute="/patients/create" createLabel="New Patient" />
                <FilterBar search={search} onSearchChange={setSearch} onSearch={handleSearch} perPage={perPage} onPerPageChange={setPerPage} />
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th key={header.id} className="border-b px-6 py-3 text-left">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="border-b px-6 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination currentPage={items.current_page} lastPage={items.last_page} total={items.total} url="/patients" />
            </div>
        </AppLayout>
    );
}

```

## 📄 Sample create.tsx Template
```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, useForm, router } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Create User',
        href: '/users/create',
    },
];

type CreateProps = {
    roles: { id: number; name: string }[];
    user?: any;
    userRole?: string;
};

export default function Create({ roles, user, userRole }: CreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        password_confirmation: '',
        role: userRole ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (user) {
            router.put(route('users.update', user.id), data);
        } else {
            post(route('users.store'));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create User" />
            <div className="flex flex-col gap-4 p-4">
                <h2 className="text-2xl font-bold">Create New User</h2>
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Enter Name"
                            />
                            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="Enter Email"
                            />
                            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Role *</Label>
                            <select
                                id="role"
                                className="w-full border rounded px-3 py-2"
                                value={data.role}
                                onChange={(e) => setData('role', e.target.value)}
                            >
                                <option value="" disabled>Select a role</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.name}>
                                        {role.name}
                                    </option>
                                ))}
                            </select>
                            {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password *</Label>
                            <Input
                                id="password"
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="Enter Password"
                            />
                            {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password_confirmation">Confirm Password *</Label>
                            <Input
                                id="password_confirmation"
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                placeholder="Confirm Password"
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : user ? 'Update User' : 'Create User'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
```
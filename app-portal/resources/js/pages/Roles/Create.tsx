import React from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Checkbox }  from '@/components/ui/checkbox';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Roles',     href: '/roles' },
  { title: 'New Role',  href: '/roles/create' },
];

interface Role {
  id: number;
  name: string;
  permissions: { name: string }[];
}
export default function Create({
  groupedPermissions,
  role,
  assignedPermissions,
}: {
  groupedPermissions: Record<string, { id: number; name: string }[]>;
  role?: Role;
  assignedPermissions?: string[];
}) {
  const { props } = usePage();
  const permissions = (props.auth?.user?.permissions || []) as string[];
  const { data, setData, post, put, processing, errors } = useForm({
    name: role?.name || '',
    permissions: assignedPermissions || [],
  });

  const togglePermission = (perm: string) => {
    setData('permissions', data.permissions.includes(perm)
      ? data.permissions.filter(p => p !== perm)
      : [...data.permissions, perm]
    );
  };

  // Select all permissions in a group
  const selectAllGroup = (group: string) => {
    const allNames = groupedPermissions[group].map(p => p.name);
    const merged = Array.from(new Set([...data.permissions, ...allNames]));
    setData('permissions', merged);
  };

  // Unselect all permissions in a group
  const unselectAllGroup = (group: string) => {
    const toRemove = groupedPermissions[group].map(p => p.name);
    setData('permissions', data.permissions.filter(name => !toRemove.includes(name)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role) {
      put(route('roles.update', role.id));
    } else {
      post(route('roles.store'));
    }
  };

  // Format group names for better display
  const formatGroupName = (group: string): string => {
    // Handle special cases for better readability
    const specialCases: Record<string, string> = {
      // Practitioner Personal Calendar
      'practitioner-personal-calendar': 'Practitioner: Personal Calendar',

      // New Menu Access
      'new-menu': 'New Menu Access',
      'new-appointment': 'New: Appointment',
      'new-intake': 'New: Intake',
      'new-note': 'New: Note',

      // Special Features
      'activity-logs': 'Activity Logs',
      'intake-queue': 'Intake Queue (Public Portal)',
      'website': 'Website Settings',
      'calendar': 'Calendar (Admin/Staff)',
      'attendance': 'Attendance Logs',
      'settings': 'Settings Access',
    };

    if (specialCases[group]) {
      return specialCases[group];
    }

    // Default formatting: capitalize and replace hyphens with spaces
    return group.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Define category organization
  const categoryGroups: Record<string, string[]> = {
    'Core Modules': ['patient', 'users', 'roles', 'appointment', 'note', 'intake', 'practitioner', 'tenants'],
    'Settings': ['organization', 'location', 'services', 'integration', 'website', 'settings'],
    'Special Features': ['calendar', 'attendance', 'wallet', 'waitlist', 'intake-queue', 'activity-logs', 'practitioner-personal-calendar'],
    'New Menu Access': ['new-menu', 'new-appointment', 'new-intake', 'new-note'],
  };

  // Global select/deselect functions
  const selectAll = () => {
    const allPerms = Object.values(groupedPermissions).flat().map((p: any) => p.name);
    setData('permissions', allPerms);
  };

  const deselectAll = () => {
    setData('permissions', []);
  };

  // Format permission names for better display
  const formatPermissionName = (permissionName: string, group: string): string => {
    // Remove the action prefix and group suffix, then format
    const actions = ['view', 'add', 'update'];
    console.log('Formatting permission:', permissionName, 'from group:', group);
    let displayName = permissionName;

    // Find and remove the action prefix
    const action = actions.find(a => permissionName.startsWith(a + '-'));
    if (action) {
      displayName = permissionName.replace(action + '-', '');
      const actionDisplay = action.charAt(0).toUpperCase() + action.slice(1);

      // Default formatting
      const resourceName = displayName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      return `${actionDisplay} ${resourceName}`;
    }

    // Fallback formatting
    return permissionName.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };


  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="New Role" />

      <Card className="shadow-none border-none m-3 sm:m-6">
        <CardContent className="space-y-4 p-3 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold">Create Role</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={data.name}
                onChange={e => setData('name', e.target.value)}
                placeholder="e.g. Admin, Therapist"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <Label>Assign Permissions</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {data.permissions.length} / {Object.values(groupedPermissions).flat().length} selected
                  </span>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={deselectAll}>
                      Deselect All
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(categoryGroups).map(([category, groups]) => {
                  // Filter groups that exist in groupedPermissions
                  const existingGroups = groups.filter(g => groupedPermissions[g]);
                  if (existingGroups.length === 0) return null;

                  return (
                    <div key={category}>
                      <h2 className="text-lg font-bold mb-3 text-gray-700 border-b pb-2">
                        {category}
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {existingGroups.map(group => {
                          console.log('Rendering group:', group, 'with permissions:', groupedPermissions[group]);
                          const perms = groupedPermissions[group];
                          return (
                            <div key={group} className="bg-white shadow rounded-lg p-3 sm:p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                <h3 className="font-semibold text-sm sm:text-base">
                                  {formatGroupName(group)}
                                </h3>
                                <div className="flex gap-2">
                                  <Button type="button" variant="link" size="sm" onClick={() => selectAllGroup(group)} className="text-xs p-0 h-auto">
                                    Assign All
                                  </Button>
                                  <Button type="button" variant="link" size="sm" onClick={() => unselectAllGroup(group)} className="text-xs p-0 h-auto">
                                    Unassign All
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                                {perms.map((p: any) => (
                                  <label key={p.id} className="inline-flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                    <Checkbox
                                      checked={data.permissions.includes(p.name)}
                                      onCheckedChange={() => togglePermission(p.name)}
                                    />
                                    <h1></h1>
                                    <span className="text-xs sm:text-sm">{formatPermissionName(p.name, group)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {errors.permissions && <p className="text-sm text-red-500">{errors.permissions}</p>}
            </div>

            {permissions.includes('add-roles') && !role && (
              <Button type="submit" disabled={processing} size="save" className="w-full sm:w-auto">
                {processing ? 'Saving...' : 'Save Role'}
              </Button>
            )}
            {permissions.includes('update-roles') && role && (
              <Button type="submit" disabled={processing} size="save" className="w-full sm:w-auto">
                {processing ? 'Saving...' : 'Update Role'}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
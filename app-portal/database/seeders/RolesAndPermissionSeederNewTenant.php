<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionSeederNewTenant extends Seeder
{
    public function run()
    {
        try {
            Log::info('Starting RolesAndPermissionSeederNewTenant for tenant: '.tenant('id'));

            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

            $perms = [
                // Roles
                'view-roles',
                'add-roles',
                'update-roles',
                'delete-roles',

                // Users
                'view-users',
                'add-users',
                'update-users',
                'delete-users',

                // Patients
                'view-patient',
                'add-patient',
                'update-patient',
                'delete-patient',

                // Practitioners
                'view-practitioner',
                'add-practitioner',
                'update-practitioner',
                'delete-practitioner',

                // Services
                'view-services',
                'add-services',
                'update-services',
                'delete-services',

                // Locations
                'view-location',
                'add-location',
                'update-location',
                'delete-location',

                // Appointments
                'view-appointment',
                'add-appointment',
                'update-appointment',
                'delete-appointment',

                // Intakes
                'view-intake',
                'add-intake',
                'update-intake',
                'delete-intake',

                // Notes
                'view-note',
                'add-note',
                'update-note',
                'delete-note',

                // Organization Settings
                'view-organization',
                'add-organization',
                'update-organization',
                'delete-organization',

                // Integrations
                'view-integration',
                'add-integration',
                'update-integration',
                'delete-integration',

                // Activity Logs
                'view-activity-logs',

                // Calendar (Admin/Staff access)
                'view-calendar',
                'add-calendar',
                'update-calendar',
                'delete-calendar',

                // Practitioner Personal Calendar
                'view-practitioner-personal-calendar',

                // Attendance
                'view-attendance',
                'add-attendance',
                'update-attendance',
                'delete-attendance',

                // Wallet
                'view-wallet',

                // Intake Queue (Public Portal Registrations)
                'view-intake-queue',
                'add-intake-queue',
                'update-intake-queue',
                'delete-intake-queue',

                // Settings
                'view-settings',

                // New Menu Access
                'view-new-menu',
                'add-new-appointment',
                'add-new-intake',

                // Waitlist
                'view-waitlist',
                'add-waitlist',
                'update-waitlist',
                'delete-waitlist',
                // Invoices
                'view-invoices',
                'add-invoices',
                'update-invoices',
                'delete-invoices',

                // Consents
                'manage-consents',

                // Policies and Consents
                'view-policies-consents',
            ];

            // Create permissions with error handling
            Log::info('Creating permissions...');
            foreach ($perms as $perm) {
                try {
                    $permission = Permission::firstOrCreate(['name' => $perm]);
                    Log::debug("Permission created/found: {$perm} (ID: {$permission->id})");
                } catch (\Exception $e) {
                    Log::error("Failed to create permission '{$perm}': ".$e->getMessage());
                    throw $e;
                }
            }

            // Create Admin role with specific permissions (excluding practitioner-only permissions)
            Log::info('Creating Admin role...');
            try {
                $adminRole = Role::firstOrCreate(['name' => 'Admin'], ['is_protected' => true]);
                Log::info("Admin role created/found (ID: {$adminRole->id})");

                $adminPermissions = [
                    // Roles
                    'view-roles',
                    'add-roles',
                    'update-roles',
                    'delete-roles',

                    // Users
                    'view-users',
                    'add-users',
                    'update-users',
                    'delete-users',

                    // Patients
                    'view-patient',
                    'add-patient',
                    'update-patient',
                    'delete-patient',

                    // Practitioners
                    'view-practitioner',
                    'add-practitioner',
                    'update-practitioner',
                    'delete-practitioner',

                    // Services
                    'view-services',
                    'add-services',
                    'update-services',
                    'delete-services',

                    // Locations
                    'view-location',
                    'add-location',
                    'update-location',
                    'delete-location',

                    // Appointments
                    'view-appointment',
                    'add-appointment',
                    'update-appointment',
                    'delete-appointment',

                    // Intakes
                    'view-intake',
                    'add-intake',
                    'update-intake',
                    'delete-intake',

                    // Notes
                    'view-note',
                    'add-note',
                    'update-note',
                    'delete-note',

                    // Organization Settings
                    'view-organization',
                    'add-organization',
                    'update-organization',
                    'delete-organization',

                    // Integrations
                    'view-integration',
                    'add-integration',
                    'update-integration',
                    'delete-integration',

                    // Activity Logs
                    'view-activity-logs',

                    // Calendar (Admin/Staff access)
                    'view-calendar',
                    'add-calendar',
                    'update-calendar',
                    'delete-calendar',

                    // Attendance
                    'view-attendance',
                    'add-attendance',
                    'update-attendance',
                    'delete-attendance',

                    // Settings
                    'view-settings',

                    // New Menu Access
                    'view-new-menu',
                    'add-new-appointment',
                    'add-new-intake',

                    // Waitlist
                    'view-waitlist',
                    'add-waitlist',
                    'update-waitlist',
                    'delete-waitlist',

                    // Invoices
                    'view-invoices',
                    'add-invoices',
                    'update-invoices',
                    'delete-invoices',

                    // Wallet
                    'view-wallet',

                    // Intake Queue (Public Portal Registrations)
                    'view-intake-queue',
                    'add-intake-queue',
                    'update-intake-queue',
                    'delete-intake-queue',

                    // Policies and Consents
                    'view-policies-consents',
                    'manage-consents',

                    // Note: Admins do NOT get view-practitioner-personal-calendar - this is only for practitioners
                ];

                $adminRole->syncPermissions($adminPermissions);
                Log::info('Admin role permissions synced. Permission count: '.count($adminPermissions));
                Log::debug('Admin permissions: '.implode(', ', $adminPermissions));
            } catch (\Exception $e) {
                Log::error('Failed to create/sync Admin role: '.$e->getMessage());
                throw $e;
            }

            // Create Practitioner role with specific permissions
            Log::info('Creating Practitioner role...');
            try {
                $practitionerRole = Role::firstOrCreate(['name' => 'Practitioner'], ['is_protected' => true]);
                Log::info("Practitioner role created/found (ID: {$practitionerRole->id})");

                $practitionerPermissions = [
                    'view-patient',
                    'add-patient',
                    'update-patient',
                    'view-services',
                    'view-practitioner-personal-calendar', // Updated permission name for Practitioner role
                    // Note: Practitioners do NOT get view-settings permission - only Admins can access Settings
                ];

                $practitionerRole->syncPermissions($practitionerPermissions);
                Log::info('Practitioner role permissions synced. Permission count: '.count($practitionerPermissions));
                Log::debug('Practitioner permissions: '.implode(', ', $practitionerPermissions));
            } catch (\Exception $e) {
                Log::error('Failed to create/sync Practitioner role: '.$e->getMessage());
                throw $e;
            }

            // Create Patient role with limited permissions
            Log::info('Creating Patient role...');
            try {
                $patientRole = Role::firstOrCreate(['name' => 'Patient'], ['is_protected' => true]);
                Log::info("Patient role created/found (ID: {$patientRole->id})");

                $patientPermissions = [
                    // Patients don't get calendar access - this is only for practitioners
                ];

                $patientRole->syncPermissions($patientPermissions);
                Log::info('Patient role permissions synced. Permission count: '.count($patientPermissions));
            } catch (\Exception $e) {
                Log::error('Failed to create/sync Patient role: '.$e->getMessage());
                throw $e;
            }

            // Verify roles were created successfully
            $adminRoleCheck = Role::where('name', 'Admin')->first();
            $practitionerRoleCheck = Role::where('name', 'Practitioner')->first();
            $patientRoleCheck = Role::where('name', 'Patient')->first();

            Log::info('Role verification:');
            Log::info('Admin role exists: '.($adminRoleCheck ? "Yes (ID: {$adminRoleCheck->id})" : 'No'));
            Log::info('Practitioner role exists: '.($practitionerRoleCheck ? "Yes (ID: {$practitionerRoleCheck->id})" : 'No'));
            Log::info('Patient role exists: '.($patientRoleCheck ? "Yes (ID: {$patientRoleCheck->id})" : 'No'));

            if ($adminRoleCheck) {
                Log::info('Admin role has '.$adminRoleCheck->permissions()->count().' permissions');
            }
            if ($practitionerRoleCheck) {
                Log::info('Practitioner role has '.$practitionerRoleCheck->permissions()->count().' permissions');
            }
            if ($patientRoleCheck) {
                Log::info('Patient role has '.$patientRoleCheck->permissions()->count().' permissions');
            }

            // Assign roles to existing users
            Log::info('Starting user role assignment...');
            $this->assignRolesToUsers($adminRoleCheck, $practitionerRoleCheck, $patientRoleCheck);

            Log::info('RolesAndPermissionSeederNewTenant completed successfully for tenant: '.tenant('id'));

        } catch (\Exception $e) {
            Log::error('RolesAndPermissionSeederNewTenant failed for tenant: '.tenant('id').' - Error: '.$e->getMessage());
            Log::error('Stack trace: '.$e->getTraceAsString());
            throw $e;
        }
    }

    /**
     * Assign roles to existing users based on their context
     */
    private function assignRolesToUsers($adminRole, $practitionerRole, $patientRole)
    {
        try {
            $users = User::all();
            Log::info('Found '.$users->count().' users to process for role assignment');

            // Find the first user (by ID) to assign Admin role
            $firstUser = User::orderBy('id', 'asc')->first();

            if (! $firstUser) {
                Log::warning('No users found in tenant');

                return;
            }

            Log::info("First user identified: {$firstUser->name} (ID: {$firstUser->id}, Email: {$firstUser->email})");

            foreach ($users as $user) {
                try {
                    Log::info("Processing user: {$user->name} (ID: {$user->id}, Email: {$user->email})");

                    // Log current roles
                    $currentRoles = $user->getRoleNames()->toArray();
                    Log::info("User {$user->name} current roles: ".(empty($currentRoles) ? 'None' : implode(', ', $currentRoles)));

                    // Check if user already has any roles
                    if ($user->hasAnyRole(['Admin', 'Practitioner', 'Patient'])) {
                        Log::info("User {$user->name} already has role(s): ".implode(', ', $currentRoles));

                        continue;
                    }

                    // Only assign Admin role to the first user of the tenant
                    if ($user->id === $firstUser->id) {
                        if ($adminRole) {
                            $user->assignRole($adminRole);
                            Log::info("✅ Assigned Admin role to first user: {$user->name}");
                        } else {
                            Log::warning("❌ Could not assign Admin role to {$user->name} - role not found");
                        }
                    } else {
                        // Other users remain without roles - they can be assigned manually later
                        Log::info("👤 User {$user->name} left without role (not the first user)");
                    }

                    // Verify the role assignment
                    $user->refresh();
                    $newRoles = $user->getRoleNames()->toArray();
                    Log::info("User {$user->name} roles after processing: ".(empty($newRoles) ? 'None' : implode(', ', $newRoles)));

                } catch (\Exception $e) {
                    Log::error("Failed to process user {$user->name} (ID: {$user->id}): ".$e->getMessage());
                }
            }

            // Verify final role assignments
            $this->verifyRoleAssignments();

        } catch (\Exception $e) {
            Log::error('Error in assignRolesToUsers: '.$e->getMessage());
            throw $e;
        }
    }

    /**
     * Verify that role assignments were successful
     */
    private function verifyRoleAssignments()
    {
        try {
            Log::info('=== ROLE ASSIGNMENT VERIFICATION ===');

            $usersWithAdmin = User::role('Admin')->get();
            $usersWithPractitioner = User::role('Practitioner')->get();
            $usersWithPatient = User::role('Patient')->get();
            $usersWithoutRoles = User::doesntHave('roles')->get();

            Log::info('Users with Admin role: '.$usersWithAdmin->count());
            foreach ($usersWithAdmin as $user) {
                Log::info("  - {$user->name} ({$user->email})");
            }

            Log::info('Users with Practitioner role: '.$usersWithPractitioner->count());
            foreach ($usersWithPractitioner as $user) {
                Log::info("  - {$user->name} ({$user->email})");
            }

            Log::info('Users with Patient role: '.$usersWithPatient->count());
            foreach ($usersWithPatient as $user) {
                Log::info("  - {$user->name} ({$user->email})");
            }

            Log::info('Users without any roles: '.$usersWithoutRoles->count());
            foreach ($usersWithoutRoles as $user) {
                Log::warning("  ⚠️  {$user->name} ({$user->email}) has NO ROLES");
            }

            Log::info('=== END VERIFICATION ===');

        } catch (\Exception $e) {
            Log::error('Error in verifyRoleAssignments: '.$e->getMessage());
        }
    }
}

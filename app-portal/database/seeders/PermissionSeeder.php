<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionSeeder extends Seeder
{
    public function run()
    {
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

            // Intake Queue (Public Portal Registrations)
            'view-intake-queue',
            'add-intake-queue',
            'update-intake-queue',
            'delete-intake-queue',

            // Website Settings
            'view-website',
            'update-website',

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

            // Practitioner Personal Calendar
            'view-practitioner-personal-calendar',

            // Settings
            'view-settings',

            // New Menu Access
            'view-new-menu',
            'add-new-appointment',
            'add-new-intake',
            'add-new-note',

            // Waitlist
            'view-waitlist',
            'add-waitlist',
            'update-waitlist',
            'delete-waitlist',

            // Wallet
            'view-wallet',

            // Policies and Consents
            'view-policies-consents',
        ];

        Permission::whereNotIn('name', $perms)->delete();

        foreach ($perms as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }
    }
}

<?php

namespace Database\Seeders\Tenant;

use App\Models\Tenant\Consent;
use App\Models\Tenant\ConsentVersion;
use Illuminate\Database\Seeder;

class StaffPermissionsConsentSeeder extends Seeder
{
    public function run(): void
    {
        // Check if staff permissions consent already exists
        $existingConsent = Consent::where('key', 'staff_permissions')->first();

        if ($existingConsent) {
            // Update existing consent's is_required field
            $existingConsent->update(['is_required' => true]);
            $this->command->info('Staff permissions consent already exists, updated is_required to true');

            return;
        }

        // Create staff permissions consent
        $consent = Consent::create([
            'key' => 'staff_permissions',
            'title' => 'Staff Permissions Consent',
            'entity_type' => 'PRACTITIONER',
            'is_required' => true,
        ]);

        // Create active version
        ConsentVersion::create([
            'consent_id' => $consent->id,
            'consent_body' => [
                'heading' => 'Staff Permissions Consent',
                'description' => 'Required for platform access and staff management',
                'permissions' => [
                    'invitation_permission' => 'The staff can invite you to join as a practitioner',
                    'location_assignment_permission' => 'The staff can assign you locations and time slots',
                    'location_modification_permission' => 'The staff can change your locations and time slots',
                ],
            ],
            'status' => 'ACTIVE',
        ]);

        $this->command->info('Staff permissions consent created successfully');
    }
}

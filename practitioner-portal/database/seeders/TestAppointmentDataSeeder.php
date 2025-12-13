<?php

namespace Database\Seeders;

use App\Models\Practitioner;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TestAppointmentDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $currentTenantId = tenant('id');

        // Create test services
        $services = [
            [
                'name' => 'Individual Therapy',
                'category' => 'Individual',
                'description' => 'One-on-one therapy sessions',
                'delivery_modes' => ['in-person', 'virtual'],

                'default_price' => 120.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
            [
                'name' => 'Couples Therapy',
                'category' => 'Couple',
                'description' => 'Therapy sessions for couples',
                'delivery_modes' => ['in-person', 'virtual'],

                'default_price' => 150.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
            [
                'name' => 'Family Therapy',
                'category' => 'Family',
                'description' => 'Family counseling sessions',
                'delivery_modes' => ['in-person'],

                'default_price' => 140.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
        ];

        foreach ($services as $serviceData) {
            Service::firstOrCreate(
                ['name' => $serviceData['name']],
                $serviceData
            );
        }

        // Create test practitioners
        $practitioners = [
            [
                'first_name' => 'Dr. Sarah',
                'last_name' => 'Johnson',
                'title' => 'Clinical Psychologist',
                'email' => 'sarah.johnson@example.com',
                'phone_number' => '+1 (555) 123-4567',
                'is_active' => true,
            ],
            [
                'first_name' => 'Dr. Michael',
                'last_name' => 'Chen',
                'title' => 'Licensed Therapist',
                'email' => 'michael.chen@example.com',
                'phone_number' => '+1 (555) 987-6543',
                'is_active' => true,
            ],
        ];

        foreach ($practitioners as $practitionerData) {
            $practitioner = Practitioner::firstOrCreate(
                ['email' => $practitionerData['email']],
                $practitionerData
            );

            // Link practitioner to current tenant if not already linked
            if (! $practitioner->tenants()->where('tenant_id', $currentTenantId)->exists()) {
                $practitioner->tenants()->attach($currentTenantId, [
                    'can_edit_professional_details' => true,
                    'can_edit_basic_info' => true,
                ]);
            }
        }

        // Create practitioner-service relationships
        $practitioner1 = Practitioner::where('email', 'sarah.johnson@example.com')->first();
        $practitioner2 = Practitioner::where('email', 'michael.chen@example.com')->first();

        $individualTherapy = Service::where('name', 'Individual Therapy')->first();
        $couplesTherapy = Service::where('name', 'Couples Therapy')->first();
        $familyTherapy = Service::where('name', 'Family Therapy')->first();

        if ($practitioner1 && $individualTherapy) {
            DB::table('practitioner_services')->updateOrInsert([
                'practitioner_id' => $practitioner1->id,
                'service_id' => $individualTherapy->id,
            ], [
                'is_offered' => true,
                'custom_price' => null,
                'custom_duration_minutes' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($practitioner1 && $couplesTherapy) {
            DB::table('practitioner_services')->updateOrInsert([
                'practitioner_id' => $practitioner1->id,
                'service_id' => $couplesTherapy->id,
            ], [
                'is_offered' => true,
                'custom_price' => 160.00,
                'custom_duration_minutes' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($practitioner2 && $individualTherapy) {
            DB::table('practitioner_services')->updateOrInsert([
                'practitioner_id' => $practitioner2->id,
                'service_id' => $individualTherapy->id,
            ], [
                'is_offered' => true,
                'custom_price' => null,
                'custom_duration_minutes' => 75,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($practitioner2 && $familyTherapy) {
            DB::table('practitioner_services')->updateOrInsert([
                'practitioner_id' => $practitioner2->id,
                'service_id' => $familyTherapy->id,
            ], [
                'is_offered' => true,
                'custom_price' => null,
                'custom_duration_minutes' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->command->info('Test appointment data seeded successfully!');
        $this->command->info('Services created: '.Service::count());
        $this->command->info('Practitioners linked to tenant: '.
            Practitioner::whereHas('tenants', function ($q) use ($currentTenantId) {
                $q->where('tenant_id', $currentTenantId);
            })->count()
        );
        $this->command->info('Practitioner-Service relationships: '.DB::table('practitioner_services')->count());
    }
}

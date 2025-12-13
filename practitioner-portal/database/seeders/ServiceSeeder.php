<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $services = [
            [
                'name' => 'Assessment',
                'category' => 'Therapy',
                'description' => 'Comprehensive patient assessment and evaluation',
                'delivery_modes' => ['In-Person', 'Virtual'],

                'default_price' => 180.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
            [
                'name' => 'Consultation',
                'category' => 'Medical',
                'description' => 'Medical consultation and advice',
                'delivery_modes' => ['In-Person', 'Virtual'],

                'default_price' => 120.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
            [
                'name' => 'Follow-up',
                'category' => 'Therapy',
                'description' => 'Follow-up session to track progress',
                'delivery_modes' => ['In-Person', 'Virtual'],

                'default_price' => 150.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
            [
                'name' => 'Treatment Session',
                'category' => 'Physical Therapy',
                'description' => 'Active treatment and intervention session',
                'delivery_modes' => ['In-Person'],

                'default_price' => 160.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
            [
                'name' => 'Group Session',
                'category' => 'Therapy',
                'description' => 'Group therapy session',
                'delivery_modes' => ['In-Person', 'Virtual'],

                'default_price' => 80.00,
                'currency' => 'CAD',
                'is_active' => true,
            ],
        ];

        foreach ($services as $serviceData) {
            Service::updateOrCreate(
                ['name' => $serviceData['name'], 'category' => $serviceData['category']],
                $serviceData
            );
        }

        $this->command->info('Services seeded successfully!');
    }
}

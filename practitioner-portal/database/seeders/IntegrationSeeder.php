<?php

namespace Database\Seeders;

use App\Models\Integration;
use Illuminate\Database\Seeder;

class IntegrationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $defaultIntegrations = Integration::getDefaultIntegrations();

        foreach ($defaultIntegrations as $integration) {
            Integration::updateOrCreate(
                ['provider' => $integration['provider']],
                $integration
            );
        }
    }
}

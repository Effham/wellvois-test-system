<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AccountingSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Seeds default accounting settings into organization_settings table
     */
    public function run(): void
    {
        $settings = [
            ['key' => 'accounting_invoice_prefix', 'value' => 'INV'],
            ['key' => 'accounting_currency', 'value' => 'CAD'],
            ['key' => 'accounting_tax_enabled', 'value' => '1'],
            ['key' => 'accounting_tax_rate', 'value' => '13.00'],
            ['key' => 'accounting_tax_name', 'value' => 'GST'],
        ];

        foreach ($settings as $setting) {
            DB::table('organization_settings')->updateOrInsert(
                ['key' => $setting['key']],
                array_merge($setting, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }
    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration updates existing entity_consents records that reference
     * the old central Patient model (App\Models\Patient) to reference the
     * new tenant-level Patient model (App\Models\Tenant\Patient).
     */
    public function up(): void
    {
        // Update entity_consents records to use tenant Patient model
        DB::table('entity_consents')
            ->where('consentable_type', 'App\\Models\\Patient')
            ->update(['consentable_type' => 'App\\Models\\Tenant\\Patient']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to central Patient model
        DB::table('entity_consents')
            ->where('consentable_type', 'App\\Models\\Tenant\\Patient')
            ->update(['consentable_type' => 'App\\Models\\Patient']);
    }
};

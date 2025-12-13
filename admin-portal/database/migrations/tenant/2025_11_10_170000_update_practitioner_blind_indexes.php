<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Delete old blind indexes with PractitionerRecord and Tenant\Practitioner types
        // They will be regenerated automatically with the correct Practitioner type
        DB::table('blind_indexes')
            ->whereIn('indexable_type', [
                'App\\Models\\Tenant\\PractitionerRecord',
                'App\\Models\\Tenant\\Practitioner',
            ])
            ->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Cannot reverse - blind indexes will be regenerated on access
        // This is safe because CipherSweet regenerates them automatically
    }
};

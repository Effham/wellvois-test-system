<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Remove soft deletes from entity_consents table
        Schema::table('entity_consents', function (Blueprint $table) {
            // Check if the deleted_at column exists before trying to drop it (to prevent errors if the previous migration wasn't run)
            if (Schema::hasColumn('entity_consents', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });

        // 2. Add soft deletes to consents table
        Schema::table('consents', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverse 2: Remove soft deletes from consents table
        Schema::table('consents', function (Blueprint $table) {
            if (Schema::hasColumn('consents', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });

        // Reverse 1: Add soft deletes back to entity_consents table (to fully undo this migration)
        Schema::table('entity_consents', function (Blueprint $table) {
            $table->softDeletes();
        });
    }
};

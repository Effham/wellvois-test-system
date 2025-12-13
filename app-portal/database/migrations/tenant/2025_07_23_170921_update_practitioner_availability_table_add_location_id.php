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
        Schema::table('practitioner_availability', function (Blueprint $table) {
            // Remove the location_assignments column as we'll use a separate table for that
            if (Schema::hasColumn('practitioner_availability', 'location_assignments')) {
                $table->dropColumn('location_assignments');
            }

            // Add location_id column if it doesn't exist
            if (! Schema::hasColumn('practitioner_availability', 'location_id')) {
                $table->unsignedBigInteger('location_id')->after('practitioner_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioner_availability', function (Blueprint $table) {
            // Drop location_id column if it exists
            if (Schema::hasColumn('practitioner_availability', 'location_id')) {
                $table->dropColumn('location_id');
            }

            // Add back location_assignments column if it doesn't exist
            if (! Schema::hasColumn('practitioner_availability', 'location_assignments')) {
                $table->json('location_assignments')->nullable();
            }
        });
    }
};

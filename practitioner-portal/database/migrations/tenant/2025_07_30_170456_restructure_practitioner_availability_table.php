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
            // Drop existing unique constraint from previous migration
            try {
                $table->dropUnique('unique_practitioner_location_availability');
            } catch (\Exception $e) {
                // Constraint might not exist, continue
            }

            // Drop the JSON availability_schedule column
            if (Schema::hasColumn('practitioner_availability', 'availability_schedule')) {
                $table->dropColumn('availability_schedule');
            }

            // Drop the is_active column
            if (Schema::hasColumn('practitioner_availability', 'is_active')) {
                $table->dropColumn('is_active');
            }

            // Add new columns for individual time slots
            $table->string('day')->after('location_id'); // Monday, Tuesday, etc.
            $table->time('start_time')->after('day');
            $table->time('end_time')->after('start_time');

            // Add unique constraint to prevent duplicate time slots
            $table->unique(['location_id', 'practitioner_id', 'day', 'start_time', 'end_time'], 'unique_availability_time_slot');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioner_availability', function (Blueprint $table) {
            // Drop the unique constraint
            $table->dropUnique('unique_availability_time_slot');

            // Drop the new columns
            $table->dropColumn(['day', 'start_time', 'end_time']);

            // Add back the JSON availability_schedule column
            $table->json('availability_schedule')->nullable()->after('location_id');

            // Add back the is_active column
            $table->boolean('is_active')->default(true)->after('availability_schedule');

            // Add back the previous unique constraint
            $table->unique(['practitioner_id', 'location_id'], 'unique_practitioner_location_availability');
        });
    }
};

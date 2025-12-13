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
        Schema::table('practitioners', function (Blueprint $table) {
            // Profile picture path
            $table->string('profile_picture_path')->nullable();

            // Form-specific fields for separate submissions
            $table->json('availability_schedule')->nullable(); // weekly schedule
            $table->json('location_assignments')->nullable(); // which locations they're assigned to
            $table->json('service_pricing')->nullable(); // pricing information for services
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioners', function (Blueprint $table) {
            $table->dropColumn([
                'profile_picture_path',
                'availability_schedule',
                'location_assignments',
                'service_pricing',
            ]);
        });
    }
};

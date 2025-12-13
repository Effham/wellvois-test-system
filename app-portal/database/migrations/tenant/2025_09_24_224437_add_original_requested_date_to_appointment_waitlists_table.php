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
        Schema::table('appointment_waitlists', function (Blueprint $table) {
            // Add field to store the original date/time that the user requested
            // This allows us to match waitlist entries not just by day/time preferences
            // but also by the specific date they originally wanted
            $table->string('original_requested_date')->nullable()->after('preferred_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointment_waitlists', function (Blueprint $table) {
            $table->dropColumn('original_requested_date');
        });
    }
};

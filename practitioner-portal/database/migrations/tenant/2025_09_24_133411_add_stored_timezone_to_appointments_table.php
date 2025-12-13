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
        Schema::table('appointments', function (Blueprint $table) {
            // Add a field to track which timezone the appointment times are stored in
            $table->string('stored_timezone')->default('America/Toronto')->after('end_time');

            // Add a field to track if this appointment needs timezone migration
            $table->boolean('needs_timezone_migration')->default(true)->after('stored_timezone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['stored_timezone', 'needs_timezone_migration']);
        });
    }
};

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
            // Drop the foreign key + column first
            $table->dropForeign(['patient_id']);
            $table->dropColumn('patient_id');
        });

        Schema::table('appointment_waitlists', function (Blueprint $table) {
            // Recreate as plain unsigned big integer
            $table->unsignedBigInteger('patient_id')->after('id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointment_waitlists', function (Blueprint $table) {
            $table->dropColumn('patient_id');
        });

        Schema::table('appointment_waitlists', function (Blueprint $table) {
            $table->foreignId('patient_id')->constrained()->onDelete('cascade')->after('id');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::connection('central')->dropIfExists('appointments');
        Schema::connection('central')->dropIfExists('family_medical_histories');
        Schema::connection('central')->dropIfExists('known_allergies');
        Schema::connection('central')->dropIfExists('loccations');
        Schema::connection('central')->dropIfExists('location_practitioners');
        Schema::connection('central')->dropIfExists('notes');
        Schema::connection('central')->dropIfExists('patient_medical_histories');
        Schema::connection('central')->dropIfExists('services');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Cannot restore dropped tables without data loss
        // Manual restoration required if needed
    }
};

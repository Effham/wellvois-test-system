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
        Schema::create('tenant_patients', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id'); // Reference to tenants.id
            $table->unsignedBigInteger('patient_id'); // Reference to patients.id in central database
            $table->timestamps();

            // Ensure unique combination per tenant per patient
            $table->unique(['tenant_id', 'patient_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenant_patients');
    }
};

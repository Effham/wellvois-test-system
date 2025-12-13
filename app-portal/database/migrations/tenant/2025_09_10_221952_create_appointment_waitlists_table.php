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
        Schema::create('appointment_waitlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            $table->string('service_type');
            $table->string('service_name');
            $table->foreignId('service_id')->constrained()->onDelete('cascade');
            $table->foreignId('location_id')->nullable()->constrained()->onDelete('cascade');
            $table->enum('mode', ['in-person', 'virtual', 'hybrid']);
            $table->json('practitioner_ids')->nullable(); // Store array of practitioner IDs
            $table->enum('preferred_day', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'any']);
            $table->enum('preferred_time', ['morning', 'afternoon', 'evening', 'any']);
            $table->enum('status', ['active', 'contacted', 'completed', 'cancelled'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamp('contacted_at')->nullable();
            $table->timestamps();

            // Indexes for better query performance
            $table->index(['patient_id', 'status']);
            $table->index(['service_id', 'status']);
            $table->index(['preferred_day', 'preferred_time']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointment_waitlists');
    }
};

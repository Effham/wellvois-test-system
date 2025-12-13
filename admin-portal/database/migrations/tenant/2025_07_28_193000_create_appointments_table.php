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
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();

            // Patient Information (from Patient model - central)
            $table->unsignedBigInteger('patient_id')->nullable();

            // Client Information (duplicated for form convenience)
            $table->string('first_name');
            $table->string('last_name');
            $table->string('preferred_name')->nullable();
            $table->string('phone_number');
            $table->string('email_address');
            $table->string('gender_pronouns')->nullable();
            $table->string('client_type');
            $table->date('date_of_birth');
            $table->string('emergency_contact_phone');

            // Appointment Details
            $table->string('service_name'); // Replaces first_name in appointment details
            $table->string('service_type'); // Service category/type
            $table->unsignedBigInteger('service_id')->nullable();
            $table->unsignedBigInteger('practitioner_id')->nullable();
            $table->unsignedBigInteger('location_id')->nullable();
            $table->string('mode'); // Changed from location to mode
            $table->datetime('appointment_datetime')->nullable();
            $table->string('date_time_preference')->nullable(); // Live availability, morning slots, etc.
            $table->string('booking_source');
            $table->string('admin_override')->default('no-override');

            // Trigger Follow-up
            $table->boolean('send_intake_form')->default(true);
            $table->boolean('send_appointment_confirmation')->default(true);
            $table->boolean('add_to_calendar')->default(true);
            $table->boolean('tag_with_referral_source')->default(true);

            // Status and tracking
            $table->string('status')->default('pending'); // pending, confirmed, completed, cancelled
            $table->text('notes')->nullable();

            $table->timestamps();

            // Foreign key constraints
            $table->index('patient_id');
            $table->index('service_id');
            $table->index('practitioner_id');
            $table->index('location_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};

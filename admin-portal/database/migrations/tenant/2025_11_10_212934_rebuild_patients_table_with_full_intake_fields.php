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
        // Drop the existing patients table
        Schema::dropIfExists('patients');

        // Recreate with comprehensive structure matching central database
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->uuid('uid')->unique();
            $table->string('health_number')->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');

            // External reference fields for linking to central database
            $table->string('external_tenant_id')->nullable();
            $table->unsignedBigInteger('external_patient_id')->nullable();

            // Personal Information
            $table->string('first_name');
            $table->string('last_name');
            $table->string('preferred_name')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender')->nullable();
            $table->string('gender_pronouns')->nullable();
            $table->string('client_type')->nullable();

            // Contact Information
            $table->string('email')->nullable()->unique();
            $table->string('phone_number')->nullable();
            $table->string('emergency_contact_phone')->nullable();

            // Address Information
            $table->text('address')->nullable(); // Legacy field
            $table->string('address_lookup')->nullable();
            $table->string('street_address')->nullable();
            $table->string('apt_suite_unit')->nullable();
            $table->string('city')->nullable();
            $table->string('postal_zip_code')->nullable();
            $table->string('province')->nullable();

            // Health & Clinical History
            $table->text('presenting_concern')->nullable();
            $table->text('goals_for_therapy')->nullable();
            $table->string('previous_therapy_experience')->nullable();
            $table->text('current_medications')->nullable();
            $table->text('diagnoses')->nullable();
            $table->text('history_of_hospitalization')->nullable();
            $table->text('risk_safety_concerns')->nullable();
            $table->text('other_medical_conditions')->nullable();
            $table->text('cultural_religious_considerations')->nullable();
            $table->text('accessibility_needs')->nullable();

            // Insurance & Legal
            $table->string('insurance_provider')->nullable();
            $table->string('policy_number')->nullable();
            $table->string('coverage_card_path')->nullable();
            $table->boolean('consent_to_treatment')->default(false);
            $table->boolean('consent_to_data_storage')->default(false);
            $table->boolean('privacy_policy_acknowledged')->default(false);

            // Preferences
            $table->string('language_preferences')->nullable();
            $table->string('best_time_to_contact')->nullable();
            $table->string('best_way_to_contact')->nullable();
            $table->boolean('consent_to_receive_reminders')->default(false);

            // Metadata
            $table->json('meta_data')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Indexes
            $table->index('external_patient_id');
            $table->index('external_tenant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};

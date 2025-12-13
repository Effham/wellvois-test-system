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
            // Add contact_person field after patient_id
            $table->string('contact_person')->nullable()->after('patient_id');

            // Remove duplicated patient data fields - we'll use patient_id relationship instead
            $table->dropColumn([
                'first_name',
                'last_name',
                'preferred_name',
                'phone_number',
                'email_address',
                'gender_pronouns',
                'client_type',
                'date_of_birth',
                'emergency_contact_phone',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            // Remove contact_person field
            $table->dropColumn('contact_person');

            // Re-add the patient data fields
            $table->string('first_name')->after('patient_id');
            $table->string('last_name')->after('first_name');
            $table->string('preferred_name')->nullable()->after('last_name');
            $table->string('phone_number')->after('preferred_name');
            $table->string('email_address')->after('phone_number');
            $table->string('gender_pronouns')->nullable()->after('email_address');
            $table->string('client_type')->after('gender_pronouns');
            $table->date('date_of_birth')->after('client_type');
            $table->string('emergency_contact_phone')->after('date_of_birth');
        });
    }
};

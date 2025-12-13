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
        Schema::table('patients', function (Blueprint $table) {
            // Make email unique if not already
            if (! Schema::hasIndex('patients', 'patients_email_unique')) {
                $table->string('email')->unique()->change();
            }

            // Client Information fields (some may already exist)
            if (! Schema::hasColumn('patients', 'preferred_name')) {
                $table->string('preferred_name')->nullable()->after('last_name');
            }
            if (! Schema::hasColumn('patients', 'gender_pronouns')) {
                $table->string('gender_pronouns')->nullable()->after('gender');
            }
            if (! Schema::hasColumn('patients', 'client_type')) {
                $table->string('client_type')->nullable()->after('gender_pronouns');
            }
            if (! Schema::hasColumn('patients', 'emergency_contact_phone')) {
                $table->string('emergency_contact_phone')->nullable()->after('phone_number');
            }

            // Address fields (replacing single address field with detailed fields)
            if (! Schema::hasColumn('patients', 'address_lookup')) {
                $table->string('address_lookup')->nullable()->after('address');
            }
            if (! Schema::hasColumn('patients', 'street_address')) {
                $table->string('street_address')->nullable()->after('address_lookup');
            }
            if (! Schema::hasColumn('patients', 'apt_suite_unit')) {
                $table->string('apt_suite_unit')->nullable()->after('street_address');
            }
            if (! Schema::hasColumn('patients', 'city')) {
                $table->string('city')->nullable()->after('apt_suite_unit');
            }
            if (! Schema::hasColumn('patients', 'postal_zip_code')) {
                $table->string('postal_zip_code')->nullable()->after('city');
            }
            if (! Schema::hasColumn('patients', 'province')) {
                $table->string('province')->nullable()->after('postal_zip_code');
            }

            // Health & Clinical History fields
            if (! Schema::hasColumn('patients', 'presenting_concern')) {
                $table->text('presenting_concern')->nullable();
            }
            if (! Schema::hasColumn('patients', 'goals_for_therapy')) {
                $table->text('goals_for_therapy')->nullable();
            }
            if (! Schema::hasColumn('patients', 'previous_therapy_experience')) {
                $table->string('previous_therapy_experience')->nullable();
            }
            if (! Schema::hasColumn('patients', 'current_medications')) {
                $table->text('current_medications')->nullable();
            }
            if (! Schema::hasColumn('patients', 'diagnoses')) {
                $table->text('diagnoses')->nullable();
            }
            if (! Schema::hasColumn('patients', 'history_of_hospitalization')) {
                $table->text('history_of_hospitalization')->nullable();
            }
            if (! Schema::hasColumn('patients', 'risk_safety_concerns')) {
                $table->text('risk_safety_concerns')->nullable();
            }
            if (! Schema::hasColumn('patients', 'other_medical_conditions')) {
                $table->text('other_medical_conditions')->nullable();
            }
            if (! Schema::hasColumn('patients', 'cultural_religious_considerations')) {
                $table->text('cultural_religious_considerations')->nullable();
            }
            if (! Schema::hasColumn('patients', 'accessibility_needs')) {
                $table->text('accessibility_needs')->nullable();
            }

            // Insurance & Legal fields
            if (! Schema::hasColumn('patients', 'insurance_provider')) {
                $table->string('insurance_provider')->nullable();
            }
            if (! Schema::hasColumn('patients', 'policy_number')) {
                $table->string('policy_number')->nullable();
            }
            if (! Schema::hasColumn('patients', 'coverage_card_path')) {
                $table->string('coverage_card_path')->nullable(); // File path for uploaded coverage card
            }
            if (! Schema::hasColumn('patients', 'consent_to_treatment')) {
                $table->boolean('consent_to_treatment')->default(false);
            }
            if (! Schema::hasColumn('patients', 'consent_to_data_storage')) {
                $table->boolean('consent_to_data_storage')->default(false);
            }
            if (! Schema::hasColumn('patients', 'privacy_policy_acknowledged')) {
                $table->boolean('privacy_policy_acknowledged')->default(false);
            }

            // Preferences fields
            if (! Schema::hasColumn('patients', 'language_preferences')) {
                $table->string('language_preferences')->nullable();
            }
            if (! Schema::hasColumn('patients', 'best_time_to_contact')) {
                $table->string('best_time_to_contact')->nullable();
            }
            if (! Schema::hasColumn('patients', 'best_way_to_contact')) {
                $table->string('best_way_to_contact')->nullable();
            }
            if (! Schema::hasColumn('patients', 'consent_to_receive_reminders')) {
                $table->boolean('consent_to_receive_reminders')->default(false);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // Remove only the new fields we added, checking if they exist first
            $columnsToRemove = [];

            $potentialColumns = [
                'preferred_name',
                'gender_pronouns',
                'client_type',
                'emergency_contact_phone',
                'address_lookup',
                'street_address',
                'apt_suite_unit',
                'city',
                'postal_zip_code',
                'province',
                'presenting_concern',
                'goals_for_therapy',
                'previous_therapy_experience',
                'current_medications',
                'diagnoses',
                'history_of_hospitalization',
                'risk_safety_concerns',
                'other_medical_conditions',
                'cultural_religious_considerations',
                'accessibility_needs',
                'insurance_provider',
                'policy_number',
                'coverage_card_path',
                'consent_to_treatment',
                'consent_to_data_storage',
                'privacy_policy_acknowledged',
                'language_preferences',
                'best_time_to_contact',
                'best_way_to_contact',
                'consent_to_receive_reminders',
            ];

            foreach ($potentialColumns as $column) {
                if (Schema::hasColumn('patients', $column)) {
                    $columnsToRemove[] = $column;
                }
            }

            if (! empty($columnsToRemove)) {
                $table->dropColumn($columnsToRemove);
            }
        });
    }
};

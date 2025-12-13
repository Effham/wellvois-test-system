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
        Schema::table('practitioners', function (Blueprint $table) {
            // Professional Details
            $table->json('credentials')->nullable(); // array of credentials
            $table->string('years_of_experience')->nullable();
            $table->string('license_number')->nullable();
            $table->json('professional_associations')->nullable(); // array of associations
            $table->json('primary_specialties')->nullable(); // array of specialties
            $table->json('therapeutic_modalities')->nullable(); // array of modalities
            $table->json('client_types_served')->nullable(); // array of client types
            $table->json('languages_spoken')->nullable(); // array of languages

            // File uploads (store file paths as JSON)
            $table->json('resume_files')->nullable();
            $table->json('licensing_docs')->nullable();
            $table->json('certificates')->nullable();

            // Basic Info additions
            $table->string('extension')->nullable(); // phone extension
            $table->boolean('is_active')->default(true);

            // Availability & Scheduling (store as JSON for flexibility)
            $table->json('availability_schedule')->nullable(); // weekly schedule
            $table->json('location_assignments')->nullable(); // which locations they're assigned to
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioners', function (Blueprint $table) {
            $table->dropColumn([
                'credentials',
                'years_of_experience',
                'license_number',
                'professional_associations',
                'primary_specialties',
                'therapeutic_modalities',
                'client_types_served',
                'languages_spoken',
                'resume_files',
                'licensing_docs',
                'certificates',
                'extension',
                'is_active',
                'availability_schedule',
                'location_assignments',
            ]);
        });
    }
};

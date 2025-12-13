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
        Schema::create('practitioner_records', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('central_practitioner_id'); // Reference to central practitioners.id
            $table->unsignedBigInteger('user_id')->nullable();

            // Basic Info
            $table->string('first_name');
            $table->string('last_name');
            $table->string('title')->nullable();
            $table->string('email');
            $table->string('phone_number')->nullable();
            $table->string('extension')->nullable();
            $table->string('gender')->nullable();
            $table->string('pronoun')->nullable();
            $table->text('short_bio')->nullable();
            $table->longText('full_bio')->nullable();
            $table->string('slug')->nullable()->unique();

            // Profile
            $table->string('profile_picture_path')->nullable();
            $table->string('profile_picture_s3_key')->nullable();
            $table->string('profile_picture_url')->nullable();

            // Professional Details
            $table->json('credentials')->nullable();
            $table->string('years_of_experience')->nullable();
            $table->string('license_number')->nullable();
            $table->json('professional_associations')->nullable();
            $table->json('primary_specialties')->nullable();
            $table->json('therapeutic_modalities')->nullable();
            $table->json('client_types_served')->nullable();
            $table->json('languages_spoken')->nullable();

            // Documents
            $table->json('resume_files')->nullable();
            $table->json('licensing_docs')->nullable();
            $table->json('certificates')->nullable();

            // Additional fields
            $table->json('available_days')->nullable();
            $table->json('location_assignments')->nullable();
            $table->json('availability_schedule')->nullable();
            $table->json('service_pricing')->nullable();
            $table->json('meta_data')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            // Index for lookups
            $table->index('central_practitioner_id');
            $table->index('email');
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('practitioner_records');
    }
};

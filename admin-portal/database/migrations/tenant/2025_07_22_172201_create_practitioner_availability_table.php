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
        Schema::create('practitioner_availability', function (Blueprint $table) {
            $table->id();
            $table->integer('practitioner_id'); // Reference to central practitioners.id
            $table->unsignedBigInteger('location_id'); // Reference to locations.id in tenant database
            $table->json('availability_schedule')->nullable(); // Weekly schedule for this location
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Note: Foreign keys and unique constraints removed for easier database management
            // These can be added back later when needed
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('practitioner_availability');
    }
};

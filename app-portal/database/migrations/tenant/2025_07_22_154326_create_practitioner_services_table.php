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
        Schema::create('practitioner_services', function (Blueprint $table) {
            $table->id();
            $table->integer('practitioner_id'); // Reference to central practitioners.id
            $table->integer('service_id'); // Reference to tenant services.id
            $table->decimal('custom_price', 64, 2)->nullable(); // Custom price override
            $table->integer('custom_duration_minutes')->nullable(); // Custom duration override
            $table->boolean('is_offered')->default(true); // Whether practitioner offers this service
            $table->timestamps();

            // Note: Unique constraints removed for easier database management
            // These can be added back later when needed
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('practitioner_services');
    }
};

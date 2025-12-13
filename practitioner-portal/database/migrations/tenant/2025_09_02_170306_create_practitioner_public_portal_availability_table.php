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
        if (! Schema::hasTable('practitioner_portal_availability')) {
            Schema::create('practitioner_portal_availability', function (Blueprint $table) {
                $table->id();
                $table->integer('practitioner_id'); // Reference to central practitioners.id
                $table->integer('location_id'); // Reference to locations.id
                $table->enum('day', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
                $table->time('start_time');
                $table->time('end_time');
                $table->boolean('is_enabled')->default(true);
                $table->text('notes')->nullable();
                $table->timestamps();

                // Ensure unique slots per practitioner per location per day per time
                $table->index(['practitioner_id', 'location_id', 'day'], 'prac_portal_avail_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('practitioner_portal_availability');
    }
};

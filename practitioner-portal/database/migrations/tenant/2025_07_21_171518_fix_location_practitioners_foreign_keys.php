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
        // Only create if the table doesn't exist
        if (! Schema::hasTable('location_practitioners')) {
            Schema::create('location_practitioners', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('location_id');
                $table->unsignedBigInteger('practitioner_id');
                $table->boolean('is_assigned')->default(false);
                $table->timestamps();

                // Note: Foreign keys and unique constraints removed for easier database management
                // These can be added back later when needed
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};

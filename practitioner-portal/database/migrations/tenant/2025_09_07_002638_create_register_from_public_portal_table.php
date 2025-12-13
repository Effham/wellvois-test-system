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
        Schema::create('register_from_public_portal', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('patient_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamp('registered_at');
            $table->timestamps();

            // Add indexes for better performance
            $table->index('patient_id');
            $table->index('user_id');
            $table->index('registered_at');

            // Ensure unique combination of patient_id and user_id
            $table->unique(['patient_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('register_from_public_portal');
    }
};

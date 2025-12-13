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
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Team name (e.g., 'Accounting Team', 'Appointments Team')
            $table->text('description')->nullable(); // Team description
            $table->string('color')->default('#3B82F6'); // Team color for UI
            $table->boolean('is_active')->default(true); // Team status
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade'); // Creator
            $table->json('settings')->nullable(); // Team specific settings
            $table->timestamps();

            $table->index('name');
            $table->index('is_active');
            $table->index('created_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teams');
    }
};

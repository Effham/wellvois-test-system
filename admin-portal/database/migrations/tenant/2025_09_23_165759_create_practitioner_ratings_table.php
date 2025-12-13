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
        Schema::create('practitioner_ratings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('appointment_id');
            $table->unsignedBigInteger('practitioner_id'); // From central database
            $table->unsignedBigInteger('patient_id'); // From central database
            $table->decimal('rating_points', 3, 2); // Points allocated to this practitioner (0.00-5.00)
            $table->decimal('rating_percentage', 5, 2); // Percentage of total rating (0.00-100.00)
            $table->boolean('is_lead_practitioner')->default(false); // Who led the visit
            $table->boolean('is_called_out')->default(false); // Who was called out for recognition
            $table->text('notes')->nullable(); // Any specific notes about this practitioner's performance
            $table->timestamps();

            // Indexes
            $table->index('appointment_id');
            $table->index('practitioner_id');
            $table->index('patient_id');
            $table->index('rating_points');
            $table->index('is_lead_practitioner');
            $table->index('is_called_out');

            // Composite indexes for common queries
            $table->index(['practitioner_id', 'rating_points']);
            $table->index(['appointment_id', 'practitioner_id']);

            // Ensure one rating per practitioner per appointment
            $table->unique(['appointment_id', 'practitioner_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('practitioner_ratings');
    }
};

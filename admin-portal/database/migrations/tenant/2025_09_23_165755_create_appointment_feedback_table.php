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
        Schema::create('appointment_feedback', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('appointment_id');
            $table->unsignedBigInteger('patient_id'); // From central database
            $table->integer('visit_rating'); // 1-5 star rating
            $table->unsignedBigInteger('visit_led_by_id')->nullable(); // Practitioner ID who led the visit
            $table->unsignedBigInteger('call_out_person_id')->nullable(); // Practitioner ID to call out/recognize
            $table->text('additional_feedback')->nullable(); // Additional comments
            $table->boolean('is_editable')->default(true); // Whether patient can still edit
            $table->timestamp('submitted_at')->nullable(); // When feedback was first submitted
            $table->timestamp('last_edited_at')->nullable(); // When feedback was last edited
            $table->timestamps();

            // Indexes
            $table->index('appointment_id');
            $table->index('patient_id');
            $table->index('visit_rating');
            $table->index('submitted_at');

            // Ensure one feedback per appointment
            $table->unique('appointment_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointment_feedback');
    }
};

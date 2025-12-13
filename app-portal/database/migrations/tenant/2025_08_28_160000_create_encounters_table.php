<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('encounters', function (Blueprint $table) {
            $table->id();
            $table->integer('appointment_id');
            $table->enum('status', ['in_progress', 'completed'])->default('in_progress');

            // Chief Complaint & Documentation
            $table->text('chief_complaint')->nullable();
            $table->text('history_of_present_illness')->nullable();
            $table->text('examination_notes')->nullable();
            $table->text('clinical_assessment')->nullable();
            $table->text('treatment_plan')->nullable();
            $table->text('additional_notes')->nullable();

            // Vital Signs
            $table->string('blood_pressure_systolic', 10)->nullable();
            $table->string('blood_pressure_diastolic', 10)->nullable();
            $table->string('heart_rate', 10)->nullable();
            $table->string('temperature', 10)->nullable();
            $table->string('respiratory_rate', 10)->nullable();
            $table->string('oxygen_saturation', 10)->nullable();
            $table->string('weight', 10)->nullable();
            $table->string('height', 10)->nullable();
            $table->string('bmi', 10)->nullable();

            // Session Metadata
            $table->text('session_recording')->nullable();
            $table->timestamp('session_started_at')->nullable();
            $table->timestamp('session_completed_at')->nullable();
            $table->integer('session_duration_seconds')->nullable();

            $table->timestamps();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('encounters');
    }
};

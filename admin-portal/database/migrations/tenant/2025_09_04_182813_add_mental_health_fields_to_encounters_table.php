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
        Schema::table('encounters', function (Blueprint $table) {
            // Mental health specific fields
            $table->text('mental_state_exam')->nullable()->after('session_recording');
            $table->text('mood_affect')->nullable()->after('mental_state_exam');
            $table->text('thought_process')->nullable()->after('mood_affect');
            $table->text('cognitive_assessment')->nullable()->after('thought_process');
            $table->text('risk_assessment')->nullable()->after('cognitive_assessment');
            $table->text('therapeutic_interventions')->nullable()->after('risk_assessment');
            $table->text('session_goals')->nullable()->after('therapeutic_interventions');
            $table->text('homework_assignments')->nullable()->after('session_goals');

            // Session type to help determine UI layout
            $table->string('session_type')->nullable()->after('appointment_id')->default('general');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounters', function (Blueprint $table) {
            $table->dropColumn([
                'mental_state_exam',
                'mood_affect',
                'thought_process',
                'cognitive_assessment',
                'risk_assessment',
                'therapeutic_interventions',
                'session_goals',
                'homework_assignments',
                'session_type',
            ]);
        });
    }
};

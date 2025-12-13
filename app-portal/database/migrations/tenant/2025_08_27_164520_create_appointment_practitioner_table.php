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
        if (! Schema::hasTable('appointment_practitioner')) {
            Schema::create('appointment_practitioner', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('appointment_id');
                $table->unsignedBigInteger('practitioner_id');
                $table->datetime('start_time');
                $table->datetime('end_time');
                $table->string('google_calendar_event_id')->nullable();
                $table->timestamps();

                // Indexes
                $table->index(['appointment_id', 'practitioner_id']);
                $table->index('start_time');
                $table->index('end_time');
                $table->index('google_calendar_event_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointment_practitioner');
    }
};

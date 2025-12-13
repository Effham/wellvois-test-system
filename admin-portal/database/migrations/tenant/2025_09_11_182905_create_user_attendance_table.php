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
        Schema::create('user_attendance', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id'); // User ID from tenant users table
            $table->date('date'); // Date of attendance
            $table->time('clock_in_time')->nullable(); // When user clocked in
            $table->time('clock_out_time')->nullable(); // When user clocked out
            $table->integer('total_duration_minutes')->nullable(); // Total duration in minutes
            $table->enum('status', ['clocked_in', 'clocked_out', 'not_clocked_in'])->default('not_clocked_in');
            $table->timestamps();

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_attendance');
    }
};

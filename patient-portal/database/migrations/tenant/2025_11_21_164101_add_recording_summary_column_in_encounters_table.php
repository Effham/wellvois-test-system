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
        Schema::table('encounter_recordings', function (Blueprint $table) {
            // Change JSON columns to LONGTEXT to support encrypted data
            // Encrypted ciphertext cannot be validated as JSON by MySQL
            $table->longText('transcription_timestamps')->nullable()->change();
            $table->longText('transcription_speaker_segments')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounter_recordings', function (Blueprint $table) {
            // Revert back to JSON columns (only if data is not encrypted)
            $table->json('transcription_timestamps')->nullable()->change();
            $table->json('transcription_speaker_segments')->nullable()->change();
        });
    }
};

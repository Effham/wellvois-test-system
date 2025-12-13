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
            $table->json('transcription_speaker_segments')->nullable()->after('transcription_timestamps')->comment('Speaker-segmented transcription from Amazon Transcribe');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounter_recordings', function (Blueprint $table) {
            $table->dropColumn(['transcription_speaker_segments']);
        });
    }
};

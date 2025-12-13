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
            $table->enum('transcription_status', ['pending', 'processing', 'completed', 'failed'])->nullable()->after('metadata');
            $table->longText('transcription')->nullable()->after('transcription_status');

            $table->index('transcription_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounter_recordings', function (Blueprint $table) {
            $table->dropIndex(['transcription_status']);
            $table->dropColumn(['transcription_status', 'transcription']);
        });
    }
};

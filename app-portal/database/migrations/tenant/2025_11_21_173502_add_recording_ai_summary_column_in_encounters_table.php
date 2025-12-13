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
            $table->string('recording_ai_summary_type')->nullable()->after('ai_summary')->comment('Type of AI summary generated from recordings');
            $table->longText('recording_ai_summary')->nullable()->after('recording_ai_summary_type')->comment('AI-generated summary from encounter recordings (encrypted)');
            $table->string('recording_ai_summary_status')->default('pending')->after('recording_ai_summary')->comment('Status of recording AI summary generation: pending, processing, completed, failed');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounters', function (Blueprint $table) {
            $table->dropColumn(['recording_ai_summary_type', 'recording_ai_summary', 'recording_ai_summary_status']);
        });
    }
};

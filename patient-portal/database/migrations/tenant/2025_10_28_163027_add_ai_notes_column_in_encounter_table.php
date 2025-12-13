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
            $table->string('note_type', 50)
                ->nullable()
                ->after('additional_notes')
                ->comment('Type of note format selected for AI generation e.g. SOAP, DAP, etc.');

            $table->enum('ai_note_status', ['pending', 'in_progress', 'generated', 'failed'])
                ->default('pending')
                ->nullable()
                ->after('note_type')
                ->comment('Status of AI note generation');

            $table->longText('ai_note')
                ->nullable()
                ->after('ai_note_status')
                ->comment('Generated AI note text (formatted output)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounter', function (Blueprint $table) {
            $table->dropColumn(['note_type', 'ai_note_status', 'ai_note']);
        });
    }
};

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
        Schema::table('encounter_document_requests', function (Blueprint $table) {
            $table->boolean('by_practitioner')->default(false)->after('priority');
            $table->index('by_practitioner');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounter_document_requests', function (Blueprint $table) {
            $table->dropIndex(['by_practitioner']);
            $table->dropColumn('by_practitioner');
        });
    }
};

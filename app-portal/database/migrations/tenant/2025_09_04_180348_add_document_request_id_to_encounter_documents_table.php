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
        Schema::table('encounter_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('encounter_documents', 'document_request_id')) {
                $table->unsignedBigInteger('document_request_id')->nullable()->after('document_type');
                $table->index('document_request_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounter_documents', function (Blueprint $table) {
            if (Schema::hasColumn('encounter_documents', 'document_request_id')) {
                $table->dropIndex(['document_request_id']);
                $table->dropColumn('document_request_id');
            }
        });
    }
};

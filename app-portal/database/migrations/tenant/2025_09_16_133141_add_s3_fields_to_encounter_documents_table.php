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
            $table->string('s3_key')->nullable()->after('file_path')->index();
            $table->dropColumn('file_path'); // Remove old file_path as we'll use s3_key
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('encounter_documents', function (Blueprint $table) {
            $table->string('file_path')->after('file_name');
            $table->dropColumn('s3_key');
        });
    }
};

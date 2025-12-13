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
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->string('setting_type')->default('string')->after('value'); // string, json, file, etc.
            $table->text('description')->nullable()->after('setting_type');

            // S3 fields for file settings (logo, documents, etc.)
            $table->string('s3_key')->nullable()->after('description')->index();
            $table->string('original_filename')->nullable()->after('s3_key');
            $table->string('mime_type')->nullable()->after('original_filename');
            $table->bigInteger('file_size')->nullable()->after('mime_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn([
                'setting_type',
                'description',
                's3_key',
                'original_filename',
                'mime_type',
                'file_size',
            ]);
        });
    }
};

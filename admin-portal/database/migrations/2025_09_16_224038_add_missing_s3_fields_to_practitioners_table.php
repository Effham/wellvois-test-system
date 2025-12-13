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
        Schema::table('practitioners', function (Blueprint $table) {
            // Add S3 key fields for licensing documents and certificates
            if (! Schema::hasColumn('practitioners', 'licensing_documents_s3_key')) {
                $table->string('licensing_documents_s3_key')->nullable()->after('resume_s3_key');
            }

            if (! Schema::hasColumn('practitioners', 'certificates_s3_key')) {
                $table->string('certificates_s3_key')->nullable()->after('licensing_documents_s3_key');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioners', function (Blueprint $table) {
            $table->dropColumn(['licensing_documents_s3_key', 'certificates_s3_key']);
        });
    }
};

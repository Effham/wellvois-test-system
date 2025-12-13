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
            // Add resume_s3_key only if it doesn't exist
            if (! Schema::hasColumn('practitioners', 'resume_s3_key')) {
                $table->string('resume_s3_key')->nullable()->after('profile_picture_s3_key');
            }

            // Add licensing_documents only if it doesn't exist
            if (! Schema::hasColumn('practitioners', 'licensing_documents')) {
                $table->json('licensing_documents')->nullable()->after('resume_s3_key');
            }

            // Add certificates only if it doesn't exist
            if (! Schema::hasColumn('practitioners', 'certificates')) {
                $table->json('certificates')->nullable()->after('licensing_documents');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioners', function (Blueprint $table) {
            $table->dropColumn(['resume_s3_key', 'licensing_documents', 'certificates']);
        });
    }
};

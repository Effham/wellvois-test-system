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
            $table->string('profile_picture_s3_key')->nullable()->after('profile_picture_path');
            $table->text('profile_picture_url')->nullable()->after('profile_picture_s3_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioners', function (Blueprint $table) {
            $table->dropColumn(['profile_picture_s3_key', 'profile_picture_url']);
        });
    }
};

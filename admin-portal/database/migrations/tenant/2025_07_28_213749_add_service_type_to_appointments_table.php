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
        Schema::table('appointments', function (Blueprint $table) {
            // Only add the column if it doesn't already exist
            if (! Schema::hasColumn('appointments', 'service_type')) {
                $table->string('service_type')->nullable()->after('service_name');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            // Only drop the column if it exists
            if (Schema::hasColumn('appointments', 'service_type')) {
                $table->dropColumn('service_type');
            }
        });
    }
};

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
            // Remove duplicated service data fields - we'll use service_id relationship instead
            if (Schema::hasColumn('appointments', 'service_name')) {
                $table->dropColumn('service_name');
            }
            if (Schema::hasColumn('appointments', 'service_type')) {
                $table->dropColumn('service_type');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            // Re-add the service data fields
            $table->string('service_name')->after('contact_person');
            $table->string('service_type')->nullable()->after('service_name');
        });
    }
};

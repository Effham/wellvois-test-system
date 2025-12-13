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
        Schema::table('patients', function (Blueprint $table) {
            // Make date_birth nullable
            $table->date('date_of_birth')->nullable()->change();

            // Add external_tenant_id as string
            $table->string('external_tenant_id')->nullable()->after('user_id');

            // Add external_patient_id as integer
            $table->unsignedBigInteger('external_patient_id')->nullable()->after('external_tenant_id');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {

            $table->date('date_of_birth')->nullable(false)->change();

            $table->dropColumn(['external_tenant_id', 'external_patient_id']);
        });
    }
};

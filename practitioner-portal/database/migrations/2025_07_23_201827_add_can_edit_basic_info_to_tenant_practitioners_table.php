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
        Schema::table('tenant_practitioners', function (Blueprint $table) {
            $table->boolean('can_edit_basic_info')->default(true)->after('can_edit_professional_details');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenant_practitioners', function (Blueprint $table) {
            $table->dropColumn('can_edit_basic_info');
        });
    }
};

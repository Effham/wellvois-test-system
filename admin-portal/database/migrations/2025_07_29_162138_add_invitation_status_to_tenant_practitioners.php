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
            $table->enum('invitation_status', ['PENDING_INVITATION', 'INVITED', 'ACCEPTED', 'DECLINED'])
                ->default('PENDING_INVITATION')
                ->after('practitioner_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenant_practitioners', function (Blueprint $table) {
            $table->dropColumn('invitation_status');
        });
    }
};

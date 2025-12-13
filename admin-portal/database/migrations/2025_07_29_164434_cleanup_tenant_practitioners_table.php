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
            // Drop the leftover columns that should not exist
            $table->dropColumn(['can_edit_professional_details', 'can_edit_basic_info']);

            // Drop the duplicate invitation_status_new column if it exists
            if (Schema::hasColumn('tenant_practitioners', 'invitation_status_new')) {
                $table->dropColumn('invitation_status_new');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenant_practitioners', function (Blueprint $table) {
            // Restore the columns in case we need to rollback
            $table->boolean('can_edit_professional_details')->default(true);
            $table->boolean('can_edit_basic_info')->default(true);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop the foreign key constraint first if it exists
        $foreignKeys = DB::select("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'subscriptions' 
            AND COLUMN_NAME = 'tenant_id' 
            AND CONSTRAINT_NAME != 'PRIMARY'
            AND REFERENCED_TABLE_NAME IS NOT NULL
        ");
        
        foreach ($foreignKeys as $foreignKey) {
            Schema::table('subscriptions', function (Blueprint $table) use ($foreignKey) {
                $table->dropForeign([$foreignKey->CONSTRAINT_NAME]);
            });
        }

        // Change tenant_id from integer to string
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->string('tenant_id', 255)->change();
        });

        // Check if index exists before trying to add it
        $indexes = DB::select("
            SELECT INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'subscriptions' 
            AND INDEX_NAME = 'subscriptions_tenant_id_stripe_status_index'
        ");
        
        if (empty($indexes)) {
            Schema::table('subscriptions', function (Blueprint $table) {
                $table->index(['tenant_id', 'stripe_status'], 'subscriptions_tenant_id_stripe_status_index');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex('subscriptions_tenant_id_stripe_status_index');
            $table->unsignedBigInteger('tenant_id')->change();
            $table->foreign('tenant_id')->references('id')->on('tenants');
        });
    }
};

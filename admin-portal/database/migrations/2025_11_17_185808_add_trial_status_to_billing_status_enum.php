<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Modify enum to include 'trial' status
        DB::statement("ALTER TABLE tenants MODIFY COLUMN billing_status ENUM('pending', 'trial', 'active', 'past_due', 'canceled', 'incomplete') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert enum to original values
        DB::statement("ALTER TABLE tenants MODIFY COLUMN billing_status ENUM('pending', 'active', 'past_due', 'canceled', 'incomplete') DEFAULT 'pending'");
    }
};

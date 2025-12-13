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
        Schema::table('invoices', function (Blueprint $table) {
            // Check if invoice_number column doesn't exist before adding
            if (! Schema::hasColumn('invoices', 'invoice_number')) {
                // Add invoice_number column after id
                $table->string('invoice_number', 50)->after('id')->nullable();
            }
        });

        // Add unique index separately to avoid issues if column already exists
        try {
            Schema::table('invoices', function (Blueprint $table) {
                $table->unique('invoice_number', 'uq_invoices_number');
            });
        } catch (\Exception $e) {
            // Index might already exist, ignore the error
            if (! str_contains($e->getMessage(), 'Duplicate key name')) {
                throw $e;
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop unique index if it exists
        try {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropUnique('uq_invoices_number');
            });
        } catch (\Exception $e) {
            // Index might not exist, ignore the error
        }

        // Drop column if it exists
        Schema::table('invoices', function (Blueprint $table) {
            if (Schema::hasColumn('invoices', 'invoice_number')) {
                $table->dropColumn('invoice_number');
            }
        });
    }
};

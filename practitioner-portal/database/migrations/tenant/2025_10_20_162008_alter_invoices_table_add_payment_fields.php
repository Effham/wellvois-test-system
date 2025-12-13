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
            // Add payment_method (nullable string for gateway, pos, cash, manual)
            $table->string('payment_method')->nullable()->after('price');

            // Add paid_at timestamp
            $table->timestamp('paid_at')->nullable()->after('payment_method');

            // Add meta JSON column
            $table->json('meta')->nullable()->after('paid_at');

            // Add status enum
            $table->enum('status', ['pending', 'paid', 'paid_manual', 'failed', 'refunded'])->default('pending')->after('meta');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'paid_at', 'meta', 'status']);
        });
    }
};

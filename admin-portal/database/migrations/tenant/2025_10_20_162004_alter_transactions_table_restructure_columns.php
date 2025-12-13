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
        Schema::table('transactions', function (Blueprint $table) {
            // Drop old columns
            $table->dropForeign(['wallet_id']);
            $table->dropColumn([
                'wallet_id',
                'price',
                'transaction_type',
                'accountable_type',
                'accountable_id',
            ]);

            // Add new columns
            $table->unsignedBigInteger('from_wallet_id')->nullable()->after('id');
            $table->unsignedBigInteger('to_wallet_id')->nullable()->after('from_wallet_id');
            $table->unsignedBigInteger('invoice_id')->nullable()->after('to_wallet_id');
            $table->decimal('amount', 64, 2)->after('invoice_id');
            $table->enum('type', ['invoice_payment', 'payout', 'refund', 'adjustment'])->after('amount');
            $table->enum('direction_source', ['internal_wallet', 'external_gateway', 'external_pos', 'external_cash'])->after('type');
            $table->string('payment_method')->nullable()->after('direction_source'); // gateway, pos, cash, manual, internal
            $table->string('provider_ref')->nullable()->after('payment_method'); // stripe ID, staff ID, etc
            $table->text('payment_proof_url')->nullable()->after('provider_ref');
            $table->enum('status', ['pending', 'completed', 'failed'])->default('completed')->after('payment_proof_url');

            // Add foreign keys
            $table->foreign('from_wallet_id')->references('id')->on('wallets')->onDelete('set null');
            $table->foreign('to_wallet_id')->references('id')->on('wallets')->onDelete('set null');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('set null');

            // Add indexes
            $table->index('from_wallet_id');
            $table->index('to_wallet_id');
            $table->index('invoice_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Drop new foreign keys
            $table->dropForeign(['from_wallet_id']);
            $table->dropForeign(['to_wallet_id']);
            $table->dropForeign(['invoice_id']);

            // Drop new columns
            $table->dropColumn([
                'from_wallet_id',
                'to_wallet_id',
                'invoice_id',
                'amount',
                'type',
                'direction_source',
                'payment_method',
                'provider_ref',
                'payment_proof_url',
                'status',
            ]);

            // Restore old columns
            $table->unsignedBigInteger('wallet_id')->after('id');
            $table->decimal('price', 10, 2)->after('wallet_id');
            $table->enum('transaction_type', ['credit', 'debit'])->after('price');
            $table->string('accountable_type')->after('transaction_type');
            $table->unsignedBigInteger('accountable_id')->after('accountable_type');

            // Restore foreign key
            $table->foreign('wallet_id')->references('id')->on('wallets')->onDelete('cascade');

            // Restore indexes
            $table->index(['accountable_type', 'accountable_id']);
            $table->index('wallet_id');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Drops and recreates wallets, transactions, and invoices tables with clean polymorphic structure.
     */
    public function up(): void
    {
        // Drop existing tables (in reverse dependency order)
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('wallets');

        // Recreate wallets table with polymorphic structure
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->enum('owner_type', ['system', 'patient', 'practitioner', 'user'])->comment('Owner type');
            $table->unsignedBigInteger('owner_id')->nullable()->comment('Owner ID (null for system wallet)');
            $table->decimal('balance', 64, 4)->default(0.0000)->comment('Cached balance');
            $table->integer('singleton_key')->nullable()->unique()->comment('For system wallet uniqueness');
            $table->char('currency', 3)->default('PKR')->comment('Currency code');
            $table->timestamps();

            // Index for efficient owner lookups
            $table->index(['owner_type', 'owner_id'], 'idx_wallets_owner');
        });

        // Recreate invoices table with customer wallet and tax support
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoiceable_type');
            $table->unsignedBigInteger('invoiceable_id');
            $table->unsignedBigInteger('customer_wallet_id')->comment('Wallet paying this invoice');
            $table->decimal('price', 64, 4)->comment('Total price (subtotal + tax)');
            $table->decimal('subtotal', 64, 4)->nullable()->comment('Amount before tax');
            $table->decimal('tax_total', 64, 4)->nullable()->comment('Total tax amount');
            $table->string('payment_method')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->json('meta')->nullable()->comment('Line items, tax details, etc.');
            $table->enum('status', ['pending', 'partial', 'paid', 'paid_manual', 'failed', 'refunded'])->default('pending');
            $table->timestamps();

            // Foreign keys and indexes
            $table->foreign('customer_wallet_id', 'fk_invoices_customer_wallet')
                ->references('id')->on('wallets')->onDelete('restrict');
            $table->index('customer_wallet_id', 'idx_invoices_customer_wallet');
            $table->index(['invoiceable_type', 'invoiceable_id'], 'idx_invoices_invoiceable');
        });

        // Recreate transactions table with idempotency support
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('from_wallet_id')->nullable();
            $table->unsignedBigInteger('to_wallet_id')->nullable();
            $table->unsignedBigInteger('invoice_id')->nullable();
            $table->decimal('amount', 64, 4)->comment('Transaction amount');
            $table->enum('type', ['invoice_payment', 'payout', 'refund', 'adjustment'])->comment('Transaction type');
            $table->enum('direction_source', ['internal_wallet', 'external_gateway', 'external_pos', 'external_cash'])
                ->comment('Where money came from/went to');
            $table->string('payment_method')->nullable();
            $table->string('provider_ref')->nullable()->comment('External payment provider reference');
            $table->string('payment_proof_url')->nullable();
            $table->enum('status', ['pending', 'completed', 'failed'])->default('completed');
            $table->string('idempotency_key', 128)->nullable()->comment('Prevents duplicate transactions');
            $table->json('meta')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('from_wallet_id')->references('id')->on('wallets')->onDelete('restrict');
            $table->foreign('to_wallet_id')->references('id')->on('wallets')->onDelete('restrict');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('restrict');

            // Indexes for performance
            $table->unique('idempotency_key', 'uq_transactions_idem');
            $table->index('invoice_id', 'idx_txn_invoice');
            $table->index('from_wallet_id', 'idx_txn_from_wallet');
            $table->index('to_wallet_id', 'idx_txn_to_wallet');
            $table->index(['status', 'created_at'], 'idx_txn_status_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('wallets');
    }
};

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
        if (! Schema::hasTable('transactions')) {
            Schema::create('transactions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('wallet_id');
                $table->decimal('price', 10, 2);
                $table->enum('transaction_type', ['credit', 'debit']);
                $table->string('accountable_type'); // Polymorphic relationship type
                $table->unsignedBigInteger('accountable_id'); // Polymorphic relationship ID
                $table->timestamps();

                // Foreign key constraint to wallets table
                $table->foreign('wallet_id')->references('id')->on('wallets')->onDelete('cascade');

                // Index for polymorphic relationship
                $table->index(['accountable_type', 'accountable_id']);
                $table->index('wallet_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};

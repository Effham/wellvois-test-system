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
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // e.g., "Monthly Plan"
            $table->string('slug')->unique(); // e.g., "monthly"
            $table->string('stripe_price_id')->nullable(); // Stripe Price ID
            $table->string('stripe_product_id')->nullable(); // Stripe Product ID
            $table->decimal('price', 10, 2); // Price in dollars
            $table->string('currency', 3)->default('usd'); // Currency code
            $table->enum('billing_interval', ['month', 'year']); // monthly, yearly
            $table->integer('billing_interval_count')->default(1); // 1, 6 (for bi-annual), 12
            $table->text('description')->nullable();
            $table->json('features')->nullable(); // JSON array of features
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscription_plans');
    }
};

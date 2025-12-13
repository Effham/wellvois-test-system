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
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('stripe_payment_intent_id')->nullable()->after('stripe_id');
            $table->integer('number_of_seats')->default(1)->after('subscription_plan_id');
            $table->decimal('total_amount_paid', 10, 2)->nullable()->after('number_of_seats');
            $table->string('payment_currency', 3)->default('usd')->after('total_amount_paid');
            $table->json('payment_metadata')->nullable()->after('payment_currency');

            $table->index('stripe_payment_intent_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropIndex(['stripe_payment_intent_id']);
            $table->dropColumn([
                'stripe_payment_intent_id',
                'number_of_seats',
                'total_amount_paid',
                'payment_currency',
                'payment_metadata',
            ]);
        });
    }
};

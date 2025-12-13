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
            // Stripe Connect account ID for marketplace functionality
            $table->string('stripe_account_id')->nullable()->after('stripe_id');
            
            // Track onboarding completion status
            $table->boolean('stripe_onboarding_complete')->default(false)->after('stripe_account_id');
            
            // Store requirements needed for account
            $table->json('stripe_requirements')->nullable()->after('stripe_onboarding_complete');
            
            // Track when account was fully verified
            $table->timestamp('stripe_verified_at')->nullable()->after('stripe_requirements');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'stripe_account_id',
                'stripe_onboarding_complete',
                'stripe_requirements',
                'stripe_verified_at',
            ]);
        });
    }
};

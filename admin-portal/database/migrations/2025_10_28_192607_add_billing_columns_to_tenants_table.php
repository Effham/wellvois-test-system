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
            // Check if columns don't exist before adding them
            if (! Schema::hasColumn('tenants', 'subscription_plan_id')) {
                $table->foreignId('subscription_plan_id')->nullable()->constrained('subscription_plans')->onDelete('set null');
            }

            if (! Schema::hasColumn('tenants', 'billing_status')) {
                $table->enum('billing_status', ['pending', 'active', 'past_due', 'canceled', 'incomplete'])->default('pending');
            }

            if (! Schema::hasColumn('tenants', 'requires_billing_setup')) {
                $table->boolean('requires_billing_setup')->default(true);
            }

            if (! Schema::hasColumn('tenants', 'billing_completed_at')) {
                $table->timestamp('billing_completed_at')->nullable();
            }

            if (! Schema::hasColumn('tenants', 'on_trial')) {
                $table->boolean('on_trial')->default(false);
            }

            if (! Schema::hasColumn('tenants', 'subscribed_at')) {
                $table->timestamp('subscribed_at')->nullable();
            }

            if (! Schema::hasColumn('tenants', 'subscription_ends_at')) {
                $table->timestamp('subscription_ends_at')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropForeign(['subscription_plan_id']);
            $table->dropColumn([
                'subscription_plan_id',
                'billing_status',
                'requires_billing_setup',
                'billing_completed_at',
                'on_trial',
                'subscribed_at',
                'subscription_ends_at',
            ]);
        });
    }
};

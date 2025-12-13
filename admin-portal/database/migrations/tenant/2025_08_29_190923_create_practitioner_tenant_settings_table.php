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
        if (! Schema::hasTable('practitioner_tenant_settings')) {
            Schema::create('practitioner_tenant_settings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('practitioner_id'); // Reference to central practitioners.id
                $table->json('available_days')->nullable(); // Tenant-specific available days
                $table->boolean('is_active')->default(true); // Whether practitioner is active in this tenant
                $table->json('settings')->nullable(); // Additional tenant-specific settings
                $table->timestamps();

                // Ensure one record per practitioner per tenant
                $table->unique('practitioner_id', 'unique_practitioner_tenant_settings');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('practitioner_tenant_settings');
    }
};

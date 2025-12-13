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
        Schema::create('user_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name'); // e.g., 'Google Calendar', 'Outlook Calendar'
            $table->string('type'); // e.g., 'calendar', 'communication', 'storage'
            $table->string('provider'); // e.g., 'google', 'microsoft'
            $table->boolean('is_active')->default(false);
            $table->boolean('is_configured')->default(false);
            $table->string('status')->default('inactive'); // inactive, active, error, pending
            $table->text('description')->nullable();
            $table->string('icon_url')->nullable();
            $table->string('color')->nullable(); // Brand color for the card
            $table->json('configuration')->nullable(); // Store configuration settings
            $table->json('credentials')->nullable(); // Store encrypted credentials
            $table->json('response_data')->nullable(); // Store integration API responses
            $table->json('settings')->nullable(); // Store user preferences/settings
            $table->timestamp('last_sync_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'provider']);
            $table->index(['user_id', 'is_active']);
            $table->index('type');
            $table->unique(['user_id', 'provider']); // One integration per provider per user
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_integrations');
    }
};
